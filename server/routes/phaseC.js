// server/routes/phaseC.js
// ═══════════════════════════════════════════════════════════════
// Phase C API Routes
//
// AI:
//   GET  /api/ai/fleets              — 사용 가능한 AI 함대 목록
//   POST /api/ai/fight               — AI와 즉시 전투 (연습)
//
// Tournament:
//   GET  /api/tournaments            — 토너먼트 목록
//   GET  /api/tournaments/:id        — 토너먼트 상세
//   POST /api/tournaments            — 생성
//   POST /api/tournaments/:id/register — 참가 신청
//
// Hijack:
//   GET  /api/hijack/mine            — 내 하이잭 이력
//   GET  /api/hijack/:id(\\d+)             — 하이잭 상세
//   POST /api/hijack/declare         — [DEPRECATED 410] 영토 이전 없는 레거시 전투-only 경로
//                                       실제 영토 하이잭: POST /api/hijack/declare-with-pp (routes/api.js)
//                                       PvP 함대전 (영토 X): POST /api/ai/fight (AI) / 토너먼트 브라켓
//   POST /api/hijack/:id(\\d+)/phase2      — Phase 2 시작
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const aiFleetManager = require('../services/aiFleetManager');
const tournament = require('../services/tournament');
const hijack = require('../services/hijack');

// ── 인증 (inline JWT) ──
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

// ═══════════════════════════════════════════════════════════════
// AI ENDPOINTS
// ═══════════════════════════════════════════════════════════════

router.get('/ai/fleets', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { rows: userRows } = await pool.query(
      `SELECT faction_code FROM users WHERE wallet_address = $1`, [wallet]
    );

    const fleets = await aiFleetManager.listAvailableAiFleets(userRows[0]?.faction_code);
    res.json({ fleets });
  } catch (err) {
    console.error('[phaseC] ai/fleets error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/ai/fight', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const wallet = (getWallet(req) || '').toLowerCase();
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { my_fleet_id, ai_fleet_id } = req.body || {};
    if (!my_fleet_id || !ai_fleet_id) {
      return res.status(400).json({ error: 'FLEET_IDS_REQUIRED' });
    }

    await client.query('BEGIN');

    const { rows: fleetColumnRows } = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fleets'
        AND column_name = 'is_ai'
      LIMIT 1
    `);
    const hasFleetIsAi = fleetColumnRows.length > 0;

    // AI 함대인지 확인: fleets.is_ai가 있으면 우선 반영하고, 없으면 owner user의 is_ai로 판별
    const aiSql = `
      SELECT f.id, u.is_ai AS owner_is_ai, f.is_in_battle
             ${hasFleetIsAi ? ', COALESCE(f.is_ai, false) AS fleet_is_ai' : ', false AS fleet_is_ai'}
      FROM fleets f
      JOIN users u ON LOWER(u.wallet_address) = LOWER(f.owner_wallet)
      WHERE f.id = $1
      FOR UPDATE OF f
    `;
    const { rows: aiCheck } = await client.query(aiSql, [ai_fleet_id]);

    if (!aiCheck[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'AI_FLEET_NOT_FOUND' });
    }
    if (!aiCheck[0].fleet_is_ai && !aiCheck[0].owner_is_ai) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'NOT_AI_FLEET' });
    }
    if (aiCheck[0].is_in_battle) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'AI_IN_BATTLE' });
    }

    const { rows: myFleet } = await client.query(`
      SELECT f.is_in_battle,
             (SELECT COUNT(*) FROM ships s WHERE s.fleet_id = f.id AND s.is_alive) AS alive
      FROM fleets f
      WHERE f.id = $1 AND LOWER(f.owner_wallet) = LOWER($2)
      FOR UPDATE OF f
    `, [my_fleet_id, wallet]);
    if (!myFleet[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'MY_FLEET_NOT_FOUND' });
    }
    if (myFleet[0].is_in_battle) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'MY_FLEET_IN_BATTLE' });
    }
    if (parseInt(myFleet[0].alive) === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'MY_FLEET_EMPTY' });
    }

    const { rows: aiFleet } = await client.query(
      `SELECT owner_wallet FROM fleets WHERE id = $1`, [ai_fleet_id]
    );
    const aiWallet = (aiFleet[0].owner_wallet || '').toLowerCase();

    const { rows: battleRows } = await client.query(`
      INSERT INTO fleet_battles (battle_type, status, phase, prepare_started_at, scheduled_start_at, battle_summary)
      VALUES ('pvp_duel', 'preparing', 'main', NOW(), NOW(), '{"is_ai_battle":true}'::jsonb)
      RETURNING id
    `);
    const battleId = battleRows[0].id;

    await client.query(`
      INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side) VALUES
        ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
    `, [battleId, my_fleet_id, wallet, ai_fleet_id, aiWallet]);

    await client.query('COMMIT');

    // 즉시 실행
    const battleScheduler = require('../services/battleScheduler');
    battleScheduler.runBattle(battleId).catch(err =>
      console.error(`[phaseC] ai/fight battle ${battleId} error:`, err)
    );

    res.json({ success: true, battle_id: battleId });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[phaseC] ai/fight error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════

router.get('/tournaments', async (req, res) => {
  try {
    const status = req.query.status || null;
    const list = await tournament.listTournaments(status);
    res.json({ tournaments: list });
  } catch (err) {
    console.error('[phaseC] tournaments error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/tournaments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    const detail = await tournament.getTournamentDetail(id);
    if (!detail) return res.status(404).json({ error: 'TOURNAMENT_NOT_FOUND' });
    res.json({ tournament: detail });
  } catch (err) {
    console.error('[phaseC] tournament detail error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/tournaments', requireAuth, async (req, res) => {
  try {
    const result = await tournament.createTournament(req.body || {});
    res.json(result);
  } catch (err) {
    if (err.message === 'NAME_REQUIRED') return res.status(400).json({ error: err.message });
    if (err.message === 'INVALID_SIZE') return res.status(400).json({ error: err.message });
    console.error('[phaseC] tournament create error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/tournaments/:id/register', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const id = parseInt(req.params.id);
    const { fleet_id } = req.body || {};
    if (!id || !fleet_id) return res.status(400).json({ error: 'MISSING_PARAMS' });

    const result = await tournament.registerParticipant(id, wallet, fleet_id);
    res.json(result);
  } catch (err) {
    const errorMap = {
      'TOURNAMENT_NOT_FOUND': 404, 'REGISTRATION_CLOSED': 409,
      'TOURNAMENT_FULL': 409, 'DEADLINE_PASSED': 409,
      'ALREADY_REGISTERED': 409, 'FLEET_NOT_FOUND': 404,
      'FLEET_IN_BATTLE': 409, 'FLEET_EMPTY': 409,
      'INSUFFICIENT_GP': 402,
    };
    const status = errorMap[err.message];
    if (status) return res.status(status).json({ error: err.message, meta: err.meta });
    console.error('[phaseC] register error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ═══════════════════════════════════════════════════════════════
// HIJACK ENDPOINTS
// ═══════════════════════════════════════════════════════════════

router.get('/hijack/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const history = await hijack.getMyHijacks(wallet);
    res.json({ hijacks: history });
  } catch (err) {
    console.error('[phaseC] hijack/mine error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.get('/hijack/:id(\\d+)', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    const detail = await hijack.getHijackDetail(id);
    if (!detail) return res.status(404).json({ error: 'HIJACK_NOT_FOUND' });
    res.json({ hijack: detail });
  } catch (err) {
    console.error('[phaseC] hijack detail error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── /api/hijack/declare — [DEPRECATED 410] ──────────────────────
// 과거: 영토 이전 없이 두 함대를 Phase 1/2 로만 충돌시키는 "전투 전용" 경로.
// 현재: 영토 이전이 포함된 정식 하이잭만 지원. 함대 결투는 별도 경로 사용.
//   • 영토 하이잭 (PP 정산 + 픽셀 이전): POST /api/hijack/declare-with-pp
//   • 전투 전용 PvP (AI 상대):           POST /api/ai/fight
//   • 전투 전용 PvP (사람 상대):         토너먼트 브라켓 (POST /api/tournaments/:id/register)
router.post('/hijack/declare', requireAuth, (req, res) => {
  return res.status(410).json({
    error: 'HIJACK_DECLARE_DEPRECATED',
    message: 'Legacy battle-only hijack route. Use /api/hijack/declare-with-pp for territory hijack, or /api/ai/fight / tournament bracket for fleet duels without territory transfer.',
    alternatives: {
      territory_hijack: 'POST /api/hijack/declare-with-pp',
      ai_duel: 'POST /api/ai/fight',
      pvp_tournament: 'POST /api/tournaments/:id/register',
    },
  });
});

router.post('/hijack/:id(\\d+)/phase2', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const hijackId = parseInt(req.params.id);
    const { atk_fleet_id, def_fleet_id } = req.body || {};
    if (!hijackId || !atk_fleet_id || !def_fleet_id) {
      return res.status(400).json({ error: 'MISSING_PARAMS' });
    }

    const result = await hijack.startPhase2(hijackId, wallet, atk_fleet_id, def_fleet_id);
    res.json(result);
  } catch (err) {
    const errorMap = {
      'HIJACK_NOT_FOUND': 404, 'NOT_ATTACKER': 403,
      'NOT_IN_PHASE2': 409, 'PHASE2_ALREADY_STARTED': 409,
    };
    const status = errorMap[err.message];
    if (status) return res.status(status).json({ error: err.message });
    console.error('[phaseC] phase2 error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── GET /api/fleet-battles?wallet= ──
// 프론트의 PVP 탭 dot 표시용 — 진행 중인 함대 전투 요약
router.get('/fleet-battles', async (req, res) => {
  try {
    const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
    if (!wallet || wallet.length < 10) return res.json({ battles: [] });
    let rows = [];
    try {
      const r = await pool.query(
        `SELECT DISTINCT b.id, b.battle_type, b.status, b.phase,
                b.battle_started_at, b.scheduled_start_at,
                p.side
         FROM fleet_battles b
         JOIN fleet_battle_participants p ON p.battle_id = b.id
         WHERE LOWER(p.wallet_address) = $1
           AND b.status IN ('preparing','pending','active','running')
         ORDER BY b.id DESC LIMIT 20`,
        [wallet]
      );
      rows = r.rows;
    } catch (e) {
      // fleet_battles / participants 미배포 환경 fallback
      if (e.code !== '42P01' && e.code !== '42703') throw e;
    }
    res.json({ battles: rows });
  } catch (err) {
    console.error('[phaseC] fleet-battles error:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

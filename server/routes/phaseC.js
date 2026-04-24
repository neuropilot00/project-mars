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
//   GET  /api/hijack/:id             — 하이잭 상세
//   POST /api/hijack/declare         — 하이잭 선언
//   POST /api/hijack/:id/phase2      — Phase 2 시작
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
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { my_fleet_id, ai_fleet_id } = req.body || {};
    if (!my_fleet_id || !ai_fleet_id) {
      return res.status(400).json({ error: 'FLEET_IDS_REQUIRED' });
    }

    // AI 함대인지 확인
    const { rows: aiCheck } = await pool.query(`
      SELECT f.id, u.is_ai, f.is_in_battle
      FROM fleets f JOIN users u ON u.wallet_address = f.owner_wallet
      WHERE f.id = $1
    `, [ai_fleet_id]);

    if (!aiCheck[0]) return res.status(404).json({ error: 'AI_FLEET_NOT_FOUND' });
    if (!aiCheck[0].is_ai) return res.status(400).json({ error: 'NOT_AI_FLEET' });
    if (aiCheck[0].is_in_battle) return res.status(409).json({ error: 'AI_IN_BATTLE' });

    const { rows: myFleet } = await pool.query(`
      SELECT f.is_in_battle, COUNT(s.id) FILTER (WHERE s.is_alive) AS alive
      FROM fleets f LEFT JOIN ships s ON s.fleet_id = f.id
      WHERE f.id = $1 AND f.owner_wallet = $2
      GROUP BY f.is_in_battle
    `, [my_fleet_id, wallet]);
    if (!myFleet[0]) return res.status(404).json({ error: 'MY_FLEET_NOT_FOUND' });
    if (myFleet[0].is_in_battle) return res.status(409).json({ error: 'MY_FLEET_IN_BATTLE' });
    if (parseInt(myFleet[0].alive) === 0) return res.status(409).json({ error: 'MY_FLEET_EMPTY' });

    const { rows: aiFleet } = await pool.query(
      `SELECT owner_wallet FROM fleets WHERE id = $1`, [ai_fleet_id]
    );
    const aiWallet = aiFleet[0].owner_wallet;

    const { rows: battleRows } = await pool.query(`
      INSERT INTO fleet_battles (battle_type, status, phase, prepare_started_at, scheduled_start_at)
      VALUES ('pvp_duel', 'preparing', 'main', NOW(), NOW())
      RETURNING id
    `);
    const battleId = battleRows[0].id;

    await pool.query(`
      INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side) VALUES
        ($1, $2, $3, 'atk'), ($1, $4, $5, 'def')
    `, [battleId, my_fleet_id, wallet, ai_fleet_id, aiWallet]);

    // 즉시 실행
    const battleScheduler = require('../services/battleScheduler');
    battleScheduler.runBattle(battleId).catch(err =>
      console.error(`[phaseC] ai/fight battle ${battleId} error:`, err)
    );

    res.json({ success: true, battle_id: battleId });
  } catch (err) {
    console.error('[phaseC] ai/fight error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
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

router.get('/hijack/:id', async (req, res) => {
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

router.post('/hijack/declare', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const result = await hijack.declareHijack({
      attacker_wallet: wallet,
      ...req.body,
    });
    res.json(result);
  } catch (err) {
    const errorMap = {
      'ATK_FLEET_NOT_FOUND': 404, 'DEF_FLEET_NOT_FOUND': 404,
      'ATK_FLEET_IN_BATTLE': 409, 'DEF_FLEET_IN_BATTLE': 409,
      'NO_PHASE1_SHIPS': 409, 'TOO_MANY_PHASE1_SHIPS': 409,
    };
    const status = errorMap[err.message];
    if (status) return res.status(status).json({ error: err.message, meta: err.meta });
    console.error('[phaseC] hijack declare error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/hijack/:id/phase2', requireAuth, async (req, res) => {
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

module.exports = router;

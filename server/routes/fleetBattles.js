// server/routes/fleetBattles.js
// ═══════════════════════════════════════════════════════════════
// Fleet Battle API Routes
//
// POST   /api/battles/declare-pvp               — 유저간 즉시 전투 선언
// GET    /api/battles/:id                       — 전투 상세 정보
// GET    /api/battles/:id/timeline              — 타임라인 JSON (재생용)
// GET    /api/battles/:id/report                — 전투 결과 리포트 카드
// GET    /api/battles/list/active               — 진행 중 전투 목록
// GET    /api/battles/list/recent               — 최근 종료된 전투
// GET    /api/battles/list/history              — 내 전투 기록
// GET    /api/battles/my-stats/:wallet          — 플레이어 전투 통계
// GET    /api/battles/recommended-opponents/:wallet — 추천 상대 목록
// POST   /api/battles/:id/run                   — 즉시 실행 (관리자/테스트)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const battleEngine = require('../services/battleEngine');
const battleScheduler = require('../services/battleScheduler');
const battleTimeline = require('../services/battleTimeline');
const battleReport = require('../services/battleReport');

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

/**
 * POST /api/battles/declare-pvp
 * PvP 즉시 전투 선언 (테스트 및 PvP duel용)
 * Body: {
 *   my_fleet_id: 123,        // 내가 투입할 함대
 *   target_wallet: '0x...',  // 상대 지갑
 *   target_fleet_id: 456,    // 상대 함대 (직접 지정)
 *   run_immediately: true    // true면 즉시 시뮬레이션
 * }
 */
router.post('/declare-pvp', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { my_fleet_id, target_fleet_id, run_immediately } = req.body || {};
    if (!my_fleet_id || !target_fleet_id) {
      return res.status(400).json({ error: 'FLEET_IDS_REQUIRED' });
    }
    if (my_fleet_id === target_fleet_id) {
      return res.status(400).json({ error: 'CANNOT_ATTACK_SELF' });
    }

    // 내 함대 검증
    const { rows: myFleet } = await pool.query(
      `SELECT f.*, COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
       FROM fleets f LEFT JOIN ships s ON s.fleet_id=f.id
       WHERE f.id = $1 AND LOWER(f.owner_wallet) = LOWER($2)
       GROUP BY f.id`,
      [my_fleet_id, wallet]
    );
    if (!myFleet[0]) return res.status(404).json({ error: 'MY_FLEET_NOT_FOUND' });
    if (myFleet[0].is_in_battle) return res.status(409).json({ error: 'MY_FLEET_IN_BATTLE' });
    if (parseInt(myFleet[0].ships_alive) === 0) {
      return res.status(409).json({ error: 'MY_FLEET_EMPTY' });
    }

    // 상대 함대 검증
    const { rows: targetFleet } = await pool.query(
      `SELECT f.*, COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
       FROM fleets f LEFT JOIN ships s ON s.fleet_id=f.id
       WHERE f.id = $1
       GROUP BY f.id`,
      [target_fleet_id]
    );
    if (!targetFleet[0]) return res.status(404).json({ error: 'TARGET_FLEET_NOT_FOUND' });
    if ((targetFleet[0].owner_wallet || '').toLowerCase() === (wallet || '').toLowerCase()) {
      return res.status(400).json({ error: 'CANNOT_ATTACK_OWN_FLEET' });
    }
    if (targetFleet[0].is_in_battle) return res.status(409).json({ error: 'TARGET_IN_BATTLE' });
    if (parseInt(targetFleet[0].ships_alive) === 0) {
      return res.status(409).json({ error: 'TARGET_EMPTY' });
    }

    // 전투 생성
    const client = await pool.connect();
    let battleId;
    try {
      await client.query('BEGIN');

      const { rows: battleRows } = await client.query(`
        INSERT INTO fleet_battles (
          battle_type, status, phase,
          prepare_started_at, scheduled_start_at
        ) VALUES ('pvp_duel', 'preparing', 'main', NOW(), NOW())
        RETURNING id
      `);
      battleId = battleRows[0].id;

      // participants 추가
      await client.query(`
        INSERT INTO fleet_battle_participants (battle_id, fleet_id, wallet_address, side)
        VALUES
          ($1, $2, $3, 'atk'),
          ($1, $4, $5, 'def')
      `, [battleId, my_fleet_id, wallet, target_fleet_id, targetFleet[0].owner_wallet]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 즉시 실행 옵션
    if (run_immediately) {
      // 비동기로 실행 (응답은 먼저)
      battleScheduler.runBattle(battleId).catch(err => {
        console.error(`[battle] runBattle ${battleId} error:`, err);
      });
    }

    res.json({
      success: true,
      battle_id: battleId,
      status: 'preparing',
      run_immediately: !!run_immediately,
    });
  } catch (err) {
    console.error('[battle] declare-pvp error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/battles/list/active
 * 진행 중인 전투 목록
 */
router.get('/list/active', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, battle_type, status, phase,
             sector_id, claim_id,
             atk_ships_total, def_ships_total,
             battle_started_at, scheduled_start_at,
             (SELECT COUNT(*) FROM fleet_battle_participants WHERE battle_id=fb.id AND side='atk') AS atk_fleets,
             (SELECT COUNT(*) FROM fleet_battle_participants WHERE battle_id=fb.id AND side='def') AS def_fleets
      FROM fleet_battles fb
      WHERE status IN ('preparing','active')
      ORDER BY
        CASE status WHEN 'active' THEN 1 ELSE 2 END,
        battle_started_at DESC NULLS LAST,
        scheduled_start_at ASC
      LIMIT 50
    `);
    res.json({ battles: rows });
  } catch (err) {
    console.error('[battle] active error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/list/recent
 * 최근 종료된 전투 (서버 전체)
 */
router.get('/list/recent', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const { rows } = await pool.query(`
      SELECT id, battle_type, status, winner_side,
             atk_ships_total, def_ships_total,
             atk_ships_lost, def_ships_lost,
             duration_seconds, ended_at
      FROM fleet_battles
      WHERE status = 'ended'
      ORDER BY ended_at DESC NULLS LAST
      LIMIT $1
    `, [limit]);
    res.json({ battles: rows });
  } catch (err) {
    console.error('[battle] recent error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/list/history
 * 내 전투 기록
 */
router.get('/list/history', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const history = await battleTimeline.getUserBattleHistory(wallet, limit);
    res.json({ battles: history });
  } catch (err) {
    console.error('[battle] history error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/active
 * Legacy smoke/API alias for 진행 중 전투 목록.
 * Query: ?wallet=0x... filters to battles where the wallet participates.
 */
router.get('/active', async (req, res) => {
  try {
    const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
    const params = [];
    let participantWhere = '';
    if (wallet) {
      params.push(wallet);
      participantWhere = `AND EXISTS (
        SELECT 1 FROM fleet_battle_participants fp
        WHERE fp.battle_id = fb.id AND LOWER(fp.wallet_address) = LOWER($${params.length})
      )`;
    }

    const { rows } = await pool.query(`
      SELECT fb.id, fb.battle_type, fb.status, fb.phase,
             fb.sector_id, fb.claim_id,
             fb.atk_ships_total, fb.def_ships_total,
             fb.battle_started_at, fb.scheduled_start_at,
             (SELECT COUNT(*) FROM fleet_battle_participants WHERE battle_id=fb.id AND side='atk') AS atk_fleets,
             (SELECT COUNT(*) FROM fleet_battle_participants WHERE battle_id=fb.id AND side='def') AS def_fleets
      FROM fleet_battles fb
      WHERE fb.status IN ('preparing','active')
      ${participantWhere}
      ORDER BY
        CASE fb.status WHEN 'active' THEN 1 ELSE 2 END,
        fb.battle_started_at DESC NULLS LAST,
        fb.scheduled_start_at ASC
      LIMIT 50
    `, params);
    res.json({ battles: rows });
  } catch (err) {
    console.error('[battle] active alias error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/history
 * Legacy smoke/API alias for 내 전투 기록.
 * Query: ?wallet=0x...
 */
router.get('/history', async (req, res) => {
  try {
    const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
    if (!wallet) return res.status(400).json({ error: 'WALLET_REQUIRED' });

    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const history = await battleTimeline.getUserBattleHistory(wallet, limit);
    res.json({ battles: history });
  } catch (err) {
    console.error('[battle] history alias error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/:id
 * 전투 상세 정보 (타임라인 제외)
 */
router.get('/:id', async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    const info = await battleTimeline.getBattleInfo(battleId);
    if (!info) return res.status(404).json({ error: 'BATTLE_NOT_FOUND' });

    // 이벤트 로그 요약 (최근 200개)
    const { rows: events } = await pool.query(`
      SELECT id, event_type, fleet_id, ship_id, payload, tick, created_at
      FROM fleet_battle_events
      WHERE battle_id = $1
      ORDER BY tick ASC, id ASC
      LIMIT 200
    `, [battleId]);

    res.json({
      battle: info,
      events
    });
  } catch (err) {
    console.error('[battle] get error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/:id/timeline
 * 전투 타임라인 JSON (재생용)
 */
router.get('/:id/timeline', async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    const result = await battleTimeline.getTimeline(battleId);
    if (!result) return res.status(404).json({ error: 'TIMELINE_NOT_FOUND' });

    res.json(result);
  } catch (err) {
    console.error('[battle] timeline error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/battles/:id/run
 * 전투 즉시 시작 (관리자/테스트 목적)
 * 대기 중인 전투를 즉시 시뮬레이션
 */
router.post('/:id/run', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    // 참가자인지 확인
    const { rows } = await pool.query(`
      SELECT 1 FROM fleet_battle_participants
      WHERE battle_id = $1 AND LOWER(wallet_address) = LOWER($2)
    `, [battleId, wallet]);
    if (!rows[0]) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

    // 이미 실행 중/완료 체크
    const { rows: bRows } = await pool.query(
      `SELECT status FROM fleet_battles WHERE id = $1`,
      [battleId]
    );
    if (!bRows[0]) return res.status(404).json({ error: 'BATTLE_NOT_FOUND' });
    if (bRows[0].status !== 'preparing') {
      return res.status(409).json({ error: 'NOT_PREPARING', status: bRows[0].status });
    }

    // 즉시 실행 (비동기)
    battleScheduler.runBattle(battleId).catch(err => {
      console.error(`[battle] runBattle ${battleId} manual error:`, err);
    });

    res.json({ success: true, battle_id: battleId, message: '전투 시작됨. 결과는 잠시 후 확인' });
  } catch (err) {
    console.error('[battle] run error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/battles/:id/forfeit
 * 공격자 전투 포기 — preparing 중이면 취소, 이미 끝났으면 그냥 OK 반환.
 * 어떤 경우든 함선 HP는 서버에서 이미 applyBattleResults로 처리됨.
 */
router.post('/:id/forfeit', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    // 참가자 + 사이드 확인 (공격자만 포기 가능)
    const { rows: pRows } = await pool.query(`
      SELECT side FROM fleet_battle_participants
      WHERE battle_id = $1 AND LOWER(wallet_address) = LOWER($2)
    `, [battleId, wallet]);
    if (!pRows[0]) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
    if (pRows[0].side !== 'atk') return res.status(403).json({ error: 'DEFENDER_CANNOT_FORFEIT' });

    const { rows: bRows } = await pool.query(
      `SELECT status FROM fleet_battles WHERE id = $1`, [battleId]
    );
    if (!bRows[0]) return res.status(404).json({ error: 'BATTLE_NOT_FOUND' });

    const status = bRows[0].status;

    if (status === 'preparing') {
      // 아직 시뮬 안 됨 — 즉시 취소 (DEF win, 함선 피해 없음)
      await pool.query(`
        UPDATE fleet_battles
        SET status = 'ended', winner_side = 'def',
            atk_ships_total = 0, def_ships_total = 0
        WHERE id = $1
      `, [battleId]);
      console.log(`[battle] ${battleId} forfeited by atk ${wallet} (was preparing)`);
      try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(wallet, 'battle_forfeit').catch(()=>{}); } catch(_) {}
      return res.json({ success: true, result: 'cancelled', winner_side: 'def' });
    }

    // 이미 ended/in_progress — 결과 그대로 (HP는 이미 적용됨)
    // NOTE: do NOT fire mission notification for already-resolved battles (prevents repeated-call exploit)
    res.json({ success: true, result: 'already_resolved', status });
  } catch (err) {
    console.error('[battle] forfeit error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ═══════════════════════════════════════════════════════════════
/**
 * GET /api/battles/:id/report
 * 전투 결과 리포트 카드 (상세 통계, 하이라이트, 퍼포먼스 레이팅)
 */
router.get('/:id/report', async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase().trim();
    const report = await battleReport.generateBattleReport(battleId, wallet);
    if (!report) return res.status(404).json({ error: 'BATTLE_NOT_FOUND' });

    res.json({ success: true, report });
  } catch (err) {
    console.error('[battle] report error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/:id/highlights
 * 전투 하이라이트 3장면 (리플레이 점프용 tick 반환)
 */
router.get('/:id/highlights', async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    const report = await battleReport.generateBattleReport(battleId, '');
    if (!report) return res.status(404).json({ error: 'BATTLE_NOT_FOUND' });

    const highlights = report.highlights || [];
    res.json({ success: true, highlights });
  } catch (err) {
    console.error('[battle] highlights error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/my-stats/:wallet
 * 플레이어 전투 통계 집계 (승률, KD, 연승, 파벌별 승률)
 */
router.get('/my-stats/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const stats = await battleReport.getPlayerBattleStats(wallet);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[battle] my-stats error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/recommended-opponents/:wallet
 * CPI 기준 추천 상대 목록 (매칭 시스템)
 */
router.get('/recommended-opponents/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase().trim();
    if (!wallet || wallet.length < 5) return res.status(400).json({ error: 'INVALID_WALLET' });

    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const opponents = await battleReport.getRecommendedOpponents(wallet, limit);
    res.json({ success: true, opponents });
  } catch (err) {
    console.error('[battle] recommended-opponents error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

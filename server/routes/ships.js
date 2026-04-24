// server/routes/ships.js
// ═══════════════════════════════════════════════════════════════
// Ship API Routes (신규 함대전 시스템)
//
// GET  /api/ships/blueprints       — 건조 가능 함선 목록
// GET  /api/ships/my               — 내 함선 목록
// GET  /api/ships/summary          — 내 함대 요약
// GET  /api/ships/build-jobs       — 진행 중 건조 작업
// POST /api/ships/build            — 건조 시작
// POST /api/ships/build-jobs/:id/complete — 건조 완료 수령 (수동)
// POST /api/ships/build-jobs/:id/cancel   — 건조 취소
// POST /api/ships/process-completed       — 완료 작업 일괄 처리 (관리자/스케줄러)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const shipService = require('../services/ship');

let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) {}

// ── 인증 미들웨어 (inline JWT — auth.js는 requireAuth를 export하지 않음) ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

// ── 유저 지갑 헬퍼 ──
function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/ships/blueprints
 * 건조 가능 함선 목록
 * Query: ?faction=mcc&size=frigate&includeLocked=1
 */
router.get('/blueprints', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const ships = await shipService.getBlueprints(wallet, {
      factionCode: req.query.faction,
      sizeClass: req.query.size,
      includeLocked: req.query.includeLocked === '1' || req.query.includeLocked === 'true',
    });
    res.json({ ships });
  } catch (err) {
    console.error('[ships] blueprints error:', err);
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/ships/my
 * 내 함선 목록
 * Query: ?fleetId=123&includeDead=1
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const ships = await shipService.getMyShips(wallet, {
      fleetId: req.query.fleetId ? parseInt(req.query.fleetId) : undefined,
      includeDead: req.query.includeDead === '1' || req.query.includeDead === 'true',
    });
    res.json({ ships });
  } catch (err) {
    console.error('[ships] my error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/ships/summary
 * 내 함대 요약 통계
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const summary = await shipService.getFleetSummary(wallet);
    res.json(summary);
  } catch (err) {
    console.error('[ships] summary error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/ships/build-jobs
 * 진행 중인 건조 작업 목록
 */
router.get('/build-jobs', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const jobs = await shipService.getBuildJobs(wallet);
    res.json({ jobs });
  } catch (err) {
    console.error('[ships] build-jobs error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/build
 * 함선 건조 시작
 * Body: { ship_type_code, fleet_id? }
 */
router.post('/build', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { ship_type_code, fleet_id } = req.body;
    if (!ship_type_code) {
      return res.status(400).json({ error: 'SHIP_TYPE_CODE_REQUIRED' });
    }

    const result = await shipService.startBuild(wallet, ship_type_code, fleet_id || null);
    res.json(result);
    // Daily mission: build_ship (fire-and-forget)
    if (dailyService) {
      try { dailyService.updateMissionProgress(wallet, 'build_ship', 1).catch(() => {}); } catch (_de) {}
    }
  } catch (err) {
    // 비즈니스 에러별 응답
    const errorMap = {
      'USER_NOT_FOUND':         404,
      'INVALID_SHIP_TYPE':      400,
      'NO_FACTION':             409,
      'WRONG_FACTION':          409,
      'RANK_REQUIRED':          403,
      'SERVER_LIMIT_REACHED':   409,
      'PLAYER_LIMIT_REACHED':   409,
      'PLAYER_FLEET_FULL':      409,
      'INSUFFICIENT_GP':        402,
      'INSUFFICIENT_MINERALS':  402,
      'FLEET_NOT_FOUND':        404,
    };
    const status = errorMap[err.message];
    if (status) {
      return res.status(status).json({
        error: err.message,
        meta: err.meta || undefined
      });
    }
    console.error('[ships] build error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/build-jobs/:id/complete
 * 완료된 건조 작업 수령 (유저 수동 클릭)
 */
router.post('/build-jobs/:id/complete', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const jobId = parseInt(req.params.id);
    if (!jobId) return res.status(400).json({ error: 'INVALID_JOB_ID' });

    // 소유권 확인
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT wallet_address FROM ship_build_jobs WHERE id = $1`,
      [jobId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
    if (rows[0].wallet_address !== wallet) {
      return res.status(403).json({ error: 'NOT_OWNER' });
    }

    const result = await shipService.completeBuildJob(jobId);
    res.json(result);
  } catch (err) {
    if (err.message === 'JOB_NOT_FOUND')      return res.status(404).json({ error: err.message });
    if (err.message === 'NOT_YET_COMPLETE')   return res.status(409).json({ error: err.message });
    if (err.message?.startsWith('SHIP_'))     return res.status(409).json({ error: err.message });
    console.error('[ships] complete error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/build-jobs/:id/cancel
 * 건조 취소 (일부 환불)
 */
router.post('/build-jobs/:id/cancel', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const jobId = parseInt(req.params.id);
    if (!jobId) return res.status(400).json({ error: 'INVALID_JOB_ID' });

    const result = await shipService.cancelBuildJob(jobId, wallet);
    res.json(result);
  } catch (err) {
    if (err.message === 'JOB_NOT_FOUND')       return res.status(404).json({ error: err.message });
    if (err.message === 'JOB_NOT_CANCELLABLE') return res.status(409).json({ error: err.message });
    console.error('[ships] cancel error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/process-completed
 * 완료된 모든 작업을 일괄 처리 (스케줄러/관리자용)
 */
router.post('/process-completed', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const result = await shipService.processCompletedJobs();
    res.json(result);
  } catch (err) {
    console.error('[ships] process-completed error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/:id/repair
 * 함선 수리
 * Body: { target_hp_pct? }  — 생략 시 100 (풀회복)
 */
router.post('/:id/repair', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const shipId = parseInt(req.params.id);
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });

    const targetHpPct = req.body.target_hp_pct !== undefined
      ? parseInt(req.body.target_hp_pct)
      : 100;

    if (isNaN(targetHpPct) || targetHpPct < 1 || targetHpPct > 100) {
      return res.status(400).json({ error: 'INVALID_TARGET_HP_PCT', meta: { valid_range: '1-100' } });
    }

    const result = await shipService.repairShip(wallet, shipId, targetHpPct);
    res.json(result);
  } catch (err) {
    const errorMap = {
      'SHIP_NOT_FOUND':   404,
      'ALREADY_FULL':     409,
      'USER_NOT_FOUND':   404,
      'INSUFFICIENT_GP':  402,
      'INSUFFICIENT_IRON': 402,
    };
    const status = errorMap[err.message];
    if (status) {
      return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    }
    console.error('[ships] repair error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/:id/shield
 * 함선 실드 충전
 * Body: { units }  — 충전할 실드 HP 양
 */
router.post('/:id/shield', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const shipId = parseInt(req.params.id);
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });

    const units = parseInt(req.body.units);
    if (!units || units <= 0) {
      return res.status(400).json({ error: 'INVALID_UNITS', meta: { hint: 'units must be a positive integer' } });
    }

    const result = await shipService.chargeShield(wallet, shipId, units);
    res.json(result);
  } catch (err) {
    const errorMap = {
      'SHIP_NOT_FOUND':  404,
      'SHIELD_FULL':     409,
      'USER_NOT_FOUND':  404,
      'INSUFFICIENT_GP': 402,
      'INVALID_UNITS':   400,
    };
    const status = errorMap[err.message];
    if (status) {
      return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    }
    console.error('[ships] shield error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

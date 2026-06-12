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
// POST /api/ships/:id/upgrade-stat        — 보유 함선 영구 스탯 강화
// POST /api/ships/process-completed       — 완료 작업 일괄 처리 (관리자/스케줄러)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const shipService = require('../services/ship');
const { pool } = require('../db');

let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) {}

// ── 섹터별 재료 힌트 캐시 (TTL 10분) ──
let _sectorHintsCache = null;
let _sectorHintsCacheAt = 0;
async function getSectorHints() {
  const now = Date.now();
  if (_sectorHintsCache && (now - _sectorHintsCacheAt) < 10 * 60 * 1000) return _sectorHintsCache;
  try {
    const { rows } = await pool.query(`
      SELECT resource_code, sector_type, base_rate
      FROM sector_resource_rates
      WHERE is_active = true
      ORDER BY resource_code, base_rate DESC
    `);
    const hints = {};
    for (const r of rows) {
      if (!hints[r.resource_code]) {
        // first row per resource_code is highest base_rate (ORDER BY base_rate DESC)
        hints[r.resource_code] = r.sector_type;
      }
    }
    _sectorHintsCache = hints;
    _sectorHintsCacheAt = now;
    return hints;
  } catch (_e) {
    return {};
  }
}

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

const optionalAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};

// ── 유저 지갑 헬퍼 ──
// [v7.67] requireAuth 라우트는 반드시 JWT 페이로드에서만 wallet 추출 — query/header 폴백 제거
// (폴백이 있으면 인증된 유저가 타인 계정 GP를 차감 가능)
function getWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
// optionalAuth 라우트용 — JWT가 있을 때만 개인화 정보를 붙임
function getWalletOptional(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// ═══════════════════════════════════════════════════════════════

function shipErrorStatus(code) {
  return {
    USER_NOT_FOUND: 404,
    SHIP_NOT_FOUND: 404,
    LISTING_NOT_FOUND: 404,
    INVALID_STAT: 400,
    INVALID_PRICE: 400,
    INVALID_UNITS: 400,
    MARKET_DISABLED: 409,
    SHIP_IN_BATTLE: 409,
    SHIP_LISTED_FOR_SALE: 409,
    CANNOT_BUY_OWN_LISTING: 409,
    SELLER_NOT_FOUND: 409,
    INSUFFICIENT_GP: 402,
    INSUFFICIENT_MATERIALS: 402,
  }[code];
}

/**
 * GET /api/ships/blueprints
 * 건조 가능 함선 목록
 * Query: ?faction=mcc&size=frigate&includeLocked=1
 */
router.get('/blueprints', optionalAuth, async (req, res) => {
  try {
    const wallet = (getWalletOptional(req) || '').toLowerCase().trim();
    if (!wallet) return res.status(400).json({ error: 'WALLET_REQUIRED' });

    const ships = await shipService.getBlueprints(wallet, {
      factionCode: req.query.faction,
      sizeClass: req.query.size,
      includeLocked: req.query.includeLocked === '1' || req.query.includeLocked === 'true',
    });
    const materialSectorHints = await getSectorHints();
    res.json({ ships, materialSectorHints });
  } catch (err) {
    console.error('[ships] blueprints error:', err);
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/ships/resource-sector-hints
 * 재료 코드별 주요 드롭 섹터 타입 맵
 * { iron_dust: 'frontier', plasma_crystal: 'core', ... }
 */
router.get('/resource-sector-hints', async (req, res) => {
  try {
    const hints = await getSectorHints();
    res.json({ hints });
  } catch (err) {
    console.error('[ships] sector-hints error:', err);
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
 * GET /api/ships/market/listings
 * 강화된 함선 전용 마켓
 */
router.get('/market/listings', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    const listings = await shipService.getShipMarketListings(wallet, {
      faction: req.query.faction,
      size: req.query.size,
      maxPrice: req.query.maxPrice,
      sort: req.query.sort,
    });
    res.json({ listings });
  } catch (err) {
    console.error('[ships] market listings error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// [v7.178 Phase 3] GET /api/ships/market/price-history/:shipTypeCode
// 함선 타입별 최근 30건 sale price — 마켓 카드 sparkline 차트용.
// snapshot 의 quality 별점 변동까지는 표시 안 함(가격 시계열만, 단순화).
// [v7.179 hotfix] pool 은 파일 상단 line 19 에서 이미 import — 재선언하면 SyntaxError.
router.get('/market/price-history/:shipTypeCode', async (req, res) => {
  try {
    const code = String(req.params.shipTypeCode || '').slice(0, 64);
    if (!code) return res.status(400).json({ error: 'INVALID_CODE' });
    const { rows } = await pool.query(
      `SELECT price_gp, created_at, snapshot
         FROM ship_market_sale_log sl
         JOIN ships s ON s.id = sl.ship_id
        WHERE s.ship_type_code = $1
        ORDER BY sl.created_at DESC LIMIT 30`,
      [code]
    );
    res.json({
      code,
      count: rows.length,
      points: rows.reverse().map(r => ({ price: Number(r.price_gp), at: r.created_at }))
    });
  } catch (e) {
    if (e && e.code === '42P01') return res.json({ code: req.params.shipTypeCode, count: 0, points: [], _note: 'log table missing' });
    console.error('[ships] price-history error:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// [v7.178 Phase 3] GET /api/ships/market/stats
// 함선 마켓 활성 listing 카운트 + 거래량 — dashboard chip 용.
router.get('/market/stats', async (_req, res) => {
  try {
    const [activeRows, salesRows] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM ship_market_listings WHERE status='active'`),
      pool.query(`SELECT COUNT(*)::int AS c, COALESCE(SUM(price_gp),0)::numeric AS vol
                    FROM ship_market_sale_log WHERE created_at > NOW() - INTERVAL '7 days'`)
    ]).catch(() => [{ rows:[{c:0}] }, { rows:[{c:0,vol:0}] }]);
    res.json({
      active_listings: activeRows.rows[0]?.c || 0,
      sales_7d: salesRows.rows[0]?.c || 0,
      volume_gp_7d: Number(salesRows.rows[0]?.vol || 0)
    });
  } catch (e) {
    if (e && e.code === '42P01') return res.json({ active_listings: 0, sales_7d: 0, volume_gp_7d: 0 });
    console.error('[ships] market stats error:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/:id/list
 * 보유 함선을 판매 등록
 */
router.post('/:id/list', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    const shipId = parseInt(req.params.id);
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });
    const result = await shipService.listShipForSale(wallet, shipId, req.body.price_gp);
    // Daily OPS mission progress (fire-and-forget)
    if (result.success) {
      try {
        const _dOps = require('./dailyOps');
        _dOps.notifyMissionProgress(wallet, 'market_list').catch(() => {});
        _dOps.notifyMissionProgress(wallet, 'market_activity').catch(() => {});
      } catch (_) {}
    }
    res.json(result);
  } catch (err) {
    const status = shipErrorStatus(err.message);
    if (status) return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    console.error('[ships] list ship error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/market/listings/:id/buy
 */
router.post('/market/listings/:id/buy', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    const listingId = parseInt(req.params.id);
    if (!listingId) return res.status(400).json({ error: 'INVALID_LISTING_ID' });
    const result = await shipService.buyShipListing(wallet, listingId);
    // Daily OPS mission progress (fire-and-forget)
    if (result.success) {
      try {
        const _dOps = require('./dailyOps');
        _dOps.notifyMissionProgress(wallet, 'market_buy').catch(() => {});
        _dOps.notifyMissionProgress(wallet, 'market_activity').catch(() => {});
      } catch (_) {}
    }
    res.json(result);
  } catch (err) {
    const status = shipErrorStatus(err.message);
    if (status) return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    console.error('[ships] buy listing error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/market/listings/:id/cancel
 */
router.post('/market/listings/:id/cancel', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    const listingId = parseInt(req.params.id);
    if (!listingId) return res.status(400).json({ error: 'INVALID_LISTING_ID' });
    const result = await shipService.cancelShipListing(wallet, listingId);
    res.json(result);
  } catch (err) {
    const status = shipErrorStatus(err.message);
    if (status) return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    console.error('[ships] cancel listing error:', err);
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
    // Daily mission: build_ship (fire-and-forget)
    if (result.success || result.job) {
      if (dailyService) {
        try { dailyService.updateMissionProgress(wallet, 'build_ship', 1).catch(() => {}); } catch (_de) {}
      }
      try {
        const _dOps = require('./dailyOps');
        _dOps.notifyMissionProgress(wallet, 'build_ship').catch(() => {});
      } catch (_) {}
    }
    res.json(result);
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
    // [v7.179 hotfix] pool 은 파일 상단에서 이미 import — 중복 선언 제거.
    const { rows } = await pool.query(
      `SELECT wallet_address FROM ship_build_jobs WHERE id = $1 AND LOWER(wallet_address) = LOWER($2)`,
      [jobId, wallet]
    );
    if (!rows[0]) return res.status(404).json({ error: 'JOB_NOT_FOUND' });

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
const requireAdmin = (req, res, next) => {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'FORBIDDEN' });
  next();
};
router.post('/process-completed', requireAdmin, async (req, res) => {
  try {

    const result = await shipService.processCompletedJobs();
    res.json(result);
  } catch (err) {
    console.error('[ships] process-completed error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/ships/:id/upgrade-stat
 * Body: { stat: 'atk' | 'def' | 'hp' | 'speed' }
 */
router.post('/:id/upgrade-stat', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const shipId = parseInt(req.params.id);
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });

    const stat = String(req.body.stat || '').toLowerCase();
    const result = await shipService.upgradeShipStat(wallet, shipId, stat);
    // Daily OPS mission progress (fire-and-forget)
    if (result.success) {
      try {
        const _dOps = require('./dailyOps');
        _dOps.notifyMissionProgress(wallet, 'upgrade_ship').catch(() => {});
        _dOps.notifyMissionProgress(wallet, 'upgrade_ship_3').catch(() => {});
        _dOps.notifyMissionProgress(wallet, 'upgrade_ship_5').catch(() => {});
      } catch (_) {}
    }
    res.json(result);
  } catch (err) {
    const errorMap = {
      'INVALID_STAT':     400,
      'SHIP_NOT_FOUND':   404,
      'SHIP_IN_BATTLE':   409,
      'SHIP_LISTED_FOR_SALE': 409,
      'USER_NOT_FOUND':   404,
      'INSUFFICIENT_GP':  402,
      'INSUFFICIENT_MATERIALS': 402,
    };
    const status = errorMap[err.message];
    if (status) return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    console.error('[ships] upgrade-stat error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/ships/:id/repair-quote
 * 함선 수리 예상 비용
 * Query: target_hp_pct? — 생략 시 100
 */
router.get('/:id/repair-quote', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const shipId = parseInt(req.params.id);
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });

    const targetHpPct = req.query.target_hp_pct !== undefined
      ? parseInt(req.query.target_hp_pct)
      : 100;

    if (isNaN(targetHpPct) || targetHpPct < 1 || targetHpPct > 100) {
      return res.status(400).json({ error: 'INVALID_TARGET_HP_PCT', meta: { valid_range: '1-100' } });
    }

    const quote = await shipService.getRepairQuote(wallet, shipId, targetHpPct);
    res.json({
      success: true,
      current_hp: quote.current_hp,
      max_hp: quote.max_hp,
      target_hp: quote.target_hp,
      healed: quote.healed,
      gp_cost: quote.gp_cost,
      iron_used: quote.iron_used,
      cap_pct: quote.cap_pct,
    });
  } catch (err) {
    const errorMap = {
      'SHIP_NOT_FOUND':   404,
      'ALREADY_FULL':     409,
      'SHIP_LISTED_FOR_SALE': 409,
    };
    const status = errorMap[err.message];
    if (status) return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    console.error('[ships] repair quote error:', err);
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
      'SHIP_LISTED_FOR_SALE': 409,
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
 * POST /api/ships/:id/scrap — 함선 해체 (Migration 173: Core 광물 sink)
 * 환불 %는 setting `ship_scrap_refund_pct`. 나머지는 소각.
 */
router.post('/:id/scrap', requireAuth, async (req, res) => {
  try {
    // [v7.363] req.user.wallet만 읽어 항상 401이던 버그 — 표준 페이로드는 wallet_address. getWallet 사용.
    const wallet = getWallet(req);
    const shipId = parseInt(req.params.id);
    if (!wallet) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!shipId) return res.status(400).json({ error: 'INVALID_SHIP_ID' });
    const result = await shipService.scrapShip(wallet, shipId);
    res.json(result);
  } catch (err) {
    const map = {
      SHIP_NOT_FOUND: 404,
      SHIP_IN_BATTLE: 409,
      SHIP_LISTED_FOR_SALE: 409
    };
    const s = map[err.message];
    if (s) return res.status(s).json({ error: err.message });
    console.error('[ships] scrap error:', err);
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
      'SHIP_LISTED_FOR_SALE': 409,
    };
    const status = errorMap[err.message];
    if (status) {
      return res.status(status).json({ error: err.message, meta: err.meta || undefined });
    }
    console.error('[ships] shield error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// ── 함선 가챠(Ship Crate) ──────────────────────────────────────
// GET  /api/ships/crates           — 상자 목록 + 공개 확률(odds)
// POST /api/ships/crates/:code/open — 상자 개봉(GP 차감 → 함선 획득). JWT 필요.
const shipCrate = require('../services/shipCrate');
router.get('/crates', optionalAuth, async (req, res) => {
  // [v7.168] wallet 전달 시 pity_remaining 포함 — 사용자별 천장 잔여 표시
  try {
    const w = getWalletOptional(req);
    res.json(await shipCrate.listCrates(w || null));
  }
  catch (e) { console.error('[ships] crates list error:', e.message); res.status(500).json({ error: 'SERVER_ERROR' }); }
});
router.post('/crates/:code/open', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    const result = await shipCrate.openCrate(wallet, req.params.code);
    if (result && result.error) {
      const status = result.error === 'INSUFFICIENT_GP' ? 402
        : result.error === 'CRATE_NOT_FOUND' ? 404
        : result.error === 'CRATE_DISABLED' ? 403 : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (e) { console.error('[ships] crate open error:', e.message); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

module.exports = router;

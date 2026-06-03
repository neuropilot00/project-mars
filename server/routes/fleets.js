// server/routes/fleets.js
// ═══════════════════════════════════════════════════════════════
// Fleet API Routes
//
// GET    /api/fleets              — 내 함대 목록
// GET    /api/fleets/options      — 진형/기동 옵션 목록 (UI용)
// GET    /api/fleets/:id          — 함대 상세 (함선 전부)
// POST   /api/fleets              — 새 함대 생성
// PUT    /api/fleets/:id          — 함대 수정 (이름/진형/기동)
// DELETE /api/fleets/:id          — 함대 해체
// POST   /api/fleets/:id/move-ships — 함선들 이 함대로 이동
// POST   /api/fleets/:id/flagship — 기함 지정
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const fleetService = require('../services/fleet');

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

function getWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parsePositiveIntList(values) {
  if (!Array.isArray(values)) return null;
  const parsed = [];
  const seen = new Set();
  for (const value of values) {
    const id = parsePositiveInt(value);
    if (!id) return null;
    if (!seen.has(id)) {
      seen.add(id);
      parsed.push(id);
    }
  }
  return parsed;
}

// ── 에러 매핑 ──
const ERROR_STATUS = {
  'FLEET_NOT_FOUND':         404,
  'SHIP_NOT_FOUND':          404,
  'TARGET_FLEET_NOT_FOUND':  404,
  'INVALID_FORMATION':       400,
  'INVALID_MOVEMENT':        400,
  'NAME_TOO_LONG':           400,
  'NAME_EMPTY':              400,
  'NO_SHIPS_SELECTED':       400,
  'TOO_MANY_SHIPS':          400,
  'FLEET_LIMIT_REACHED':     409,
  'FLEET_IN_BATTLE':         409,
  'TARGET_FLEET_IN_BATTLE':  409,
  'SHIPS_IN_BATTLE':         409,
  'SHIP_LISTED_FOR_SALE':    409,
  'SHIP_NOT_OWNED':          403,
  'SHIP_NOT_IN_FLEET':       409,
  'SHIP_DEAD':               409,
  'SHIP_CANNOT_BE_FLAGSHIP': 409,
  'LAST_FLEET':              409,
  'NO_ALIVE_SHIPS':          409,
};

function handleError(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) {
    return res.status(status).json({
      error: err.message,
      meta: err.meta || undefined
    });
  }
  console.error(`[fleets] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/fleets
 * 내 함대 목록 (카드 뷰용)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleets = await fleetService.listMyFleets(wallet);
    res.json({ fleets });
  } catch (err) {
    handleError(res, err, 'list');
  }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleets = await fleetService.listMyFleets(wallet);
    res.json({ fleets });
  } catch (err) {
    handleError(res, err, 'my');
  }
});

/**
 * GET /api/fleets/options
 * 진형/기동 옵션 목록 (UI 드롭다운용)
 */
router.get('/options', async (req, res) => {
  try {
    res.json({
      formations: fleetService.getFormationOptions(),
      movements: fleetService.getMovementOptions(),
    });
  } catch (err) {
    handleError(res, err, 'options');
  }
});

/**
 * GET /api/fleets/:id
 * 함대 상세 (함선 목록 포함)
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleetId = parsePositiveInt(req.params.id);
    if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

    const fleet = await fleetService.getFleetDetail(fleetId, wallet);
    if (!fleet) return res.status(404).json({ error: 'FLEET_NOT_FOUND' });

    res.json({ fleet });
  } catch (err) {
    handleError(res, err, 'detail');
  }
});

/**
 * POST /api/fleets
 * 새 함대 생성
 * Body: { name?, formation?, movement? }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const result = await fleetService.createFleet(wallet, req.body || {});
    res.json(result);
  } catch (err) {
    handleError(res, err, 'create');
  }
});

/**
 * PUT /api/fleets/:id
 * 함대 수정
 * Body: { name?, formation?, movement? }
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleetId = parsePositiveInt(req.params.id);
    if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

    const result = await fleetService.updateFleet(fleetId, wallet, req.body || {});
    if ((req.body || {}).formation !== undefined) {
      try { const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(wallet, 'fleet_formation').catch(()=>{}); } catch(_) {}
    }
    res.json(result);
  } catch (err) {
    handleError(res, err, 'update');
  }
});

/**
 * DELETE /api/fleets/:id
 * 함대 해체 (함선은 다른 함대로 이동)
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleetId = parsePositiveInt(req.params.id);
    if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

    const result = await fleetService.deleteFleet(fleetId, wallet);
    res.json(result);
  } catch (err) {
    handleError(res, err, 'delete');
  }
});

/**
 * POST /api/fleets/:id/move-ships
 * 함선들을 이 함대로 이동
 * Body: { ship_ids: [1, 2, 3] }
 */
router.post('/:id/move-ships', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleetId = parsePositiveInt(req.params.id);
    if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

    const { ship_ids } = req.body || {};
    const shipIds = parsePositiveIntList(ship_ids);
    if (!shipIds) {
      return res.status(400).json({ error: 'SHIP_IDS_REQUIRED' });
    }

    const result = await fleetService.moveShips(wallet, shipIds, fleetId);
    res.json(result);
  } catch (err) {
    handleError(res, err, 'move-ships');
  }
});

/**
 * POST /api/fleets/:id/flagship
 * 기함 지정
 * Body: { ship_id: 123 }
 */
router.post('/:id/flagship', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const fleetId = parsePositiveInt(req.params.id);
    if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

    const { ship_id } = req.body || {};
    const shipId = parsePositiveInt(ship_id);
    if (!shipId) return res.status(400).json({ error: 'SHIP_ID_REQUIRED' });

    const result = await fleetService.setFlagship(wallet, fleetId, shipId);
    res.json(result);
  } catch (err) {
    handleError(res, err, 'flagship');
  }
});

// ── 함대 리버리(강조색) 설정 — GP 싱크 코스메틱 (v7.377) ──
router.post('/:id/livery', requireAuth, async (req, res) => {
  const { pool, getSetting } = require('../db');
  const wallet = getWallet(req);
  if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
  const fleetId = parsePositiveInt(req.params.id);
  if (!fleetId) return res.status(400).json({ error: 'INVALID_FLEET_ID' });

  // 빈 값 = 리버리 해제(무료). 색 지정 = 팔레트 검증 + GP 소각.
  let color = (req.body && typeof req.body.color === 'string') ? req.body.color.trim() : '';
  const clearing = !color;
  let palette = [];
  try { palette = JSON.parse(await getSetting('fleet_livery_palette', '[]')) || []; } catch (_) { palette = []; }
  if (!clearing && !palette.includes(color)) {
    return res.status(400).json({ error: 'INVALID_COLOR', allowed: palette });
  }
  const costGp = clearing ? 0 : (parseInt(await getSetting('fleet_livery_cost_gp', '200')) || 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 소유권 확인 + 잠금 (지갑 대소문자 무시)
    const fr = await client.query(
      `SELECT id, accent_color FROM fleets WHERE id = $1 AND LOWER(owner_wallet) = LOWER($2) FOR UPDATE`,
      [fleetId, wallet]
    );
    if (!fr.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'FLEET_NOT_FOUND' }); }
    // 같은 색 재설정엔 과금 안 함
    const same = !clearing && String(fr.rows[0].accent_color || '') === color;
    if (costGp > 0 && !same) {
      const ded = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
        [costGp, wallet]
      );
      if (ded.rowCount !== 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'INSUFFICIENT_GP', cost: costGp }); }
    }
    await client.query(`UPDATE fleets SET accent_color = $1, updated_at = NOW() WHERE id = $2`,
      [clearing ? null : color, fleetId]);
    await client.query('COMMIT');
    // GP 소각 로그 (fire-and-forget)
    if (costGp > 0 && !same) {
      try { require('../db').logGPActivity(wallet, -costGp, 'fleet_livery', '함대 리버리 변경').catch(() => {}); } catch (_) {}
    }
    res.json({ success: true, accent_color: clearing ? null : color, charged: (costGp > 0 && !same) ? costGp : 0 });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    handleError(res, err, 'livery');
  } finally {
    client.release();
  }
});

module.exports = router;

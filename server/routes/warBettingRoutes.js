// server/routes/warBettingRoutes.js
// ═══════════════════════════════════════════════════════════════
// War Betting API Routes
//
// GET  /api/betting/events         — 활성 베팅 이벤트 목록
// GET  /api/betting/events/recent  — 최근 종료된 이벤트
// GET  /api/betting/events/:id     — 이벤트 상세 + 오즈
// POST /api/betting/bet            — 베팅 하기
// GET  /api/betting/mine           — 내 베팅 기록
// POST /api/betting/events         — 이벤트 생성 (Admin)
// POST /api/betting/resolve/:id    — 결과 확정 (Admin)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const bettingService = require('../services/warBetting');

// ── 인증 (inline JWT) ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

// Admin 체크 — x-admin-secret 헤더 사용 (프로젝트 표준 패턴)
function isAdmin(req) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  return s && s === process.env.ADMIN_SECRET;
}

const ERROR_STATUS = {
  'EVENT_NOT_FOUND':      404,
  'INVALID_EVENT_TYPE':   400,
  'OPTIONS_REQUIRED':     400,
  'CLOSES_AT_REQUIRED':   400,
  'INVALID_OPTION':       400,
  'EVENT_ALREADY_EXISTS': 409,
  'BETTING_CLOSED':       409,
  'ALREADY_BET':          409,
  'ALREADY_RESOLVED':     409,
  'USER_NOT_FOUND':       404,
  'BET_TOO_SMALL':        400,
  'BET_TOO_LARGE':        400,
  'INSUFFICIENT_GP':      402,
};

function handleErr(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) return res.status(status).json({ error: err.message, meta: err.meta });
  console.error(`[warBetting] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/betting/events
 * 활성 베팅 이벤트 목록 (실시간 오즈 포함)
 */
router.get('/events', async (req, res) => {
  try {
    const events = await bettingService.listActiveEvents();
    res.json({ events });
  } catch (err) { handleErr(res, err, 'list'); }
});

/**
 * GET /api/betting/events/recent
 * 최근 종료된 이벤트
 */
router.get('/events/recent', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const events = await bettingService.listRecentEvents(limit);
    res.json({ events });
  } catch (err) { handleErr(res, err, 'recent'); }
});

/**
 * GET /api/betting/events/:id
 * 이벤트 상세 + 오즈
 */
router.get('/events/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    const event = await bettingService.getEventWithOdds(id);
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });

    res.json({ event });
  } catch (err) { handleErr(res, err, 'detail'); }
});

/**
 * POST /api/betting/bet
 * 베팅하기
 * Body: { event_id, option: 'a'|'b'|'c', amount_gp }
 */
router.post('/bet', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { event_id, option, amount_gp } = req.body || {};
    if (!event_id) return res.status(400).json({ error: 'EVENT_ID_REQUIRED' });
    if (!option) return res.status(400).json({ error: 'OPTION_REQUIRED' });
    if (!amount_gp || isNaN(parseInt(amount_gp))) {
      return res.status(400).json({ error: 'AMOUNT_REQUIRED' });
    }

    const result = await bettingService.placeBet(
      wallet, parseInt(event_id), option, parseInt(amount_gp)
    );
    res.json(result);
  } catch (err) { handleErr(res, err, 'bet'); }
});

/**
 * GET /api/betting/mine
 * 내 베팅 기록
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const limit = Math.min(50, parseInt(req.query.limit) || 30);
    const bets = await bettingService.getMyBets(wallet, limit);
    res.json({ bets });
  } catch (err) { handleErr(res, err, 'mine'); }
});

/**
 * POST /api/betting/events  (Admin 전용)
 * 베팅 이벤트 생성
 */
router.post('/events', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });

    const result = await bettingService.createEvent(req.body || {});
    res.json(result);
  } catch (err) { handleErr(res, err, 'create'); }
});

/**
 * POST /api/betting/resolve/:id  (Admin 전용)
 * 이벤트 결과 확정 + 보상 분배
 * Body: { winner_option: 'a'|'b'|'c' }
 */
router.post('/resolve/:id', requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });

    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });

    const { winner_option } = req.body || {};
    if (!winner_option) return res.status(400).json({ error: 'WINNER_OPTION_REQUIRED' });

    const result = await bettingService.resolveEvent(id, winner_option);
    res.json(result);
  } catch (err) { handleErr(res, err, 'resolve'); }
});

module.exports = router;

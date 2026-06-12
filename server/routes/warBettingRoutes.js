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
 * GET /api/betting/events/:id/odds  (legacy compat)
 * 베팅 오즈만 반환 — betting.js 통합으로 추가 (frontend 기존 호출 유지용)
 */
router.get('/events/:id/odds', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const event = await bettingService.getEventWithOdds(id);
    if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND' });
    res.json(event);
  } catch (err) { handleErr(res, err, 'odds'); }
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
 * 내 베팅 기록 — JWT 지갑 기준 (legacy wallet query 무시)
 */
router.get('/mine', async (req, res) => {
  try {
    // Require JWT — unauthenticated wallet fallback was a data-privacy leak
    // (anyone could query any player's bet history without auth)
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
    let wallet = null;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      wallet = decoded.wallet_address || decoded.wallet || decoded.walletAddress;
    } catch (_) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
    if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'NO_WALLET' });

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

// ═══════════════════════════════════════════════════════════════
// Legacy admin endpoints (이전 betting.js 통합) — x-admin-secret 헤더 사용
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/betting/admin/events — 전체 이벤트 목록 (admin)
 */
router.get('/admin/events', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });
  try {
    const { pool } = require('../db');
    const status = req.query.status || null;
    const q = status
      ? 'SELECT * FROM war_bet_events WHERE status = $1 ORDER BY opens_at DESC LIMIT 100'
      : 'SELECT * FROM war_bet_events ORDER BY opens_at DESC LIMIT 100';
    const result = await pool.query(q, status ? [status] : []);
    res.json({ events: result.rows });
  } catch (err) { handleErr(res, err, 'admin-list'); }
});

/**
 * POST /api/betting/admin/events/:id/settle — 강제 정산
 * Body: { winnerOption: 'a' | 'b' | 'c' }
 */
router.post('/admin/events/:id/settle', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const { winnerOption, winner_option } = req.body || {};
    const winner = winner_option || winnerOption;
    if (!winner) return res.status(400).json({ error: 'WINNER_OPTION_REQUIRED' });
    const result = await bettingService.resolveEvent(id, winner);
    res.json(result);
  } catch (err) { handleErr(res, err, 'admin-settle'); }
});

/**
 * POST /api/betting/admin/events/:id/cancel — 이벤트 취소 (베팅 환불)
 */
router.post('/admin/events/:id/cancel', async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'ADMIN_ONLY' });
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'INVALID_ID' });
    const result = await bettingService.cancelEvent ? await bettingService.cancelEvent(id) : null;
    if (!result) {
      // Fallback: direct DB cancel + refund
      const { pool } = require('../db');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const evt = await client.query(`SELECT id, status FROM war_bet_events WHERE id=$1 FOR UPDATE`, [id]);
        if (!evt.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'EVENT_NOT_FOUND' }); }
        if (['resolved','cancelled'].includes(evt.rows[0].status)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'ALREADY_RESOLVED' });
        }
        const bets = await client.query(`SELECT bettor_wallet, amount_gp FROM war_bets WHERE event_id=$1 FOR UPDATE`, [id]);
        for (const b of bets.rows) {
          await client.query(`UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`, [b.bettor_wallet, b.amount_gp]);
        }
        await client.query(`UPDATE war_bet_events SET status='cancelled', resolved_at=NOW() WHERE id=$1`, [id]);
        await client.query('COMMIT');
        return res.json({ success: true, refunded: bets.rows.length });
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch(_) {}
        throw e;
      } finally { client.release(); }
    }
    res.json(result);
  } catch (err) { handleErr(res, err, 'admin-cancel'); }
});

module.exports = router;

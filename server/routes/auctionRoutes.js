// server/routes/auctionRoutes.js
// ═══════════════════════════════════════════════════════════════
// 옥션 API (Migration 090)
//
// GET  /api/auctions               — 경매 목록
// GET  /api/auctions/my            — 내 경매/입찰
// GET  /api/auctions/:id           — 경매 상세
// POST /api/auctions               — 경매 생성
// POST /api/auctions/:id/bid       — 입찰
// POST /api/auctions/:id/buyout    — 즉시 구매
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const auction = require('../services/auctionCombat');

// ── 인증 (inline JWT fallback) ──
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  try {
    const mod = require('../routes/auth');
    if (mod?.requireAuth) return mod.requireAuth(req, res, next);
  } catch { }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  // [v7.62] toLowerCase/trim 추가
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

const ERROR_STATUS = {
  AUCTION_NOT_FOUND: 404,
  CANNOT_BID_OWN: 400, CANNOT_BUY_OWN: 400,
  INVALID_START_PRICE: 400, INVALID_CURRENCY: 400,
  INVALID_DURATION: 400, NO_BUYOUT_PRICE: 400,
  AUCTION_EXPIRED: 409, MAX_AUCTIONS_REACHED: 409,
  SHIP_NOT_AVAILABLE: 409,
  INSUFFICIENT_BALANCE: 402,
  INVALID_BUNDLE_CURRENCY: 400, BUNDLE_SAME_CURRENCY: 400,
  INVALID_BUNDLE_AMOUNT: 400, CURRENCY_AUCTION_DISABLED: 409,
};

function handleErr(res, err, ctx) {
  const msg = err.message?.split(':')[0];
  const status = ERROR_STATUS[msg] || 500;
  if (status === 500) console.error(`[auction] ${ctx}:`, err);
  res.status(status).json({ error: err.message });
}

// ═══════════════════════════════════════════════════════════════

/** GET /api/auctions?listing_type=&currency=&page= */
router.get('/', async (req, res) => {
  try {
    const list = await auction.getAuctions({
      listing_type: req.query.listing_type || null,
      currency:     req.query.currency     || null,
      page:         parseInt(req.query.page) || 1,
    });
    res.json({ auctions: list });
  } catch (err) { handleErr(res, err, 'list'); }
});

/** GET /api/auctions/my */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const data = await auction.getMyAuctions(getWallet(req));
    res.json(data);
  } catch (err) { handleErr(res, err, 'my'); }
});

/** GET /api/auctions/:id */
router.get('/:id', async (req, res) => {
  try {
    const detail = await auction.getAuctionDetail(parseInt(req.params.id));
    if (!detail) return res.status(404).json({ error: 'AUCTION_NOT_FOUND' });
    res.json(detail);
  } catch (err) { handleErr(res, err, 'detail'); }
});

/** POST /api/auctions — 경매 생성 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const result = await auction.createAuction(getWallet(req), req.body || {});
    res.json(result);
  } catch (err) { handleErr(res, err, 'create'); }
});

/** POST /api/auctions/:id/bid — 입찰 */
router.post('/:id/bid', requireAuth, async (req, res) => {
  try {
    const { amount } = req.body || {};
    if (!amount) return res.status(400).json({ error: 'AMOUNT_REQUIRED' });
    const result = await auction.placeBid(
      getWallet(req), parseInt(req.params.id), parseFloat(amount)
    );
    res.json(result);
  } catch (err) { handleErr(res, err, 'bid'); }
});

/** POST /api/auctions/:id/buyout — 즉시 구매 */
router.post('/:id/buyout', requireAuth, async (req, res) => {
  try {
    const result = await auction.buyout(getWallet(req), parseInt(req.params.id));
    res.json(result);
  } catch (err) { handleErr(res, err, 'buyout'); }
});

module.exports = router;

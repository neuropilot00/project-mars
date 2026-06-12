/**
 * routes/auction.js
 * Auction System API (BIBLE Migration 090)
 *
 * POST /api/auction/create          → 옥션 등록
 * GET  /api/auctions                → 목록 (filters: type, status, limit, offset)
 * GET  /api/auction/:id             → 상세 + 입찰 내역
 * POST /api/auction/:id/bid         → 입찰 { wallet, amount }
 * POST /api/auction/:id/buyout      → 즉구 { wallet }
 * POST /api/auction/:id/cancel      → 취소 { wallet }
 * GET  /api/user/auctions           → 내 옥션 목록
 * POST /api/admin/auction/:id/settle → 어드민 강제 정산
 */

'use strict';

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const auctionService = require('../services/auction');

// ✅ [v7.44] JWT 인증 미들웨어 — wallet body 신뢰 없음
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'forbidden' }); return false; }
  return true;
}

// ── POST /api/auction/create ──
router.post('/auction/create', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const result = await auctionService.createAuction(wallet, req.body);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[AUCTION] create error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/auctions ──
router.get('/auctions', async (req, res) => {
  try {
    const auctions = await auctionService.getAuctions({
      itemType: req.query.type || null,
      status:   req.query.status || 'active',
      limit:    Math.min(parseInt(req.query.limit ?? '30'), 100),
      offset:   parseInt(req.query.offset ?? '0')
    });
    res.json({ auctions });
  } catch (err) {
    console.error('[AUCTION] list error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/auction/:id ──
router.get('/auction/:id', async (req, res) => {
  try {
    const auction = await auctionService.getAuction(req.params.id);
    if (!auction) return res.status(404).json({ error: 'not_found' });
    res.json(auction);
  } catch (err) {
    console.error('[AUCTION] detail error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/auction/:id/bid ──
router.post('/auction/:id/bid', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  const amount = parseInt(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'invalid_amount' });
  try {
    const result = await auctionService.placeBid(wallet, req.params.id, amount);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[AUCTION] bid error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/auction/:id/buyout ──
router.post('/auction/:id/buyout', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const result = await auctionService.buyout(wallet, req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[AUCTION] buyout error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/auction/:id/cancel ──
router.post('/auction/:id/cancel', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const result = await auctionService.cancelAuction(wallet, req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[AUCTION] cancel error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/user/auctions ──
router.get('/user/auctions', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(401).json({ error: 'wallet_required' });
  try {
    const auctions = await auctionService.getUserAuctions(wallet);
    res.json({ auctions });
  } catch (err) {
    console.error('[AUCTION] user auctions error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── ADMIN: POST /api/admin/auction/:id/settle ──
router.post('/admin/auction/:id/settle', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await auctionService.settleAuction(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[AUCTION] admin settle error:', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

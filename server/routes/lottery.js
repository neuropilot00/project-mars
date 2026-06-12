'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const { pool }  = require('../db');
const router    = express.Router();

let lotteryService;
try { lotteryService = require('../services/lottery'); } catch (_e) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 60,  message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 100 : 15,  message: { error: 'Too many requests' } });

// ✅ [v7.44] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/lottery/current — current open round + user ticket count
router.get('/lottery/current', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || req.headers['x-wallet'] || '').toLowerCase();
  try {
    if (!lotteryService) return res.status(503).json({ error: 'Lottery service unavailable' });
    const round = await lotteryService.getCurrentRound(wallet);
    res.json({ round });
  } catch (e) {
    console.error('[LOTTERY] current error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/lottery/buy — buy tickets { wallet, count }
router.post('/lottery/buy', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  const { count } = req.body;
  if (!w) return res.status(400).json({ error: 'wallet required' });
  if (!lotteryService) return res.status(503).json({ error: 'Lottery service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await lotteryService.buyTickets(client, w, count || 1);
    await client.query('COMMIT');
    res.json({ success: true, ...result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[LOTTERY] buy error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/lottery/history — recent completed rounds
router.get('/lottery/history', readLimiter, async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  try {
    if (!lotteryService) return res.status(503).json({ error: 'Lottery service unavailable' });
    const history = await lotteryService.getHistory(limit);
    res.json({ history });
  } catch (e) {
    console.error('[LOTTERY] history error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/lottery/my-tickets — user's own tickets
router.get('/lottery/my-tickets', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    if (!lotteryService) return res.status(503).json({ error: 'Lottery service unavailable' });
    const tickets = await lotteryService.getMyTickets(wallet);
    res.json({ tickets });
  } catch (e) {
    console.error('[LOTTERY] my-tickets error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;

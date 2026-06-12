'use strict';
const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const wagerSvc = require('../services/wager');

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/wager/pools
router.get('/wager/pools', async (req, res) => {
  try { res.json(await wagerSvc.getOpenPools()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/wager/pools/:id/bets
router.get('/wager/pools/:id/bets', async (req, res) => {
  try { res.json(await wagerSvc.getPoolBets(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/wager/my
router.get('/wager/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await wagerSvc.getMyBets(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/wager/bet  { poolId, targetWallet, gpAmount }
router.post('/wager/bet', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { poolId, targetWallet, gpAmount } = req.body || {};
    if (!wallet || !poolId || !targetWallet || !gpAmount) {
      return res.status(400).json({ error: 'wallet, poolId, targetWallet, gpAmount required' });
    }
    const result = await wagerSvc.placeBet(wallet, parseInt(poolId), targetWallet, parseInt(gpAmount));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

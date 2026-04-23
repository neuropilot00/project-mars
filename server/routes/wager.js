'use strict';
const express = require('express');
const router = express.Router();
const wagerSvc = require('../services/wager');

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

// GET /api/wager/my?wallet=
router.get('/wager/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await wagerSvc.getMyBets(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/wager/bet  { wallet, poolId, targetWallet, gpAmount }
router.post('/wager/bet', async (req, res) => {
  try {
    const { wallet, poolId, targetWallet, gpAmount } = req.body || {};
    if (!wallet || !poolId || !targetWallet || !gpAmount) {
      return res.status(400).json({ error: 'wallet, poolId, targetWallet, gpAmount required' });
    }
    const result = await wagerSvc.placeBet(wallet, parseInt(poolId), targetWallet, parseInt(gpAmount));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

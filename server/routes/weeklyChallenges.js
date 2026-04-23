'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_e) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 60,  message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 100 : 20,  message: { error: 'Too many requests' } });

// GET /api/weekly/challenges — list this week's challenges + user progress
router.get('/weekly/challenges', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  try {
    if (!weeklySvc) return res.status(503).json({ error: 'Weekly challenge service unavailable' });
    const data = await weeklySvc.getChallenges(wallet || null);
    res.json(data);
  } catch (e) {
    console.error('[WEEKLY] challenges error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/weekly/claim — claim reward for a completed challenge { wallet, instanceId }
router.post('/weekly/claim', writeLimiter, async (req, res) => {
  const { wallet, instanceId } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !instanceId) return res.status(400).json({ error: 'wallet and instanceId required' });
  if (!weeklySvc) return res.status(503).json({ error: 'Weekly challenge service unavailable' });

  try {
    const result = await weeklySvc.claimReward(w, parseInt(instanceId));
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[WEEKLY] claim error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;

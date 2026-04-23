'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/prestige');

router.get('/prestige/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/prestige/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getPrestige(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/prestige/leaderboard', async (req, res) => {
  try { res.json(await svc.getLeaderboard()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/prestige/buy', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.buyPrestige(wallet)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

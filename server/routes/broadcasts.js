'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/broadcasts');

// GET /api/broadcasts/active
router.get('/broadcasts/active', async (req, res) => {
  try { res.json(await svc.getActiveBroadcasts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/broadcasts/my?wallet=
router.get('/broadcasts/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyBroadcasts(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/broadcasts/costs
router.get('/broadcasts/costs', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/broadcasts/create  { wallet, message, durationH }
router.post('/broadcasts/create', async (req, res) => {
  const { wallet, message, durationH } = req.body || {};
  if (!wallet || !message) return res.status(400).json({ error: 'wallet and message required' });
  try { res.json(await svc.createBroadcast(wallet, message, durationH || 1)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

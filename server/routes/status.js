'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/status');

router.get('/status/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/status/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyStatus(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/status/active', async (req, res) => {
  try { res.json(await svc.getActiveStatuses()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/status/set', async (req, res) => {
  const { wallet, status, durationH } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.setStatus(wallet, status, durationH)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.post('/status/clear', async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.clearStatus(wallet)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

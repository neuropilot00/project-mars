'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/vtag'); } catch(_) {}

// GET /api/vtag/config
router.get('/vtag/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vtag/get?wallet=
router.get('/vtag/get', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getTag(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vtag/set  { wallet, tag }
router.post('/vtag/set', async (req, res) => {
  const { wallet, tag } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.setTag(wallet, tag)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/vtag/clear  { wallet }
router.post('/vtag/clear', async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.clearTag(wallet)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

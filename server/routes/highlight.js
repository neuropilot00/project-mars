'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/highlight'); } catch(_) {}

// GET /api/highlight/config
router.get('/highlight/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/highlight/active  — all active highlights (for map rendering)
router.get('/highlight/active', async (req, res) => {
  try { res.json(await svc.getActiveHighlights()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/highlight/claim/:claimId
router.get('/highlight/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getClaimHighlight(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/highlight/set  { wallet, claimId, color }
router.post('/highlight/set', async (req, res) => {
  const { wallet, claimId, color } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.setHighlight(wallet, claimId, color)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

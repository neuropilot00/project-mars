'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/graffiti'); } catch(_) {}

// GET /api/graffiti/config
router.get('/graffiti/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/graffiti/claim/:claimId
router.get('/graffiti/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getActiveGraffiti(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/graffiti/place  { wallet, claimId, text }
router.post('/graffiti/place', async (req, res) => {
  const { wallet, claimId, text } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  if (!text) return res.status(400).json({ error: 'text required' });
  try { res.json(await svc.placeGraffiti(wallet.toLowerCase().trim(), claimId, text)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/tdesc'); } catch(_) {}

// GET /api/tdesc/config
router.get('/tdesc/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tdesc/claim/:claimId  — public
router.get('/tdesc/claim/:claimId', async (req, res) => {
  try {
    const claimId = parseInt(req.params.claimId, 10);
    if (isNaN(claimId)) return res.status(400).json({ error: 'Invalid claimId' });
    const description = await svc.getDescription(claimId);
    res.json({ description });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tdesc/my?wallet=
router.get('/tdesc/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyDescriptions(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tdesc/set  { wallet, claimId, text }
router.post('/tdesc/set', async (req, res) => {
  const { wallet, claimId, text } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try {
    const result = await svc.setDescription(wallet, parseInt(claimId, 10), text || '');
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

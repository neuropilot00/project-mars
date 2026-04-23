'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/sponsor'); } catch(_) {}

// GET /api/sponsor/config
router.get('/sponsor/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sponsor/claim/:claimId  — active sponsors for a territory
router.get('/sponsor/claim/:claimId', async (req, res) => {
  try {
    const claimId = parseInt(req.params.claimId, 10);
    if (isNaN(claimId)) return res.status(400).json({ error: 'Invalid claimId' });
    const sponsors = await svc.getActiveSponsors(claimId);
    res.json({ sponsors });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sponsor/my?wallet=
router.get('/sponsor/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMySponsorships(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sponsor/place  { wallet, claimId, message }
router.post('/sponsor/place', async (req, res) => {
  const { wallet, claimId, message } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try {
    const result = await svc.placeSponsor(wallet, parseInt(claimId, 10), message || '');
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

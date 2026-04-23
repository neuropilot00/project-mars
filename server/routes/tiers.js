'use strict';
const express = require('express');
const router = express.Router();
const tiersSvc = require('../services/tiers');

// GET /api/tiers/config
router.get('/tiers/config', async (req, res) => {
  try {
    const cfg = await tiersSvc.getCfg();
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tiers/claim/:claimId
router.get('/tiers/claim/:claimId', async (req, res) => {
  try {
    const tier = await tiersSvc.getTier(parseInt(req.params.claimId));
    res.json(tier || { tier: 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tiers/my?wallet=
router.get('/tiers/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const tiers = await tiersSvc.getMyTiers(wallet);
    res.json(tiers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tiers/upgrade { wallet, claimId }
router.post('/tiers/upgrade', async (req, res) => {
  try {
    const { wallet, claimId } = req.body || {};
    if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
    const result = await tiersSvc.upgradeTier(wallet, parseInt(claimId));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

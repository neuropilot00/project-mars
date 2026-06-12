'use strict';
const express   = require('express');
const jwt       = require('jsonwebtoken');
const router    = express.Router();
const tiersSvc  = require('../services/tiers');

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

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

// GET /api/tiers/my
router.get('/tiers/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const tiers = await tiersSvc.getMyTiers(wallet);
    res.json(tiers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tiers/upgrade { claimId }
router.post('/tiers/upgrade', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { claimId } = req.body || {};
    if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
    const result = await tiersSvc.upgradeTier(wallet, parseInt(claimId));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/tdesc'); } catch(_) {}

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

// GET /api/tdesc/my
router.get('/tdesc/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyDescriptions(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tdesc/set  { claimId, text }
router.post('/tdesc/set', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, text } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try {
    const result = await svc.setDescription(wallet, parseInt(claimId, 10), text || '');
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

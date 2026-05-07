'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/highlight'); } catch(_) {}

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

// POST /api/highlight/set  { claimId, color }
router.post('/highlight/set', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, color } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.setHighlight(wallet, claimId, color)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

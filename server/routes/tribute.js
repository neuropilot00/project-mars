'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/tribute'); } catch(_) {}

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

// GET /api/tribute/config
router.get('/tribute/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tribute/claim/:claimId  — recent tributes for a territory
router.get('/tribute/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getClaimTributes(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tribute/my
router.get('/tribute/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyTributes(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tribute/send  { claimId, amountGP, message }
router.post('/tribute/send', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, amountGP, message } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  if (!amountGP) return res.status(400).json({ error: 'amountGP required' });
  try { res.json(await svc.sendTribute(wallet, claimId, amountGP, message)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

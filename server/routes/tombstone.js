'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/tombstone'); } catch(_) {}

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

router.get('/tombstone/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/tombstone/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getTombstones(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tombstone/place', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, epitaph } = req.body || {};
  if (!wallet)  return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.placeTombstone(wallet, claimId, epitaph)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/status');

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

router.get('/status/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/status/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyStatus(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/status/active', async (req, res) => {
  try { res.json(await svc.getActiveStatuses()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/status/set  { status, durationH }
router.post('/status/set', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { status, durationH } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.setStatus(wallet, status, durationH)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/status/clear
router.post('/status/clear', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.clearStatus(wallet)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/broadcasts');

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

// GET /api/broadcasts/active
router.get('/broadcasts/active', async (req, res) => {
  try { res.json(await svc.getActiveBroadcasts()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/broadcasts/my
router.get('/broadcasts/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyBroadcasts(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/broadcasts/costs
router.get('/broadcasts/costs', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/broadcasts/create  { message, durationH }
router.post('/broadcasts/create', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { message, durationH } = req.body || {};
  if (!wallet || !message) return res.status(400).json({ error: 'wallet and message required' });
  try { res.json(await svc.createBroadcast(wallet, message, durationH || 1)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/announcement'); } catch(_) {}

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

router.get('/announce/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/announce/active', async (req, res) => {
  try { res.json(await svc.getActiveAnnouncements()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/announce/post  { message, durationM }
router.post('/announce/post', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { message, durationM } = req.body || {};
  if (!wallet)  return res.status(400).json({ error: 'wallet required' });
  if (!message) return res.status(400).json({ error: 'message required' });
  try { res.json(await svc.postAnnouncement(wallet, message, durationM)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

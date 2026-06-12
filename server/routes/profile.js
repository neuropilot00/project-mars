'use strict';
const express = require('express');
const router = express.Router();
const profileSvc = require('../services/profile');
const jwt = require('jsonwebtoken');

// ✅ [v7.47] JWT 인증 미들웨어 — fallback 제거
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const profile = await profileSvc.getProfile(wallet);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/costs
router.get('/profile/costs', async (req, res) => {
  try {
    const cfg = await profileSvc.getCfg();
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/history?field=
router.get('/profile/history', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { field } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const history = await profileSvc.getHistory(wallet, field || null);
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/profile/nickname  { nickname }
router.post('/profile/nickname', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { nickname } = req.body || {};
    if (!wallet || !nickname) return res.status(400).json({ error: 'wallet and nickname required' });
    const result = await profileSvc.setNickname(wallet, nickname);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/profile/avatar-color  { color }
router.post('/profile/avatar-color', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { color } = req.body || {};
    if (!wallet || !color) return res.status(400).json({ error: 'wallet and color required' });
    const result = await profileSvc.setAvatarColor(wallet, color);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/profile/motto  { motto }
router.post('/profile/motto', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { motto } = req.body || {};
    if (!wallet || !motto) return res.status(400).json({ error: 'wallet and motto required' });
    const result = await profileSvc.setMotto(wallet, motto);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

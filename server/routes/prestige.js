'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/prestige');
const jwt     = require('jsonwebtoken');

// JWT 인증 미들웨어 — wallet은 req.body에서 받지 않고 토큰에서 추출
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

router.get('/prestige/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/prestige/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getPrestige(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/prestige/leaderboard', async (req, res) => {
  try { res.json(await svc.getLeaderboard()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/prestige/buy', requireAuth, async (req, res) => {
  // wallet은 검증된 JWT에서 추출 — body.wallet을 신뢰하지 않음
  // [v7.61] toLowerCase/trim 추가
  const wallet = (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
  if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
  try { res.json(await svc.buyPrestige(wallet)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

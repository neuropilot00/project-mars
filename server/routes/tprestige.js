'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/tprestige'); } catch(_) {}
const jwt     = require('jsonwebtoken');

// JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

router.get('/tprestige/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/tprestige/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getPrestige(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tprestige/upgrade', requireAuth, async (req, res) => {
  const { claimId } = req.body || {};
  // wallet은 검증된 JWT에서 추출 — body.wallet을 신뢰하지 않음
  const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
  if (!wallet)  return res.status(401).json({ error: 'NO_WALLET' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.upgradePrestige(wallet.toLowerCase().trim(), claimId)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

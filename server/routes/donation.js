'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/donation');

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

router.get('/donation/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/donation/wall', async (req, res) => {
  try { res.json(await svc.getWall()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/donation/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyDonations(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/donation/donate  { amount, message }
router.post('/donation/donate', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { amount, message } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.donate(wallet, amount, message)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

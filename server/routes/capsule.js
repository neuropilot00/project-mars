'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/capsule'); } catch(_) {}

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

// GET /api/capsule/config
router.get('/capsule/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/revealed  — public feed of revealed capsules
router.get('/capsule/revealed', async (req, res) => {
  try { res.json(await svc.getRevealed()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/upcoming  — count + next reveal time (no messages)
router.get('/capsule/upcoming', async (req, res) => {
  try { res.json(await svc.getUpcoming()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/my  — player's own capsules
router.get('/capsule/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyCapsules(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/capsule/bury  { message, revealInDays }
router.post('/capsule/bury', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { message, revealInDays } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    const result = await svc.buryCapsule(wallet, message || '', revealInDays || 7);
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

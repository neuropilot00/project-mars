'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
let svc; try { svc = require('../services/milestone'); } catch(_) {}

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

router.get('/milestone/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/milestone/feed', async (req, res) => {
  try { res.json(await svc.getFeed(req.query.limit, req.query.category)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/milestone/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyMilestones(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/milestone/record  { category, title, description }
router.post('/milestone/record', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { category, title, description } = req.body || {};
  if (!wallet)      return res.status(400).json({ error: 'wallet required' });
  if (!title)       return res.status(400).json({ error: 'title required' });
  if (!description) return res.status(400).json({ error: 'description required' });
  try { res.json(await svc.recordMilestone(wallet, category, title, description)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

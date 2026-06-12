'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/polls');

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
function getOptionalAuthWallet(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return '';
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return (user?.wallet_address || user?.wallet || user?.walletAddress || '').toLowerCase().trim();
  } catch (_) {
    return '';
  }
}

router.get('/polls/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/polls', async (req, res) => {
  const wallet = getOptionalAuthWallet(req) || null;
  try { res.json(await svc.getActivePolls(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/polls/:id/results', async (req, res) => {
  try { res.json(await svc.getPollResults(Number(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/polls/create  { question, options, durationH }
router.post('/polls/create', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { question, options, durationH } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.createPoll(wallet, { question, options, durationH })); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/polls/vote  { pollId, optionIdx }
router.post('/polls/vote', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { pollId, optionIdx } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.vote(wallet, Number(pollId), Number(optionIdx))); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

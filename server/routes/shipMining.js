'use strict';
// 함선 채굴 런 라우트 (경제 v2 P5)
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const mining = require('../services/shipMining');

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// GET /api/mining/info
router.get('/mining/info', async (req, res) => {
  try { res.json(await mining.getMiningInfo()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mining/my?wallet=
router.get('/mining/my', async (req, res) => {
  const wallet = (req.query.wallet || '').toString();
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await mining.getMyMining(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/mining/launch — { fleetId, durationH }
router.post('/mining/launch', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { fleetId, durationH } = req.body || {};
  try { res.json(await mining.launchMining(wallet, parseInt(fleetId, 10), durationH)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/mining/collect — { jobId }
router.post('/mining/collect', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { jobId } = req.body || {};
  try { res.json(await mining.collectMining(wallet, parseInt(jobId, 10))); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

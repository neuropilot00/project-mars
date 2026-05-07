'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const svc     = require('../services/tournaments');

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

// GET /api/tournaments — open + running
router.get('/tournaments', async (req, res) => {
  try { res.json(await svc.getTournaments()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tournaments/my?wallet=  — must be BEFORE /:id to avoid shadow match
router.get('/tournaments/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyTournaments(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tournaments/:id — detail + entries
router.get('/tournaments/:id', async (req, res) => {
  try {
    const t = await svc.getTournament(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tournaments/join  { tournamentId }
router.post('/tournaments/join', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { tournamentId } = req.body || {};
  if (!wallet || !tournamentId) return res.status(400).json({ error: 'wallet and tournamentId required' });
  try { res.json(await svc.joinTournament(wallet, tournamentId)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

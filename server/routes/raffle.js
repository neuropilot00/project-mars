'use strict';
const express    = require('express');
const jwt        = require('jsonwebtoken');
const router     = express.Router();
const raffleSvc  = require('../services/raffle');

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

// GET /api/raffles — open raffles
router.get('/raffles', async (req, res) => {
  try { res.json(await raffleSvc.getOpenRaffles()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/my?wallet=  — must be BEFORE /:id to avoid shadow match
router.get('/raffles/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await raffleSvc.getMyEntries(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/:id  (id 숫자만 허용)
router.get('/raffles/:id(\\d+)', async (req, res) => {
  try {
    const rf = await raffleSvc.getRaffle(parseInt(req.params.id));
    if (!rf) return res.status(404).json({ error: 'Not found' });
    res.json(rf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/:id/entrants  (id 숫자만)
router.get('/raffles/:id(\\d+)/entrants', async (req, res) => {
  try { res.json(await raffleSvc.getEntrants(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffles/buy  { raffleId, count }
router.post('/raffles/buy', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { raffleId, count } = req.body || {};
    if (!wallet || !raffleId) return res.status(400).json({ error: 'wallet and raffleId required' });
    const result = await raffleSvc.buyTickets(wallet, parseInt(raffleId), parseInt(count)||1);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

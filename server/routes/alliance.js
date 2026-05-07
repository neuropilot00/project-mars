'use strict';
const express     = require('express');
const jwt         = require('jsonwebtoken');
const router      = express.Router();
const allianceSvc = require('../services/alliance');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

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

// GET /api/alliances?search=
router.get('/alliances', async (req, res) => {
  try { res.json(await allianceSvc.getAlliances(req.query.search || null)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/my?wallet=
router.get('/alliances/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await allianceSvc.getMyAlliance(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/settings
router.get('/alliances/settings', async (req, res) => {
  try { res.json(await allianceSvc.getSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/:id/log
router.get('/alliances/:id/log', async (req, res) => {
  try {
    res.json(await allianceSvc.getAllianceLog(
      parseInt(req.params.id, 10), parseInt(req.query.limit || '30', 10)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alliances/create — { name, tag, description, emblem }
router.post('/alliances/create', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { name, tag, description, emblem } = req.body || {};
  if (!wallet || !name || !tag) return res.status(400).json({ error: 'wallet, name, tag required' });
  try {
    const alliance = await allianceSvc.createAlliance(wallet, name, tag, description, emblem);
    const cost = (await allianceSvc.getSettings()).createCost;
    if (logGPActivity) logGPActivity(wallet, -cost, 'alliance_create', `Created alliance [${tag}]`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, cost).catch(() => {});
    res.json(alliance);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/join — { allianceId }
router.post('/alliances/join', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { allianceId } = req.body || {};
  if (!wallet || !allianceId) return res.status(400).json({ error: 'wallet and allianceId required' });
  try {
    res.json(await allianceSvc.joinAlliance(wallet, parseInt(allianceId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/leave
router.post('/alliances/leave', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    res.json(await allianceSvc.leaveAlliance(wallet));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/deposit — { amount }
router.post('/alliances/deposit', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { amount } = req.body || {};
  if (!wallet || !amount) return res.status(400).json({ error: 'wallet and amount required' });
  try {
    const result = await allianceSvc.depositTreasury(wallet, parseFloat(amount));
    if (logGPActivity) logGPActivity(wallet, -parseFloat(amount), 'alliance_treasury', 'Treasury deposit').catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, parseFloat(amount)).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', parseFloat(amount)).catch(() => {});
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/withdraw — { amount, note }
router.post('/alliances/withdraw', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { amount, note } = req.body || {};
  if (!wallet || !amount) return res.status(400).json({ error: 'wallet and amount required' });
  try {
    res.json(await allianceSvc.withdrawTreasury(wallet, parseFloat(amount), note));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

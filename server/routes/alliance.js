'use strict';
const express     = require('express');
const jwt         = require('jsonwebtoken');
const router      = express.Router();
const allianceSvc = require('../services/alliance');
let getSetting; try { ({ getSetting } = require('../db')); } catch (_) {}

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
  // [v7.61] getAlliances → listAlliances (correct service export name)
  try { res.json(await allianceSvc.listAlliances()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/my
router.get('/alliances/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await allianceSvc.getMyAlliance(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/settings
router.get('/alliances/settings', async (req, res) => {
  // [v7.61] getSettings not in service — read from DB settings directly
  try {
    const createCost = parseInt(await getSetting?.('alliance_creation_fee_gp', '5000') || '5000', 10);
    res.json({ createCost });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/alliances/:id/log
router.get('/alliances/:id/log', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit, 10) || 30;
    if (!id) return res.status(400).json({ error: 'alliance id required' });
    res.json(await allianceSvc.getAllianceLog(id, limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alliances/create — { name, tag, description, emblem }
router.post('/alliances/create', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { name, tag, description, faction_code } = req.body || {};
  if (!wallet || !name || !tag) return res.status(400).json({ error: 'wallet, name, tag required' });
  try {
    const alliance = await allianceSvc.createAlliance(wallet, { name, tag, description, faction_code });
    // [v7.61] getSettings replaced with direct getSetting call
    const cost = parseInt(await getSetting?.('alliance_creation_fee_gp', '5000') || '5000', 10);
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
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    const result = await allianceSvc.depositTreasury(wallet, amount);
    if (logGPActivity) {
      logGPActivity(wallet, -result.amount_gp, 'alliance_deposit', 'Alliance treasury deposit').catch(() => {});
    }
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message, meta: e.meta }); }
});

// POST /api/alliances/withdraw — { amount, note }
// [v7.61] withdrawTreasury not implemented in service yet
router.post('/alliances/withdraw', requireAuth, async (req, res) => {
  res.status(501).json({ error: 'TREASURY_NOT_IMPLEMENTED' });
});

module.exports = router;

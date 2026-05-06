'use strict';
const express     = require('express');
const router      = express.Router();
const allianceSvc = require('../services/alliance');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

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

// POST /api/alliances/create — { wallet, name, tag, description, emblem }
router.post('/alliances/create', async (req, res) => {
  const { wallet, name, tag, description, emblem } = req.body || {};
  if (!wallet || !name || !tag) return res.status(400).json({ error: 'wallet, name, tag required' });
  try {
    const alliance = await allianceSvc.createAlliance(wallet, name, tag, description, emblem);
    const cost = (await allianceSvc.getSettings()).createCost;
    if (logGPActivity) logGPActivity(wallet.toLowerCase(), -cost, 'alliance_create', `Created alliance [${tag}]`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet.toLowerCase(), cost).catch(() => {});
    res.json(alliance);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/join — { wallet, allianceId }
router.post('/alliances/join', async (req, res) => {
  const { wallet, allianceId } = req.body || {};
  if (!wallet || !allianceId) return res.status(400).json({ error: 'wallet and allianceId required' });
  try {
    res.json(await allianceSvc.joinAlliance(wallet, parseInt(allianceId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/leave — { wallet }
router.post('/alliances/leave', async (req, res) => {
  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    res.json(await allianceSvc.leaveAlliance(wallet));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/deposit — { wallet, amount }
router.post('/alliances/deposit', async (req, res) => {
  const { wallet, amount } = req.body || {};
  if (!wallet || !amount) return res.status(400).json({ error: 'wallet and amount required' });
  try {
    const result = await allianceSvc.depositTreasury(wallet, parseFloat(amount));
    if (logGPActivity) logGPActivity(wallet.toLowerCase(), -parseFloat(amount), 'alliance_treasury', 'Treasury deposit').catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet.toLowerCase(), parseFloat(amount)).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_burn', parseFloat(amount)).catch(() => {});
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/alliances/withdraw — { wallet, amount, note }
router.post('/alliances/withdraw', async (req, res) => {
  const { wallet, amount, note } = req.body || {};
  if (!wallet || !amount) return res.status(400).json({ error: 'wallet and amount required' });
  try {
    res.json(await allianceSvc.withdrawTreasury(wallet, parseFloat(amount), note));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

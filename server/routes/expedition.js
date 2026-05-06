'use strict';
const express  = require('express');
const router   = express.Router();
const expSvc   = require('../services/expedition');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

// GET /api/expeditions/info — available types, durations, costs
router.get('/expeditions/info', async (req, res) => {
  try { res.json(await expSvc.getExpeditionInfo()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/expeditions/my?wallet= — player's expedition history
router.get('/expeditions/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await expSvc.getMyExpeditions(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/expeditions/launch — { wallet, claimId, expeditionType, durationH }
router.post('/expeditions/launch', async (req, res) => {
  const { wallet, claimId, expeditionType, durationH } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try {
    const result = await expSvc.launchExpedition(wallet, parseInt(claimId, 10), expeditionType || 'salvage', durationH || 1);

    if (logGPActivity) {
      logGPActivity(wallet.toLowerCase(), -result.gpSpent, 'expedition',
        `Launched ${result.icon} ${result.label} (${result.durationH}h)`).catch(() => {});
    }
    if (seasonService && seasonService.trackGPSpend) {
      seasonService.trackGPSpend(wallet.toLowerCase(), result.gpSpent).catch(() => {});
    }
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_burn', result.gpSpent).catch(() => {});
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/expeditions/cancel — { wallet, expeditionId }
router.post('/expeditions/cancel', async (req, res) => {
  const { wallet, expeditionId } = req.body || {};
  if (!wallet || !expeditionId) return res.status(400).json({ error: 'wallet and expeditionId required' });
  try {
    res.json(await expSvc.cancelExpedition(wallet, parseInt(expeditionId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

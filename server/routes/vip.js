'use strict';
const express  = require('express');
const router   = express.Router();
const vipSvc   = require('../services/vip');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

// GET /api/vip/tiers — list all active VIP tiers
router.get('/vip/tiers', async (req, res) => {
  try { res.json(await vipSvc.getTiers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/vip/my?wallet= — get player's active VIP pass
router.get('/vip/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await vipSvc.getMyPass(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/vip/purchase — { wallet, tierId }
router.post('/vip/purchase', async (req, res) => {
  const { wallet, tierId } = req.body || {};
  if (!wallet || !tierId) return res.status(400).json({ error: 'wallet and tierId required' });
  try {
    const result = await vipSvc.purchasePass(wallet, parseInt(tierId, 10));

    // Side effects
    if (logGPActivity) {
      logGPActivity(wallet.toLowerCase(), -result.gpSpent, 'vip_pass',
        `${result.action} VIP ${result.tierName} ${result.badge}`).catch(() => {});
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

module.exports = router;

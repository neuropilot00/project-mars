'use strict';
const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const expSvc   = require('../services/expedition');

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

// POST /api/expeditions/launch — { claimId, expeditionType, durationH }
router.post('/expeditions/launch', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, expeditionType, durationH } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try {
    const result = await expSvc.launchExpedition(wallet, parseInt(claimId, 10), expeditionType || 'salvage', durationH || 1);

    if (logGPActivity) {
      logGPActivity(wallet, -result.gpSpent, 'expedition',
        `Launched ${result.icon} ${result.label} (${result.durationH}h)`).catch(() => {});
    }
    if (seasonService && seasonService.trackGPSpend) {
      seasonService.trackGPSpend(wallet, result.gpSpent).catch(() => {});
    }
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet, 'gp_burn', result.gpSpent).catch(() => {});
    }

    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/expeditions/cancel — { expeditionId }
router.post('/expeditions/cancel', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { expeditionId } = req.body || {};
  if (!wallet || !expeditionId) return res.status(400).json({ error: 'wallet and expeditionId required' });
  try {
    res.json(await expSvc.cancelExpedition(wallet, parseInt(expeditionId, 10)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

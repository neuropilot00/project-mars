'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const { pool }  = require('../db');
const router    = express.Router();

let burnService;
try { burnService = require('../services/gpBurn'); } catch (_e) {}
let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 60,  message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 100 : 20,  message: { error: 'Too many requests' } });

// GET /api/burn/catalog — available burn types + active effects for wallet
router.get('/burn/catalog', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  try {
    if (!burnService) return res.status(503).json({ error: 'Burn service unavailable' });
    const catalog = await burnService.getBurnCatalog(wallet || null);
    res.json(catalog);
  } catch (e) {
    console.error('[BURN] catalog error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/burn/burn — execute a burn { wallet, burnType }
router.post('/burn/burn', writeLimiter, async (req, res) => {
  const { wallet, burnType } = req.body;
  const w = (wallet || '').toLowerCase();
  if (!w || !burnType) return res.status(400).json({ error: 'wallet and burnType required' });
  if (!burnService) return res.status(503).json({ error: 'Burn service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await burnService.burnGP(client, w, burnType);
    await client.query('COMMIT');

    // Fire-and-forget
    if (logGPActivity) {
      logGPActivity(w, -result.cost, 'gp_burn', `Burned ${result.cost} GP for ${result.name} (${result.hours}h)`).catch(() => {});
    }
    if (seasonService) {
      seasonService.addSeasonScore(w, 'gp_spend', Math.round(result.cost)).catch(() => {});
    }
    if (weeklySvc) {
      weeklySvc.trackProgress(w, 'burn_gp', Math.round(result.cost)).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[BURN] burn error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/burn/active — active burn effects for a wallet
router.get('/burn/active', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    if (!burnService) return res.status(503).json({ error: 'Burn service unavailable' });
    const effects = await burnService.getActiveEffects(wallet);
    res.json({ effects });
  } catch (e) {
    console.error('[BURN] active error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;

'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { pool } = require('../db');
const craftingSvc = require('../services/crafting');

// Try to load optional services for GP logging / season tracking
let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
try { weeklySvc     = require('../services/weeklyChallenge'); } catch (_) {}

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

// ── GET /api/crafting/recipes ─────────────────────────────────────────────────
// Query: ?category=general&wallet=0x...
router.get('/crafting/recipes', async (req, res) => {
  try {
    const { category, wallet } = req.query;
    const recipes = await craftingSvc.getRecipes(category, wallet);
    res.json(recipes);
  } catch (err) {
    console.error('[Crafting] GET /recipes:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/crafting/recipe/:id ──────────────────────────────────────────────
router.get('/crafting/recipe/:id', async (req, res) => {
  try {
    const recipe = await craftingSvc.getRecipe(
      parseInt(req.params.id, 10), req.query.wallet || null
    );
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    console.error('[Crafting] GET /recipe/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/crafting/log ─────────────────────────────────────────────────────
router.get('/crafting/log', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { limit } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const log = await craftingSvc.getMyCraftingLog(wallet, parseInt(limit || '30', 10));
    res.json(log);
  } catch (err) {
    console.error('[Crafting] GET /log:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/crafting/item-types ──────────────────────────────────────────────
router.get('/crafting/item-types', async (req, res) => {
  try {
    const types = await craftingSvc.getItemTypes();
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/crafting/craft ──────────────────────────────────────────────────
// Body: { recipeId }
router.post('/crafting/craft', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { recipeId } = req.body || {};
  if (!wallet || !recipeId) {
    return res.status(400).json({ error: 'wallet and recipeId required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await craftingSvc.craftItem(client, wallet, parseInt(recipeId, 10));
    await client.query('COMMIT');

    // Daily OPS mission progress (fire-and-forget)
    try {
      const _dOps = require('./dailyOps');
      _dOps.notifyMissionProgress(wallet, 'craft_resource').catch(() => {});
      _dOps.notifyMissionProgress(wallet, 'craft_resource_3').catch(() => {});
      _dOps.notifyMissionProgress(wallet, 'craft_resource_5').catch(() => {});
    } catch (_) {}

    // Side effects (fire-and-forget)
    const gpBurned = result.gpCost - result.gpRefunded;
    if (gpBurned > 0) {
      if (logGPActivity) {
        logGPActivity(wallet, -gpBurned, 'crafting_cost',
          `Crafted: ${result.recipeName}`).catch(() => {});
      }
      if (seasonService && seasonService.trackGPSpend) {
        seasonService.trackGPSpend(wallet, gpBurned).catch(() => {});
      }
      if (weeklySvc && weeklySvc.trackProgress) {
        weeklySvc.trackProgress(wallet, 'gp_burn', gpBurned).catch(() => {});
      }
    }

    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Crafting] POST /craft:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

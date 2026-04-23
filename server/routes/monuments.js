'use strict';
/**
 * Territory Monument Routes — Migration 111
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db');

let monumentSvc;
try { monumentSvc = require('../services/monuments'); } catch (_) {}

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_) {}
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_) {}

// ── GET /api/monuments/claim/:claimId ─────────────────────────────────────────
router.get('/monuments/claim/:claimId', async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const monument = await monumentSvc.getMonument(parseInt(req.params.claimId));
    res.json({ monument: monument || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/monuments/my-monuments?wallet= ───────────────────────────────────
router.get('/monuments/my-monuments', async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const monuments = await monumentSvc.getMyMonuments(wallet);
    res.json({ monuments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/monuments/recent?limit= ─────────────────────────────────────────
router.get('/monuments/recent', async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const monuments = await monumentSvc.getRecentMonuments(limit);
    res.json({ monuments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/monuments/types ──────────────────────────────────────────────────
router.get('/monuments/types', async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const types = await monumentSvc.getMonumentTypes();
    res.json({ types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/monuments/cost?claimId= ─────────────────────────────────────────
router.get('/monuments/cost', async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const { claimId } = req.query;
    if (!claimId) return res.status(400).json({ error: 'claimId required' });
    const cost = await monumentSvc.calculateCost(parseInt(claimId));
    res.json({ cost });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/monuments/place ─────────────────────────────────────────────────
router.post('/monuments/place', async (req, res) => {
  if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
  const { wallet, claimId, monumentType, name, message } = req.body;
  if (!wallet || !claimId || !monumentType || !name) {
    return res.status(400).json({ error: 'wallet, claimId, monumentType, name required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { monument, cost } = await monumentSvc.placeMonument(
      client, wallet, parseInt(claimId), monumentType, name, message
    );
    await client.query('COMMIT');

    // Side effects (fire-and-forget)
    const w = wallet.toLowerCase();
    if (logGPActivity) logGPActivity(w, -cost, 'monument_place', { monumentId: monument.id, name }).catch(() => {});
    if (seasonService?.trackGPSpend) seasonService.trackGPSpend(w, cost).catch(() => {});
    if (weeklySvc?.trackProgress) weeklySvc.trackProgress(w, 'gp_burn', cost).catch(() => {});

    res.json({ ok: true, monument, cost });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/monuments/preserve ─────────────────────────────────────────────
router.post('/monuments/preserve', async (req, res) => {
  if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
  const { wallet, monumentId } = req.body;
  if (!wallet || !monumentId) return res.status(400).json({ error: 'wallet, monumentId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { cost, monument } = await monumentSvc.preserveMonument(client, wallet, parseInt(monumentId));
    await client.query('COMMIT');

    const w = wallet.toLowerCase();
    if (logGPActivity) logGPActivity(w, -cost, 'monument_preserve', { monumentId: monument.id }).catch(() => {});
    if (seasonService?.trackGPSpend) seasonService.trackGPSpend(w, cost).catch(() => {});

    res.json({ ok: true, cost, monument });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

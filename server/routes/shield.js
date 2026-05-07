'use strict';
/**
 * Territory Shield Routes — Migration 114
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { pool } = require('../db');

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

let shieldSvc;
try { shieldSvc = require('../services/shield'); } catch (_) {}

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_) {}

// ── GET /api/shield/catalog ───────────────────────────────────────────────────
router.get('/shield/catalog', async (req, res) => {
  try {
    if (!shieldSvc) return res.status(503).json({ error: 'Service unavailable' });
    const catalog = await shieldSvc.getShieldCatalog();
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shield/my-shields?wallet= ───────────────────────────────────────
router.get('/shield/my-shields', async (req, res) => {
  try {
    if (!shieldSvc) return res.status(503).json({ error: 'Service unavailable' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const shields = await shieldSvc.getMyShields(wallet);
    res.json({ shields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/shield/claim/:claimId ───────────────────────────────────────────
router.get('/shield/claim/:claimId', async (req, res) => {
  try {
    if (!shieldSvc) return res.status(503).json({ error: 'Service unavailable' });
    const shield = await shieldSvc.getClaimShield(parseInt(req.params.claimId));
    res.json({ shield: shield || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/shield/activate ─────────────────────────────────────────────────
router.post('/shield/activate', requireAuth, async (req, res) => {
  if (!shieldSvc) return res.status(503).json({ error: 'Service unavailable' });
  const wallet = getAuthWallet(req);
  const { claimId, durationH } = req.body;
  if (!wallet || !claimId || !durationH) {
    return res.status(400).json({ error: 'wallet, claimId, durationH required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await shieldSvc.activateShield(
      client, wallet, parseInt(claimId), parseInt(durationH)
    );
    await client.query('COMMIT');

    const w = wallet.toLowerCase();
    if (logGPActivity) logGPActivity(w, -result.cost, 'shield_activate', {
      claimId, durationH, expiresAt: result.expiresAt
    }).catch(() => {});
    if (seasonService?.trackGPSpend) seasonService.trackGPSpend(w, result.cost).catch(() => {});
    if (weeklySvc?.trackProgress) weeklySvc.trackProgress(w, 'gp_burn', result.cost).catch(() => {});

    res.json({ ok: true, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

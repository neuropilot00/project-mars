'use strict';
/**
 * Territory Upgrade Routes — Migration 112
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { pool } = require('../db');
const rateLimit = require('express-rate-limit');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

let upgradeSvc;
try { upgradeSvc = require('../services/claimUpgrades'); } catch (_) {}

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_) {}

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

// ── GET /api/upgrades/catalog ─────────────────────────────────────────────────
router.get('/upgrades/catalog', async (req, res) => {
  try {
    if (!upgradeSvc) return res.status(503).json({ error: 'Service unavailable' });
    const catalog = await upgradeSvc.getUpgradeCatalog();
    res.json({ catalog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/upgrades/claim/:claimId ─────────────────────────────────────────
router.get('/upgrades/claim/:claimId', async (req, res) => {
  try {
    if (!upgradeSvc) return res.status(503).json({ error: 'Service unavailable' });
    const upgrades = await upgradeSvc.getClaimUpgrades(parseInt(req.params.claimId));
    res.json({ upgrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/upgrades/my-upgrades ────────────────────────────────────────────
router.get('/upgrades/my-upgrades', requireAuth, async (req, res) => {
  try {
    if (!upgradeSvc) return res.status(503).json({ error: 'Service unavailable' });
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const upgrades = await upgradeSvc.getMyUpgrades(wallet);
    res.json({ upgrades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/upgrades/upgrade ────────────────────────────────────────────────
router.post('/upgrades/upgrade', requireAuth, writeLimiter, async (req, res) => {
  if (!upgradeSvc) return res.status(503).json({ error: 'Service unavailable' });
  const wallet = getAuthWallet(req);
  const { claimId, upgradeType } = req.body || {};
  if (!wallet || !claimId || !upgradeType) {
    return res.status(400).json({ error: 'wallet, claimId, upgradeType required' });
  }
  const claimIdInt = parseInt(claimId, 10);
  if (!Number.isInteger(claimIdInt) || claimIdInt <= 0) {
    return res.status(400).json({ error: 'INVALID_CLAIM_ID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await upgradeSvc.upgradeTerritory(
      client, wallet, claimIdInt, upgradeType
    );
    await client.query('COMMIT');

    // Side effects (fire-and-forget)
    if (logGPActivity) logGPActivity(wallet, -result.cost, 'territory_upgrade', {
      claimId, upgradeType, level: result.level
    }).catch(() => {});
    if (seasonService?.trackGPSpend) seasonService.trackGPSpend(wallet, result.cost).catch(() => {});
    if (weeklySvc?.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', result.cost).catch(() => {});

    res.json({ ok: true, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

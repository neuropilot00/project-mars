'use strict';
/**
 * Territory Monument Routes — Migration 111
 */

const express = require('express');
const jwt     = require('jsonwebtoken');
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

// ── GET /api/monuments/my-monuments ──────────────────────────────────────────
router.get('/monuments/my-monuments', requireAuth, async (req, res) => {
  try {
    if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
    const wallet = getAuthWallet(req);
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
router.post('/monuments/place', requireAuth, async (req, res) => {
  if (!monumentSvc) return res.status(503).json({ error: 'Service unavailable' });
  const wallet = getAuthWallet(req);
  const { claimId, monumentType, name, message } = req.body || {};
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
    if (logGPActivity) logGPActivity(wallet, -cost, 'monument_place', { monumentId: monument.id, name }).catch(() => {});
    if (seasonService?.trackGPSpend) seasonService.trackGPSpend(wallet, cost).catch(() => {});
    if (weeklySvc?.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', cost).catch(() => {});

    res.json({ ok: true, monument, cost });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/monuments/preserve ─────────────────────────────────────────────
// [v7.192 deprecated] POST /api/monuments/preserve — 프론트 호출 0건. 1주 410 모니터링 후 제거.
//   기존 로직은 git history 에 남아 있어 필요 시 복구 가능.
router.post('/monuments/preserve', requireAuth, async (req, res) => {
  console.warn('[deprecated] /api/monuments/preserve called', getAuthWallet(req), req.headers['user-agent']);
  return res.status(410).json({ error: 'GONE', message: 'Endpoint deprecated.' });
});

module.exports = router;

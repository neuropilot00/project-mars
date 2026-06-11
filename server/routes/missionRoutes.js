const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let missionService;
try { missionService = require('../services/missions'); } catch (_e) { /* mission service not available */ }
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

// ══════════════════════════════════════════════════
//  MISSIONS — single-player OPS (invasion + exploration)
// ══════════════════════════════════════════════════

// List the player's launch pads (claims) with active-mission status
router.get('/missions/pads', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const pads = await missionService.listLaunchPads(w);
    res.json({ pads });
  } catch (e) {
    console.error('[MISSION] pads error:', e.message);
    res.status(500).json({ error: 'Failed to load pads' });
  }
});

// Preview a mission (distance, tier, duration, cost, multiplier) without committing
router.get('/missions/preview', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  const type = req.query.type;
  const originClaimId = parseInt(req.query.originClaimId);
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const targetWallet = req.query.targetWallet ? String(req.query.targetWallet).toLowerCase() : null;
  if (!w || !type) return res.status(400).json({ error: 'Missing wallet or type' });
  if (!originClaimId) return res.status(400).json({ error: 'Pick a launch pad first' });
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: 'Invalid coordinates' });
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const result = await missionService.previewMission(w, type, originClaimId, lat, lng, targetWallet);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[MISSION] preview error:', e.message);
    res.status(500).json({ error: 'Failed to preview mission' });
  }
});

// Launch a new mission
router.post('/missions/launch', requireAuth, writeLimiter, async (req, res) => {
  const { type, originClaimId, targetLat, targetLng, targetWallet } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || !type) return res.status(400).json({ error: 'Missing wallet or type' });
  if (!originClaimId) return res.status(400).json({ error: 'Pick a launch pad first' });
  if (typeof targetLat !== 'number' || typeof targetLng !== 'number') {
    return res.status(400).json({ error: 'Invalid target coordinates' });
  }
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const result = await missionService.launchMission(
      w, type, parseInt(originClaimId), targetLat, targetLng,
      targetWallet ? targetWallet.toLowerCase() : null
    );
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[MISSION] launch error:', e.message);
    res.status(500).json({ error: 'Failed to launch mission' });
  }
});

// List active + completed missions for a wallet (private to caller)
router.get('/missions/active', readLimiter, async (req, res) => {
  const w = (req.query.wallet || '').toLowerCase();
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const missions = await missionService.getActiveMissions(w);
    res.json({ missions });
  } catch (e) {
    console.error('[MISSION] list error:', e.message);
    res.status(500).json({ error: 'Failed to load missions' });
  }
});

// Claim a completed mission's rewards
router.post('/missions/:id/claim', requireAuth, writeLimiter, async (req, res) => {
  const { minigameScore } = req.body || {};
  const w = getAuthWallet(req);
  const missionId = parseInt(req.params.id);
  if (!w || !missionId) return res.status(400).json({ error: 'Missing fields' });
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const score = minigameScore ? parseInt(minigameScore) : 0;
    const result = await missionService.claimMission(w, missionId, score);
    if (result.error) return res.status(400).json(result);
    res.json(result);
    // Season tracking (best-effort)
    if (seasonService && result.success) {
      const m = result.mission;
      if (m.type === 'exploration') seasonService.addSeasonScore(w, 'poi', 1).catch(() => {});
      // Invasion no longer steals territory — score by successful raid count
      if (m.type === 'invasion' && m.won) {
        seasonService.addSeasonScore(w, 'hijack', 1).catch(() => {});
      }
    }
  } catch (e) {
    console.error('[MISSION] claim error:', e.message);
    res.status(500).json({ error: 'Failed to claim mission' });
  }
});

// Cancel a traveling mission (partial refund)
router.post('/missions/:id/cancel', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  const missionId = parseInt(req.params.id);
  if (!w || !missionId) return res.status(400).json({ error: 'Missing fields' });
  if (!missionService) return res.status(503).json({ error: 'Mission service unavailable' });
  try {
    const result = await missionService.cancelMission(w, missionId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[MISSION] cancel error:', e.message);
    res.status(500).json({ error: 'Failed to cancel mission' });
  }
});

module.exports = router;

const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { getSetting } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

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

function requireSeasonService(res) {
  if (seasonService) return true;
  res.status(503).json({ error: 'Season service unavailable' });
  return false;
}

// Get active season info
router.get('/season/active', readLimiter, async (req, res) => {
  if (!requireSeasonService(res)) return;
  try {
    const season = await seasonService.getActiveSeason();
    res.json({ season });
  } catch (e) {
    console.error('[SEASON] active error:', e.message);
    res.status(500).json({ error: 'Failed to get season' });
  }
});

// Get season leaderboard
router.get('/season/leaderboard', readLimiter, async (req, res) => {
  if (!requireSeasonService(res)) return;
  try {
    const seasonId = req.query.seasonId ? parseInt(req.query.seasonId) : null;
    const lb = await seasonService.getSeasonLeaderboard(seasonId, parseInt(req.query.limit) || 20);
    res.json({ leaderboard: lb });
  } catch (e) {
    console.error('[SEASON] leaderboard error:', e.message);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/season/category/:key — top players for a specific season category (Migration 098)
router.get('/season/category/:key', readLimiter, async (req, res) => {
  if (!requireSeasonService(res)) return;
  try {
    const result = await seasonService.getCategoryLeaderboard(req.params.key, parseInt(req.query.limit) || 10);
    if (!result) return res.status(404).json({ error: 'Category not found' });
    res.json(result);
  } catch (e) {
    console.error('[SEASON] category lb error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/stats/career — authenticated career lifetime stats (Migration 098)
router.get('/stats/career', requireAuth, readLimiter, async (req, res) => {
  if (!requireSeasonService(res)) return;
  const wallet = getAuthWallet(req);
  if (!wallet || wallet.length < 10) return res.status(400).json({ error: 'wallet_required' });
  try {
    const stats = await seasonService.getCareerStats(wallet);
    res.json(stats);
  } catch (e) {
    console.error('[STATS] career error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Get my season rewards
router.get('/season/rewards', requireAuth, readLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!requireSeasonService(res)) return;
  try {
    const rewards = await seasonService.getMyRewards(w);
    res.json({ rewards });
  } catch (e) {
    console.error('[SEASON] rewards error:', e.message);
    res.status(500).json({ error: 'Failed to get rewards' });
  }
});

// Claim season reward
router.post('/season/claim', requireAuth, writeLimiter, async (req, res) => {
  const { rewardId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !rewardId) return res.status(400).json({ error: 'Missing fields' });
  if (!requireSeasonService(res)) return;
  try {
    const result = await seasonService.claimSeasonReward(w, parseInt(rewardId));
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error('[SEASON] claim error:', e.message);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

// Track share action for "Influencer" season category
router.post('/season/share', requireAuth, writeLimiter, async (req, res) => {
  try {
    const w = getAuthWallet(req);
    if (!w) return res.json({ ok: true });
    if (seasonService) { seasonService.addSeasonScore(w, 'share', 1).catch(() => {}); }
    res.json({ ok: true });
  } catch (e) { res.json({ ok: true }); }
});

// Track taps/clicks for "Most Active" season category (batched from frontend)
router.post('/season/taps', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { count } = req.body;
    const w = getAuthWallet(req);
    if (!w || !count || count < 1) return res.json({ ok: true });
    // Cap at 500 per batch to prevent abuse
    const taps = Math.min(parseInt(count) || 0, 500);
    if (taps > 0 && seasonService) {
      seasonService.addSeasonScore(w, 'tap', taps).catch(() => {});
    }
    res.json({ ok: true, recorded: taps });
  } catch (e) { res.json({ ok: true }); }
});

router.get('/season/pass', requireAuth, readLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!requireSeasonService(res)) return;
  try {
    const pass = await seasonService.getSeasonPass(w);
    if (pass.error) return res.status(400).json(pass);
    pass.premiumCost = parseInt(await getSetting('season_pass_premium_cost_gp') || '500');
    res.json(pass);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/season/pass/purchase', requireAuth, writeLimiter, async (req, res) => {
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'Missing wallet' });
  if (!requireSeasonService(res)) return;
  try {
    const r = await seasonService.purchasePremiumPass(w);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/season/pass/claim', requireAuth, writeLimiter, async (req, res) => {
  const { tier, isPremium } = req.body || {};
  const w = getAuthWallet(req);
  if (!w || tier === undefined) return res.status(400).json({ error: 'Missing fields' });
  if (!requireSeasonService(res)) return;
  try {
    const r = await seasonService.claimPassTier(w, parseInt(tier), !!isPremium);
    if (r.error) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

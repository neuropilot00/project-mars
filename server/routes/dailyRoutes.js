const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting } = require('../db');
const { requireAuth, getAuthWallet } = require('../utils/apiHelpers');

let dailyService;
try { dailyService = require('../services/daily'); } catch (_e) { /* daily engagement service not available */ }
let seasonService;
try { seasonService = require('../services/season'); } catch (_e) { /* season service not available */ }
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_e) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_e) {}

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

// GET /api/daily/status — check today's check-in status without claiming
router.get('/daily/status', readLimiter, async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
    const w = wallet.toLowerCase();
    const existing = await pool.query(
      'SELECT streak_day, reward_gp FROM daily_logins WHERE wallet = $1 AND login_date = CURRENT_DATE', [w]
    );
    const defaultGP = [5,10,10,15,15,20,30,10,15,15,20,20,25,50];
    const gpRaw = await getSetting('daily_login_gp_rewards', defaultGP);
    let gpRewards = defaultGP;
    if (Array.isArray(gpRaw)) gpRewards = gpRaw;
    else if (typeof gpRaw === 'string') {
      try { const p = JSON.parse(gpRaw); if (Array.isArray(p)) gpRewards = p; } catch (_) {}
    }
    const maxDays = parseInt(await getSetting('daily_streak_cycle', 7)) || 7;
    const milestones = {
      3:  { bonus: parseFloat(await getSetting('streak_3_gp', 30)) },
      7:  { bonus: parseFloat(await getSetting('streak_7_gp', 100)) },
      10: { bonus: parseFloat(await getSetting('streak_10_gp', 150)) },
      14: { bonus: parseFloat(await getSetting('streak_14_gp', 300)) }
    };
    const dayRewards = [];
    for (let d = 1; d <= maxDays; d++) {
      dayRewards.push({ day: d, gp: gpRewards[d-1] || 0, milestone: milestones[d] || null });
    }

    if (existing.rows.length) {
      const rawStreak = existing.rows[0].streak_day;
      const cycleDay = maxDays > 0 ? ((rawStreak - 1) % maxDays + 1) : rawStreak;
      return res.json({ todayClaimed: true, streak: rawStreak, cycleDay, reward: parseFloat(existing.rows[0].reward_gp), dayRewards, maxDays });
    }
    const yesterday = await pool.query(
      "SELECT streak_day FROM daily_logins WHERE wallet = $1 AND login_date = CURRENT_DATE - INTERVAL '1 day'", [w]
    );
    const rawStreak = yesterday.rows.length ? yesterday.rows[0].streak_day : 0;
    const cycleDay = (rawStreak > 0 && maxDays > 0) ? ((rawStreak - 1) % maxDays + 1) : rawStreak;
    res.json({ todayClaimed: false, streak: rawStreak, cycleDay, dayRewards, maxDays });
  } catch (e) {
    console.error('[DAILY] status error:', e.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// POST /api/daily/login — record daily login & collect streak reward
router.post('/daily/login', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!dailyService) return res.status(503).json({ error: 'Daily system not available' });
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
    const result = await dailyService.recordDailyLogin(wallet);
    if (!result.alreadyClaimed) {
      try { const w = wallet.toLowerCase(); const _dOps = require('./dailyOps'); _dOps.notifyMissionProgress(w, 'daily_login').catch(()=>{}); } catch(_) {}
    }
    res.json(result);
    if (seasonService && !result.alreadyClaimed) {
      const sw = wallet.toLowerCase();
      seasonService.addSeasonScore(sw, 'login', 1).catch(() => {});
      if (result.streakDay > 1) seasonService.addSeasonScore(sw, 'streak', result.streakDay).catch(() => {});
      if (result.rewardGP > 0) seasonService.addSeasonScore(sw, 'gp_earn', result.rewardGP).catch(() => {});
    }
    if (achSvc && !result.alreadyClaimed && result.rewardGP > 0) {
      achSvc.checkAndUnlock(wallet.toLowerCase(), 'gp_balance').catch(() => {});
    }
    if (weeklySvc && !result.alreadyClaimed && result.rewardGP > 0) {
      weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_earn', result.rewardGP).catch(() => {});
    }
  } catch (e) {
    console.error('[DAILY] login error:', e.message);
    res.status(500).json({ error: 'Daily login failed' });
  }
});

// GET /api/daily/missions — get today's missions (auto-generates if needed)
router.get('/daily/missions', readLimiter, async (req, res) => {
  try {
    if (!dailyService) return res.status(503).json({ error: 'Daily system not available' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
    const missions = await dailyService.getDailyMissions(wallet);
    res.json({ missions });
  } catch (e) {
    console.error('[DAILY] missions error:', e.message);
    res.status(500).json({ error: 'Failed to get missions' });
  }
});

// POST /api/daily/missions/:id/claim — claim a completed mission reward
router.post('/daily/missions/:id/claim', requireAuth, writeLimiter, async (req, res) => {
  try {
    if (!dailyService) return res.status(503).json({ error: 'Daily system not available' });
    const wallet = getAuthWallet(req);
    const missionId = parseInt(req.params.id);
    if (!wallet || !missionId) return res.status(400).json({ error: 'Missing wallet or mission ID' });
    const result = await dailyService.claimMissionReward(wallet, missionId);
    if (result.error) return res.status(400).json(result);
    if (seasonService && result.success) {
      const sw = wallet.toLowerCase();
      seasonService.addSeasonScore(sw, 'quest', 1).catch(() => {});
      if (result.rewardGP > 0) seasonService.addSeasonScore(sw, 'gp_earn', Math.round(result.rewardGP)).catch(() => {});
    }
    res.json(result);
  } catch (e) {
    console.error('[DAILY] claim error:', e.message);
    res.status(500).json({ error: 'Mission claim failed' });
  }
});

// GET /api/daily/streak — get streak info
router.get('/daily/streak', readLimiter, async (req, res) => {
  try {
    if (!dailyService) return res.status(503).json({ error: 'Daily system not available' });
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'Missing wallet' });
    const info = await dailyService.getStreakInfo(wallet);
    res.json(info);
  } catch (e) {
    console.error('[DAILY] streak error:', e.message);
    res.status(500).json({ error: 'Failed to get streak info' });
  }
});

module.exports = router;

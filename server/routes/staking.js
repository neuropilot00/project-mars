'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const { pool }  = require('../db');
const router    = express.Router();

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

let stakingService;
try { stakingService = require('../services/staking'); } catch (_e) {}
let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('../services/season'); } catch (_) {}
let achSvc;
try { achSvc = require('../services/achievements'); } catch (_) {}
let weeklySvc;
try { weeklySvc = require('../services/weeklyChallenges'); } catch (_) {}

const isDev = process.env.NODE_ENV !== 'production';
const readLimiter  = rateLimit({ windowMs: 60 * 1000, max: isDev ? 300 : 60,  message: { error: 'Too many requests' } });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: isDev ? 100 : 20,  message: { error: 'Too many requests' } });

// GET /api/staking/info — config + yield examples for the UI
router.get('/staking/info', readLimiter, async (req, res) => {
  const wallet = (req.query.wallet || '').toLowerCase();
  try {
    if (!stakingService) return res.status(503).json({ error: 'Staking service unavailable' });
    const info = await stakingService.getStakingInfo(wallet || null);
    res.json(info);
  } catch (e) {
    console.error('[STAKING] info error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/staking/my-stakes — list user's stakes
router.get('/staking/my-stakes', requireAuth, readLimiter, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    if (!stakingService) return res.status(503).json({ error: 'Staking service unavailable' });
    const stakes = await stakingService.getMyStakes(wallet);
    res.json({ stakes });
  } catch (e) {
    console.error('[STAKING] my-stakes error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/staking/stake — create a new stake { wallet, amount, lockDays }
router.post('/staking/stake', requireAuth, writeLimiter, async (req, res) => {
  const { amount, lockDays } = req.body;
  const w = getAuthWallet(req);
  if (!w) return res.status(400).json({ error: 'wallet required' });
  if (!amount || !lockDays) return res.status(400).json({ error: 'amount and lockDays required' });
  if (!stakingService) return res.status(503).json({ error: 'Staking service unavailable' });

  const amt = parseFloat(amount);
  const days = parseInt(lockDays);
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (isNaN(days) || days <= 0) return res.status(400).json({ error: 'Invalid lockDays' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await stakingService.createStake(client, w, amt, days);
    await client.query('COMMIT');

    // Fire-and-forget side effects
    if (logGPActivity) {
      logGPActivity(w, -amt, 'gp_stake', `Staked ${amt} GP for ${days} days (expected yield: ${result.yieldEarned})`).catch(() => {});
    }
    if (seasonService) {
      seasonService.addSeasonScore(w, 'gp_spend', Math.round(amt)).catch(() => {});
    }
    if (weeklySvc) {
      weeklySvc.trackProgress(w, 'stake_gp', Math.round(amt)).catch(() => {});
    }

    res.json({ success: true, stake: result.stake, yieldEarned: result.yieldEarned, unlocksAt: result.unlocksAt });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[STAKING] stake error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// POST /api/staking/withdraw — withdraw a matured stake { wallet, stakeId }
router.post('/staking/withdraw', requireAuth, writeLimiter, async (req, res) => {
  const { stakeId } = req.body;
  const w = getAuthWallet(req);
  if (!w || !stakeId) return res.status(400).json({ error: 'wallet and stakeId required' });
  if (!stakingService) return res.status(503).json({ error: 'Staking service unavailable' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await stakingService.withdrawStake(client, w, parseInt(stakeId));
    await client.query('COMMIT');

    // Fire-and-forget side effects
    if (logGPActivity) {
      logGPActivity(w, result.totalReturn, 'gp_stake_withdraw',
        `Withdrew stake: ${result.amount} GP + ${result.yieldEarned} yield`).catch(() => {});
    }
    if (seasonService) {
      seasonService.addSeasonScore(w, 'gp_earn', Math.round(result.yieldEarned)).catch(() => {});
    }
    if (achSvc) {
      achSvc.checkAndUnlock(w, 'gp_balance').catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[STAKING] withdraw error:', e.message);
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;

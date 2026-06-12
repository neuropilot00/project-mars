'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const duelSvc = require('../services/duel');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

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

// ── GET /api/duels/my ─────────────────────────────────────────────────────────
router.get('/duels/my', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { limit } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const duels = await duelSvc.getMyDuels(wallet, parseInt(limit || '30', 10));
    res.json(duels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/duels/pending ────────────────────────────────────────────────────
router.get('/duels/pending', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const duels = await duelSvc.getPendingForMe(wallet);
    res.json(duels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/duels/recent ─────────────────────────────────────────────────────
router.get('/duels/recent', async (req, res) => {
  try {
    const duels = await duelSvc.getRecentResolved(parseInt(req.query.limit || '20', 10));
    res.json(duels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/duels/settings ───────────────────────────────────────────────────
router.get('/duels/settings', async (req, res) => {
  try {
    res.json(await duelSvc.getSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/duels/challenge ─────────────────────────────────────────────────
// { defender, wagerGp }
router.post('/duels/challenge', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { defender, wagerGp } = req.body || {};
  if (!wallet || !defender || !wagerGp) {
    return res.status(400).json({ error: 'wallet, defender, wagerGp required' });
  }
  try {
    const duel = await duelSvc.challenge(wallet, defender, parseFloat(wagerGp));

    // Side effects
    if (logGPActivity) {
      logGPActivity(wallet, -parseFloat(wagerGp), 'duel_wager_escrowed',
        `Duel challenge vs ${defender}`).catch(() => {});
    }

    res.json(duel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/accept ────────────────────────────────────────────────────
// { duelId }
router.post('/duels/accept', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { duelId } = req.body || {};
  if (!wallet || !duelId) return res.status(400).json({ error: 'wallet and duelId required' });
  try {
    const result = await duelSvc.acceptDuel(parseInt(duelId, 10), wallet);

    // GP activity log for both sides
    const wager = Number(result.wager_gp);
    if (logGPActivity) {
      const winner = result.winner;
      const loser  = winner === result.challenger ? result.defender : result.challenger;
      if (winner) {
        logGPActivity(winner, result.payout_gp, 'duel_win',  `Duel win vs ${loser}`).catch(() => {});
        logGPActivity(loser,  -wager,            'duel_loss', `Duel loss vs ${winner}`).catch(() => {});
      }
    }
    // Season tracking for GP burn (fee)
    const feeBurned = Number(result.fee_gp || 0);
    if (feeBurned > 0) {
      if (seasonService && seasonService.trackGPSpend) {
        [result.challenger, result.defender].forEach(w => {
          seasonService.trackGPSpend(w, feeBurned / 2).catch(() => {});
        });
      }
    }
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet, 'duel_fight', 1).catch(() => {});
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/decline ───────────────────────────────────────────────────
router.post('/duels/decline', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { duelId } = req.body || {};
  if (!wallet || !duelId) return res.status(400).json({ error: 'wallet and duelId required' });
  try {
    res.json(await duelSvc.declineDuel(parseInt(duelId, 10), wallet));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/cancel ────────────────────────────────────────────────────
router.post('/duels/cancel', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { duelId } = req.body || {};
  if (!wallet || !duelId) return res.status(400).json({ error: 'wallet and duelId required' });
  try {
    res.json(await duelSvc.cancelDuel(parseInt(duelId, 10), wallet));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

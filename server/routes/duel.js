'use strict';
const express = require('express');
const router  = express.Router();
const duelSvc = require('../services/duel');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../services/gpService')); } catch (_) {}
try { seasonService = require('../services/seasonService'); } catch (_) {}
try { weeklySvc     = require('../services/weeklyChallenge'); } catch (_) {}

// ── GET /api/duels/my?wallet= ─────────────────────────────────────────────────
router.get('/duels/my', async (req, res) => {
  try {
    const { wallet, limit } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const duels = await duelSvc.getMyDuels(wallet, parseInt(limit || '30', 10));
    res.json(duels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/duels/pending?wallet= ───────────────────────────────────────────
router.get('/duels/pending', async (req, res) => {
  try {
    const { wallet } = req.query;
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
// { wallet, defender, wagerGp }
router.post('/duels/challenge', async (req, res) => {
  const { wallet, defender, wagerGp } = req.body || {};
  if (!wallet || !defender || !wagerGp) {
    return res.status(400).json({ error: 'wallet, defender, wagerGp required' });
  }
  try {
    const duel = await duelSvc.challenge(wallet, defender, parseFloat(wagerGp));

    // Side effects
    if (logGPActivity) {
      logGPActivity(wallet.toLowerCase(), -parseFloat(wagerGp), 'duel_wager_escrowed',
        `Duel challenge vs ${defender}`).catch(() => {});
    }

    res.json(duel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/accept ────────────────────────────────────────────────────
// { wallet, duelId }
router.post('/duels/accept', async (req, res) => {
  const { wallet, duelId } = req.body || {};
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
    // Season / weekly tracking for GP burn (fee)
    const feeBurned = Number(result.fee_gp || 0);
    if (feeBurned > 0) {
      if (seasonService && seasonService.trackGPSpend) {
        [result.challenger, result.defender].forEach(w => {
          seasonService.trackGPSpend(w, feeBurned / 2).catch(() => {});
        });
      }
    }
    if (weeklySvc && weeklySvc.trackProgress) {
      weeklySvc.trackProgress(wallet.toLowerCase(), 'duel_fight', 1).catch(() => {});
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/decline ───────────────────────────────────────────────────
router.post('/duels/decline', async (req, res) => {
  const { wallet, duelId } = req.body || {};
  if (!wallet || !duelId) return res.status(400).json({ error: 'wallet and duelId required' });
  try {
    res.json(await duelSvc.declineDuel(parseInt(duelId, 10), wallet));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/duels/cancel ────────────────────────────────────────────────────
router.post('/duels/cancel', async (req, res) => {
  const { wallet, duelId } = req.body || {};
  if (!wallet || !duelId) return res.status(400).json({ error: 'wallet and duelId required' });
  try {
    res.json(await duelSvc.cancelDuel(parseInt(duelId, 10), wallet));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

'use strict';
const express    = require('express');
const router     = express.Router();
const contestSvc = require('../services/contest');

let logGPActivity, seasonService, weeklySvc;
try { ({ logGPActivity } = require('../db')); } catch (_) {}
try { seasonService = require('../services/season'); } catch (_) {}
// weeklySvc intentionally not available (service removed)

// GET /api/contests?status=open
router.get('/contests', async (req, res) => {
  try {
    res.json(await contestSvc.getContests(req.query.status || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contests/:id
router.get('/contests/:id', async (req, res) => {
  try {
    const c = await contestSvc.getContest(parseInt(req.params.id, 10));
    if (!c) return res.status(404).json({ error: 'Contest not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/contests/:id/entries?wallet=
router.get('/contests/:id/entries', async (req, res) => {
  try {
    res.json(await contestSvc.getEntries(
      parseInt(req.params.id, 10), req.query.wallet || null));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/contests/submit
// { wallet, contestId, title, description, imageUrl, claimId }
router.post('/contests/submit', async (req, res) => {
  const { wallet, contestId, title, description, imageUrl, claimId } = req.body || {};
  if (!wallet || !contestId) return res.status(400).json({ error: 'wallet and contestId required' });
  try {
    const entry = await contestSvc.submitEntry(
      wallet, parseInt(contestId, 10), title, description, imageUrl,
      claimId ? parseInt(claimId, 10) : null
    );
    // GP side effects
    const fee = Number(entry.gp_paid);
    if (fee > 0) {
      if (logGPActivity) logGPActivity(wallet.toLowerCase(), -fee, 'contest_entry', `Contest #${contestId} entry`).catch(() => {});
      if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet.toLowerCase(), fee).catch(() => {});
      if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet.toLowerCase(), 'gp_burn', fee).catch(() => {});
    }
    res.json(entry);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/contests/vote
// { wallet, entryId }
router.post('/contests/vote', async (req, res) => {
  const { wallet, entryId } = req.body || {};
  if (!wallet || !entryId) return res.status(400).json({ error: 'wallet and entryId required' });
  try {
    const result = await contestSvc.voteForEntry(wallet, parseInt(entryId, 10));
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

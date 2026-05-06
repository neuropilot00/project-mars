'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/tournaments');

// GET /api/tournaments — open + running
router.get('/tournaments', async (req, res) => {
  try { res.json(await svc.getTournaments()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tournaments/my?wallet=  — must be BEFORE /:id to avoid shadow match
router.get('/tournaments/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyTournaments(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tournaments/:id — detail + entries
router.get('/tournaments/:id', async (req, res) => {
  try {
    const t = await svc.getTournament(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tournaments/join  { wallet, tournamentId }
router.post('/tournaments/join', async (req, res) => {
  const { wallet, tournamentId } = req.body || {};
  if (!wallet || !tournamentId) return res.status(400).json({ error: 'wallet and tournamentId required' });
  try { res.json(await svc.joinTournament(wallet, tournamentId)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

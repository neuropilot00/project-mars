'use strict';
const express = require('express');
const router = express.Router();
const raffleSvc = require('../services/raffle');

// GET /api/raffles — open raffles
router.get('/raffles', async (req, res) => {
  try { res.json(await raffleSvc.getOpenRaffles()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/:id
router.get('/raffles/:id', async (req, res) => {
  try {
    const rf = await raffleSvc.getRaffle(parseInt(req.params.id));
    if (!rf) return res.status(404).json({ error: 'Not found' });
    res.json(rf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/:id/entrants
router.get('/raffles/:id/entrants', async (req, res) => {
  try { res.json(await raffleSvc.getEntrants(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/raffles/my?wallet=
router.get('/raffles/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await raffleSvc.getMyEntries(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/raffles/buy  { wallet, raffleId, count }
router.post('/raffles/buy', async (req, res) => {
  try {
    const { wallet, raffleId, count } = req.body || {};
    if (!wallet || !raffleId) return res.status(400).json({ error: 'wallet and raffleId required' });
    const result = await raffleSvc.buyTickets(wallet, parseInt(raffleId), parseInt(count)||1);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/capsule'); } catch(_) {}

// GET /api/capsule/config
router.get('/capsule/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/revealed  — public feed of revealed capsules
router.get('/capsule/revealed', async (req, res) => {
  try { res.json(await svc.getRevealed()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/upcoming  — count + next reveal time (no messages)
router.get('/capsule/upcoming', async (req, res) => {
  try { res.json(await svc.getUpcoming()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/capsule/my?wallet=  — player's own capsules
router.get('/capsule/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyCapsules(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/capsule/bury  { wallet, message, revealInDays }
router.post('/capsule/bury', async (req, res) => {
  const { wallet, message, revealInDays } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    const result = await svc.buryCapsule(wallet, message || '', revealInDays || 7);
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

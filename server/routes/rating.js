'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/rating'); } catch(_) {}

// GET /api/rating/config
router.get('/rating/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rating/claim/:claimId
router.get('/rating/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getClaimRating(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/rating/my?claimId=&wallet=
router.get('/rating/my', async (req, res) => {
  const { claimId, wallet } = req.query;
  if (!claimId || !wallet) return res.status(400).json({ error: 'claimId and wallet required' });
  try { res.json(await svc.getMyRating(claimId, wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rating/rate  { wallet, claimId, rating }
router.post('/rating/rate', async (req, res) => {
  const { wallet, claimId, rating } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  if (!rating) return res.status(400).json({ error: 'rating required' });
  try { res.json(await svc.rateTerritory(wallet, claimId, rating)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

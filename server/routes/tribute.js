'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/tribute'); } catch(_) {}

// GET /api/tribute/config
router.get('/tribute/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tribute/claim/:claimId  — recent tributes for a territory
router.get('/tribute/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getClaimTributes(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tribute/my?wallet=
router.get('/tribute/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyTributes(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tribute/send  { wallet, claimId, amountGP, message }
router.post('/tribute/send', async (req, res) => {
  const { wallet, claimId, amountGP, message } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  if (!amountGP) return res.status(400).json({ error: 'amountGP required' });
  try { res.json(await svc.sendTribute(wallet, claimId, amountGP, message)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

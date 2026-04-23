'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/banner'); } catch(_) {}

router.get('/banner/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/banner/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getActiveBanners(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/banner/plant', async (req, res) => {
  const { wallet, claimId, emoji, message } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.plantBanner(wallet, claimId, emoji, message)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

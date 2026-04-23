'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/tprestige'); } catch(_) {}

router.get('/tprestige/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/tprestige/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getPrestige(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tprestige/upgrade', async (req, res) => {
  const { wallet, claimId } = req.body || {};
  if (!wallet)  return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.upgradePrestige(wallet, claimId)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

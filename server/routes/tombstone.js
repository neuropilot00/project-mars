'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/tombstone'); } catch(_) {}

router.get('/tombstone/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/tombstone/claim/:claimId', async (req, res) => {
  const id = parseInt(req.params.claimId, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid claimId' });
  try { res.json(await svc.getTombstones(id)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tombstone/place', async (req, res) => {
  const { wallet, claimId, epitaph } = req.body || {};
  if (!wallet)  return res.status(400).json({ error: 'wallet required' });
  if (!claimId) return res.status(400).json({ error: 'claimId required' });
  try { res.json(await svc.placeTombstone(wallet.toLowerCase().trim(), claimId, epitaph)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

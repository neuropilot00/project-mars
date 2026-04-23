'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/donation');

router.get('/donation/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/donation/wall', async (req, res) => {
  try { res.json(await svc.getWall()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/donation/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyDonations(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/donation/donate', async (req, res) => {
  const { wallet, amount, message } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.donate(wallet, amount, message)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/beacon');

router.get('/beacons/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/beacons/active', async (req, res) => {
  try { res.json(await svc.getActiveBeacons()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/beacons/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyBeacons(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/beacons/place', async (req, res) => {
  const { wallet, x, y, message, icon } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.placeBeacon(wallet.toLowerCase().trim(), { x: Number(x), y: Number(y), message, icon })); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

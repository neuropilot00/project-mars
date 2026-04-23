'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/announcement'); } catch(_) {}

router.get('/announce/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/announce/active', async (req, res) => {
  try { res.json(await svc.getActiveAnnouncements()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/announce/post', async (req, res) => {
  const { wallet, message, durationM } = req.body || {};
  if (!wallet)  return res.status(400).json({ error: 'wallet required' });
  if (!message) return res.status(400).json({ error: 'message required' });
  try { res.json(await svc.postAnnouncement(wallet, message, durationM)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

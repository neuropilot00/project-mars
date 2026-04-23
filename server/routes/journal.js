'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/journal'); } catch(_) {}

router.get('/journal/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/journal/feed', async (req, res) => {
  try { res.json(await svc.getFeed(req.query.limit)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/journal/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyEntries(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/journal/publish', async (req, res) => {
  const { wallet, title, content } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!title)  return res.status(400).json({ error: 'title required' });
  if (!content)return res.status(400).json({ error: 'content required' });
  try { res.json(await svc.publishEntry(wallet, title, content)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

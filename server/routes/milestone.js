'use strict';
const express = require('express');
const router  = express.Router();
let svc; try { svc = require('../services/milestone'); } catch(_) {}

router.get('/milestone/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/milestone/feed', async (req, res) => {
  try { res.json(await svc.getFeed(req.query.limit, req.query.category)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/milestone/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyMilestones(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/milestone/record', async (req, res) => {
  const { wallet, category, title, description } = req.body || {};
  if (!wallet)      return res.status(400).json({ error: 'wallet required' });
  if (!title)       return res.status(400).json({ error: 'title required' });
  if (!description) return res.status(400).json({ error: 'description required' });
  try { res.json(await svc.recordMilestone(wallet.toLowerCase().trim(), category, title, description)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

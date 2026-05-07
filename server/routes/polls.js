'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/polls');

router.get('/polls/config', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/polls', async (req, res) => {
  const wallet = req.query.wallet ? req.query.wallet.toLowerCase().trim() : null;
  try { res.json(await svc.getActivePolls(wallet)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/polls/:id/results', async (req, res) => {
  try { res.json(await svc.getPollResults(Number(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/polls/create', async (req, res) => {
  const { wallet, question, options, durationH } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.createPoll(wallet.toLowerCase().trim(), { question, options, durationH })); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.post('/polls/vote', async (req, res) => {
  const { wallet, pollId, optionIdx } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.vote(wallet.toLowerCase().trim(), Number(pollId), Number(optionIdx))); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

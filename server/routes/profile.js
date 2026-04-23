'use strict';
const express = require('express');
const router = express.Router();
const profileSvc = require('../services/profile');

// GET /api/profile?wallet=
router.get('/profile', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const profile = await profileSvc.getProfile(wallet);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/costs
router.get('/profile/costs', async (req, res) => {
  try {
    const cfg = await profileSvc.getCfg();
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/history?wallet=&field=
router.get('/profile/history', async (req, res) => {
  try {
    const { wallet, field } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    const history = await profileSvc.getHistory(wallet, field || null);
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/profile/nickname  { wallet, nickname }
router.post('/profile/nickname', async (req, res) => {
  try {
    const { wallet, nickname } = req.body || {};
    if (!wallet || !nickname) return res.status(400).json({ error: 'wallet and nickname required' });
    const result = await profileSvc.setNickname(wallet, nickname);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/profile/avatar-color  { wallet, color }
router.post('/profile/avatar-color', async (req, res) => {
  try {
    const { wallet, color } = req.body || {};
    if (!wallet || !color) return res.status(400).json({ error: 'wallet and color required' });
    const result = await profileSvc.setAvatarColor(wallet, color);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/profile/motto  { wallet, motto }
router.post('/profile/motto', async (req, res) => {
  try {
    const { wallet, motto } = req.body || {};
    if (!wallet || !motto) return res.status(400).json({ error: 'wallet and motto required' });
    const result = await profileSvc.setMotto(wallet, motto);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

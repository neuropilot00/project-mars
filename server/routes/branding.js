'use strict';
const express  = require('express');
const router   = express.Router();
const svc      = require('../services/branding');

// GET /api/branding/claim/:claimId
router.get('/branding/claim/:claimId', async (req, res) => {
  try { res.json(await svc.getBranding(parseInt(req.params.claimId, 10))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/branding/my?wallet=
router.get('/branding/my', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyBranding(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/branding/costs
router.get('/branding/costs', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/branding/name   { wallet, claimId, name }
router.post('/branding/name', async (req, res) => {
  const { wallet, claimId, name } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setName(wallet, claimId, name)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/branding/tagline  { wallet, claimId, tagline }
router.post('/branding/tagline', async (req, res) => {
  const { wallet, claimId, tagline } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setTagline(wallet, claimId, tagline)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/branding/color  { wallet, claimId, color }
router.post('/branding/color', async (req, res) => {
  const { wallet, claimId, color } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setColor(wallet, claimId, color)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/branding/clear  { wallet, claimId }
router.post('/branding/clear', async (req, res) => {
  const { wallet, claimId } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.clearBranding(wallet, claimId)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

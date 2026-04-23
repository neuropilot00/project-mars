'use strict';
const express = require('express');
const router = express.Router();
const tevtSvc = require('../services/tevt');

// GET /api/tevt/config
router.get('/tevt/config', async (req, res) => {
  try { res.json(await tevtSvc.getCfg()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tevt/claim/:claimId
router.get('/tevt/claim/:claimId', async (req, res) => {
  try { res.json(await tevtSvc.getClaimEvents(parseInt(req.params.claimId))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tevt/my?wallet=
router.get('/tevt/my', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ error: 'wallet required' });
    res.json(await tevtSvc.getMyEvents(wallet));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/tevt/active
router.get('/tevt/active', async (req, res) => {
  try { res.json(await tevtSvc.getActiveEvents()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/tevt/activate  { wallet, claimId, eventType }
router.post('/tevt/activate', async (req, res) => {
  try {
    const { wallet, claimId, eventType } = req.body || {};
    if (!wallet || !claimId || !eventType) {
      return res.status(400).json({ error: 'wallet, claimId, eventType required' });
    }
    const result = await tevtSvc.activateEvent(wallet, parseInt(claimId), eventType);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

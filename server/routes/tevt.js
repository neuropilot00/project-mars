'use strict';
const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const tevtSvc  = require('../services/tevt');

// ✅ [v7.47] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

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

// POST /api/tevt/activate  { claimId, eventType }
router.post('/tevt/activate', requireAuth, async (req, res) => {
  try {
    const wallet = getAuthWallet(req);
    const { claimId, eventType } = req.body || {};
    if (!wallet || !claimId || !eventType) {
      return res.status(400).json({ error: 'wallet, claimId, eventType required' });
    }
    const result = await tevtSvc.activateEvent(wallet, parseInt(claimId), eventType);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;

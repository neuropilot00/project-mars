'use strict';
const express  = require('express');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const svc      = require('../services/branding');

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

// GET /api/branding/claim/:claimId
router.get('/branding/claim/:claimId', async (req, res) => {
  try { res.json(await svc.getBranding(parseInt(req.params.claimId, 10))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/branding/my
router.get('/branding/my', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try { res.json(await svc.getMyBranding(wallet)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/branding/costs
router.get('/branding/costs', async (req, res) => {
  try { res.json(await svc.getCfg()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/branding/name   { claimId, name }
router.post('/branding/name', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, name } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setName(wallet, claimId, name)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/branding/tagline  { claimId, tagline }
router.post('/branding/tagline', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, tagline } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setTagline(wallet, claimId, tagline)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/branding/color  { claimId, color }
router.post('/branding/color', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { claimId, color } = req.body || {};
  if (!wallet || !claimId) return res.status(400).json({ error: 'wallet and claimId required' });
  try { res.json(await svc.setColor(wallet, claimId, color)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// [v7.192 deprecated] POST /api/branding/clear — 프론트 호출 0건 확인 (감사 v7.191).
//   1주 모니터링 후 mount 자체 제거 예정. 호출되면 console.warn 으로 식별.
router.post('/branding/clear', requireAuth, async (req, res) => {
  console.warn('[deprecated] /api/branding/clear called by', getAuthWallet(req), req.headers['user-agent']);
  return res.status(410).json({ error: 'GONE', message: 'Endpoint deprecated, will be removed.' });
});

module.exports = router;

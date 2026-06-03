// server/routes/spy.js
// PvP 스파이/정찰 라우트. 배신 시스템 Phase 3 / 시스템2.
//   POST /api/spy/scout    — 표적 함대 정찰(GP 소각, 구성 노출, 탐지 롤)
//   GET  /api/spy/reports  — 내 정찰 보고서
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const spy = require('../services/spy');

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// POST /api/spy/scout — { target_wallet }
router.post('/scout', requireAuth, async (req, res) => {
  try {
    const scout = getAuthWallet(req);
    const target = (req.body?.target_wallet || '').toLowerCase().trim();
    if (!scout) return res.status(400).json({ error: 'INVALID_WALLET' });
    if (!target) return res.status(400).json({ error: 'TARGET_REQUIRED' });
    const result = await spy.scoutTarget(scout, target);
    if (result.error) {
      const code = result.error === 'INSUFFICIENT_GP' ? 400 : result.error === 'TARGET_NOT_FOUND' ? 404 : 400;
      return res.status(code).json(result);
    }
    res.json(result);
  } catch (e) {
    console.error('[SPY] scout route error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/spy/reports
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const scout = getAuthWallet(req);
    if (!scout) return res.status(400).json({ error: 'INVALID_WALLET' });
    const reports = await spy.getReports(scout, req.query.limit);
    res.json({ reports });
  } catch (e) {
    console.error('[SPY] reports route error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

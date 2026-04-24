// server/routes/territoryRoutes.js
// ═══════════════════════════════════════════════════════════════
// 영토 매매 비주얼 API (Migration 091)
//
// GET  /api/territory/price    — 영토 가격 미리보기
// GET  /api/territory/bonus    — 내 인접 보너스 현황
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const territory = require('../services/territoryVisual');

const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  try {
    const mod = require('../routes/auth');
    if (mod?.requireAuth) return mod.requireAuth(req, res, next);
  } catch { }
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

/**
 * GET /api/territory/price
 * ?pixel_count=100&x=10&y=10&width=10&height=10&sector_code=hellas_frontier
 * 영토 구매 전 가격 미리보기
 */
router.get('/price', requireAuth, async (req, res) => {
  try {
    const { pixel_count, x, y, width, height, sector_code } = req.query;
    const result = await territory.getTerritoryInfo(
      getWallet(req),
      parseInt(pixel_count) || 0,
      parseInt(x) || 0, parseInt(y) || 0,
      parseInt(width) || 0, parseInt(height) || 0,
      sector_code || null
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/territory/bonus
 * 내 인접 보너스 현황
 */
router.get('/bonus', requireAuth, async (req, res) => {
  try {
    const bonus = await territory.calcAdjacencyBonus(getWallet(req));
    res.json(bonus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

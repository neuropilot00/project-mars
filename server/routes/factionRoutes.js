// server/routes/factionRoutes.js
// ═══════════════════════════════════════════════════════════════
// 파벌 시스템 API (Migration 092)
//
// GET  /api/factions              — 파벌 목록 + 내 선택 현황
// GET  /api/factions/stats        — 파벌별 세력 통계 (공개)
// POST /api/factions/choose       — 파벌 선택/변경
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const faction = require('../services/factionSystem');

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

const ERROR_STATUS = {
  FACTION_NOT_FOUND: 404, USER_NOT_FOUND: 404,
  SAME_FACTION: 400,
  FACTION_COOLDOWN: 409,
  INSUFFICIENT_GP: 402,
};
function handleErr(res, err, ctx) {
  const status = ERROR_STATUS[err.message] || 500;
  if (status === 500) console.error(`[faction] ${ctx}:`, err);
  res.status(status).json({ error: err.message, meta: err.meta });
}

// ─────────────────────────────────────────────────────────────

/** GET /api/factions — 파벌 목록 (로그인 시 내 선택 포함) */
router.get('/', async (req, res) => {
  try {
    let wallet = null;
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        wallet = decoded.wallet_address || decoded.wallet;
      }
    } catch { }
    const data = await faction.getFactions(wallet);
    res.json(data);
  } catch (err) { handleErr(res, err, 'list'); }
});

/** GET /api/factions/stats — 파벌별 세력 균형 (공개) */
router.get('/stats', async (req, res) => {
  try {
    const stats = await faction.getFactionStats();
    res.json({ factions: stats });
  } catch (err) { handleErr(res, err, 'stats'); }
});

/** POST /api/factions/choose — 파벌 선택/변경 */
router.post('/choose', requireAuth, async (req, res) => {
  try {
    const { faction_code } = req.body || {};
    if (!faction_code) return res.status(400).json({ error: 'FACTION_CODE_REQUIRED' });
    const result = await faction.chooseFaction(getWallet(req), faction_code);
    res.json(result);
  } catch (err) { handleErr(res, err, 'choose'); }
});

module.exports = router;

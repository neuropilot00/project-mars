// server/routes/factions.js
// ═══════════════════════════════════════════════════════════
// Faction API Routes
//
// GET  /api/factions           — 전체 파벌 목록
// GET  /api/factions/mine      — 내 파벌 (로그인 필요)
// POST /api/factions/choose    — 파벌 선택/변경 (로그인 필요)
// GET  /api/factions/stats     — 파벌별 통계
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const factionService = require('../services/faction');

// ─── 인증 미들웨어 ───
// 이 프로젝트의 auth.js는 requireAuth를 export하지 않으므로 인라인 JWT 검증 사용
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

/**
 * GET /api/factions
 * 전체 파벌 목록 (파벌 선택 화면용)
 */
router.get('/', async (req, res) => {
  try {
    const factions = await factionService.listFactions();
    res.json({ factions });
  } catch (err) {
    console.error('[factions] list error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/factions/mine
 * 내 현재 파벌 정보
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    
    const faction = await factionService.getUserFaction(wallet);
    res.json({ faction });
  } catch (err) {
    console.error('[factions] getUserFaction error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/factions/choose
 * 파벌 선택/변경
 * body: { faction_code: 'mcc' | 'fsp' | 'cv' }
 */
router.post('/choose', requireAuth, async (req, res) => {
  try {
    const wallet = req.user.wallet_address || req.user.wallet || req.user.walletAddress;
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });
    
    const { faction_code } = req.body;
    if (!faction_code) {
      return res.status(400).json({ error: 'FACTION_CODE_REQUIRED' });
    }
    
    const result = await factionService.chooseFaction(wallet, faction_code);
    res.json(result);
  } catch (err) {
    // 비즈니스 로직 에러는 400/409로
    if (err.message === 'INVALID_FACTION')          return res.status(400).json({ error: err.message });
    if (err.message === 'USER_NOT_FOUND')           return res.status(404).json({ error: err.message });
    if (err.message === 'SAME_FACTION')             return res.status(409).json({ error: err.message });
    if (err.message === 'FACTION_CHANGE_COOLDOWN')  return res.status(409).json({ error: err.message, meta: err.meta });
    if (err.message === 'INSUFFICIENT_GP')          return res.status(402).json({ error: err.message, meta: err.meta });
    
    console.error('[factions] choose error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/factions/stats
 * 파벌별 유저 수 · 함선 수 통계
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await factionService.getFactionStats();
    res.json({ stats });
  } catch (err) {
    console.error('[factions] stats error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

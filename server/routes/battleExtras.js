// server/routes/battleExtras.js
// ═══════════════════════════════════════════════════════════════
// Battle Extras API (Phase B)
//
// 기존 /api/battles 에 추가로 mount할 추가 엔드포인트들:
//   GET  /api/battles/:id/rewards      — 전투 보상 내역
//   GET  /api/battles/rewards/mine     — 내 보상 이력
//   GET  /api/battles/siege/mine       — 내 siege 전투 목록
//   POST /api/battles/siege/create     — siege 전투 생성 (관리자/테스트)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool } = require('../db');
const battleRewards = require('../services/battleRewards');
const siegeFleetBridge = require('../services/siegeFleetBridge');

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many battle requests. Please slow down.' }
});
const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many battle actions. Please wait.' }
});

// ── 인증 (inline JWT) ──
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

/**
 * GET /api/battles/rewards/mine
 * 내 보상 이력 전체
 * ⚠ 반드시 /:id/rewards 보다 먼저 등록 (Express 라우트 우선순위)
 */
router.get('/rewards/mine', requireAuth, readLimiter, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const rewards = await battleRewards.getUserRewardHistory(wallet, limit);

    const totalGp = rewards.reduce((sum, r) => sum + parseInt(r.gp_awarded || 0), 0);

    res.json({
      rewards,
      total_count: rewards.length,
      total_gp: totalGp,
    });
  } catch (err) {
    console.error('[battleExtras] my rewards error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/siege/mine
 * 내가 참여한 진행 중 siege 전투들
 */
router.get('/siege/mine', requireAuth, readLimiter, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const battles = await siegeFleetBridge.getMySiegeBattles(wallet);
    res.json({ battles });
  } catch (err) {
    console.error('[battleExtras] siege mine error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/battles/siege/create
 * Siege 전투 생성 (관리자/테스트용)
 * [v7.61] requireAdmin 추가 — 일반 유저가 임의 fleet ID로 타인 fleet 강제 전투 등록하는 경로 차단
 */
router.post('/siege/create', (req, res, next) => {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'FORBIDDEN' });
  next();
}, requireAuth, writeLimiter, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const {
      governor_siege_id, def_wallet,
      atk_fleet_id, def_fleet_id,
      sector_id, claim_id,
      delay_hours,
    } = req.body || {};

    const battleId = await siegeFleetBridge.createSiegeBattle({
      governor_siege_id,
      atk_wallet: wallet,
      def_wallet,
      atk_fleet_id, def_fleet_id,
      sector_id, claim_id,
      delay_hours: delay_hours || 24,
    });

    res.json({ success: true, battle_id: battleId });
  } catch (err) {
    const msgMap = {
      'MISSING_PARAMS':       400,
      'ATK_FLEET_NOT_FOUND':  404,
      'DEF_FLEET_NOT_FOUND':  404,
      'ATK_FLEET_IN_BATTLE':  409,
      'DEF_FLEET_IN_BATTLE':  409,
      'ATK_FLEET_MINING':     409,
      'DEF_FLEET_MINING':     409,
    };
    const status = msgMap[err.message];
    if (status) return res.status(status).json({ error: err.message });
    console.error('[battleExtras] siege create error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/battles/:id/rewards
 * 특정 전투의 보상 내역 (참가자별)
 */
router.get('/:id/rewards', readLimiter, async (req, res) => {
  try {
    const battleId = parseInt(req.params.id);
    if (!battleId) return res.status(400).json({ error: 'INVALID_ID' });

    const { rows } = await pool.query(`
      SELECT
        r.wallet_address, r.side, r.is_winner,
        r.gp_awarded, r.minerals_awarded, r.breakdown,
        r.created_at,
        u.nickname
      FROM fleet_battle_rewards r
      LEFT JOIN users u ON u.wallet_address = r.wallet_address
      WHERE r.battle_id = $1
      ORDER BY r.is_winner DESC, r.gp_awarded DESC
    `, [battleId]);

    res.json({ rewards: rows });
  } catch (err) {
    console.error('[battleExtras] rewards error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

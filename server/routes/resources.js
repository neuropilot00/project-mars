// server/routes/resources.js
// ═══════════════════════════════════════════════════════════════
// Resources API - 내 인벤토리 조회
//
// GET /api/resources/my      — 내 자원 인벤토리 (함선 UI용)
// GET /api/resources/catalog — 모든 자원 목록 (도감용)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ── 인증 미들웨어 (inline JWT — auth.js는 requireAuth를 export하지 않음) ──
const jwt = require('jsonwebtoken');
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
 * GET /api/resources/my
 * 내 자원 인벤토리 조회 (함선 UI용)
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const { rows } = await pool.query(`
      SELECT
        i.resource_code,
        i.quantity,
        r.name_ko,
        r.name_en,
        r.tier,
        r.icon_emoji,
        r.color_hex,
        r.is_craftable
      FROM user_resource_inventory i
      LEFT JOIN resources r ON r.code = i.resource_code
      WHERE i.wallet_address = $1
      ORDER BY r.tier NULLS LAST, r.code
    `, [wallet]);

    res.json({ inventory: rows });
  } catch (err) {
    console.error('[resources] my error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/resources/catalog
 * 모든 자원 목록 (도감용)
 */
router.get('/catalog', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT code, name_en, name_ko, tier, icon_emoji, color_hex,
             is_craftable, craft_recipe, craft_time_seconds,
             description_ko, rarity
      FROM resources
      WHERE is_active = true
      ORDER BY tier NULLS LAST, code
    `);
    res.json({ resources: rows });
  } catch (err) {
    console.error('[resources] catalog error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

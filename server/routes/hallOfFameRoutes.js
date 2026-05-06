// server/routes/hallOfFameRoutes.js
// ═══════════════════════════════════════════════════════════════
// Hall of Fame & 칭호 API
//
// GET  /api/titles/mine           — 내 칭호 목록
// POST /api/titles/equip          — 칭호 장착 (20 GP)
// GET  /api/titles/equipped/:wallet — 특정 유저 장착 칭호 (공개)
// GET  /api/hof                   — Hall of Fame 보드
// GET  /api/hof/:category         — 카테고리별 HoF
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const titleExt = require('../services/titleExtended');

// ── 인증 (inline JWT) ──
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};

function getWallet(req) {
  return req.user.wallet_address || req.user.wallet || req.user.walletAddress;
}

const ERROR_STATUS = {
  'TITLE_NOT_OWNED': 404,
  'INSUFFICIENT_GP': 402,
};

function handleErr(res, err, context) {
  const status = ERROR_STATUS[err.message];
  if (status) return res.status(status).json({ error: err.message });
  console.error(`[hallOfFameRoutes] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

async function getHallOfFameBoard({ category = null, seasonId = null, allTime = false, limit = 20 } = {}) {
  const { pool } = require('../db');
  const where = [];
  const params = [];

  if (category) {
    params.push(category);
    where.push(`h.category = $${params.length}`);
  }
  if (seasonId) {
    params.push(seasonId);
    where.push(`h.season_id = $${params.length}`);
  }
  if (allTime) {
    where.push('h.is_all_time = true');
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT h.*, u.nickname, u.wallet_address, g.name AS guild_name
    FROM hall_of_fame h
    LEFT JOIN users u ON u.wallet_address = h.user_wallet
    LEFT JOIN guilds g ON g.id = h.guild_id
    ${whereSql}
    ORDER BY h.is_featured DESC, h.achieved_at DESC
    LIMIT $${params.length}
  `, params);

  return rows;
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/titles/mine
 * 내 칭호 목록 전체
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const titles = await titleExt.getMyTitles(wallet);
    res.json({ titles });
  } catch (err) { handleErr(res, err, 'mine'); }
});

/**
 * POST /api/titles/equip
 * 칭호 장착 (20 GP)
 * Body: { title_code }
 */
router.post('/equip', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    const { title_code } = req.body || {};
    if (!title_code) return res.status(400).json({ error: 'TITLE_CODE_REQUIRED' });

    const result = await titleExt.equipTitle(wallet, title_code);
    res.json(result);
  } catch (err) { handleErr(res, err, 'equip'); }
});

/**
 * GET /api/titles/equipped/:wallet
 * 특정 유저의 장착 칭호 (공개, 인증 불필요)
 */
router.get('/equipped/:wallet', async (req, res) => {
  try {
    const { pool } = require('../db');
    const { rows } = await pool.query(`
      SELECT title_code, title_ko, title_en, earned_at
      FROM user_titles
      WHERE user_wallet = $1 AND is_equipped = true
      LIMIT 1
    `, [req.params.wallet]);

    res.json({ title: rows[0] || null });
  } catch (err) { handleErr(res, err, 'equipped'); }
});

/**
 * GET /api/hof?category=&seasonId=&allTime=true&limit=20
 * Hall of Fame 전체 보드
 */
router.get('/', async (req, res) => {
  try {
    const {
      category,
      seasonId,
      allTime,
      limit = 20,
    } = req.query;

    const board = await getHallOfFameBoard({
      category: category || null,
      seasonId: seasonId ? parseInt(seasonId) : null,
      allTime: allTime === 'true',
      limit: Math.min(50, parseInt(limit) || 20),
    });

    res.json({ hall_of_fame: board });
  } catch (err) { handleErr(res, err, 'board'); }
});

/**
 * GET /api/hof/:category
 * 카테고리별 Hall of Fame
 */
router.get('/:category', async (req, res) => {
  try {
    const board = await getHallOfFameBoard({
      category: req.params.category,
      limit: 10,
    });
    res.json({ hall_of_fame: board, category: req.params.category });
  } catch (err) { handleErr(res, err, 'category'); }
});

module.exports = router;

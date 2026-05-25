// server/routes/fleetSearch.js
// ═══════════════════════════════════════════════════════════════
// Fleet Search API (Phase B)
//
// GET /api/fleets/search?q=검색어
//   - 닉네임 또는 함대 이름으로 검색
//   - 로그인 필요 (남의 함대 검색 가능)
//   - 내 함대는 제외
//   - 전투 중인 함대는 표시하되 공격 불가 플래그
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const battleReport = require('../services/battleReport');

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
 * GET /api/fleets/search?q=...
 */
router.get('/search', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(400).json({ error: 'QUERY_TOO_SHORT', min: 2 });
    }
    if (q.length > 50) {
      return res.status(400).json({ error: 'QUERY_TOO_LONG' });
    }

    const searchPattern = `%${q.toLowerCase()}%`;

    // 닉네임 또는 함대명 매치
    const { rows } = await pool.query(`
      SELECT
        f.id AS fleet_id,
        f.name AS fleet_name,
        f.owner_wallet,
        f.formation,
        f.movement,
        f.is_in_battle,
        f.battles_won,
        f.battles_lost,
        u.nickname,
        u.faction_code,
        fa.name_ko AS faction_name,
        fa.color_primary AS faction_color,
        COUNT(s.id) FILTER (WHERE s.is_alive) AS ships_alive
      FROM fleets f
      JOIN users u ON u.wallet_address = f.owner_wallet
      LEFT JOIN factions fa ON fa.code = u.faction_code
      LEFT JOIN ships s ON s.fleet_id = f.id
      WHERE f.owner_wallet != $1
        AND (
          LOWER(u.nickname) LIKE $2 OR
          LOWER(f.name) LIKE $2 OR
          f.owner_wallet = $3
        )
      GROUP BY f.id, u.nickname, u.faction_code, fa.name_ko, fa.color_primary
      HAVING COUNT(s.id) FILTER (WHERE s.is_alive) > 0
      ORDER BY
        CASE WHEN LOWER(u.nickname) = LOWER($4) THEN 0 ELSE 1 END,
        f.battles_won DESC
      LIMIT 20
    `, [wallet, searchPattern, q, q]);

    res.json({
      query: q,
      results: rows.map(r => ({
        ...r,
        ships_alive: parseInt(r.ships_alive) || 0,
        can_attack: !r.is_in_battle && parseInt(r.ships_alive) > 0,
      }))
    });
  } catch (err) {
    console.error('[fleetSearch] error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * GET /api/fleets/search/opponents
 * 나에게 적합한 상대 추천 (전적이 비슷한 유저)
 */
router.get('/search/opponents', requireAuth, async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'NO_WALLET' });

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 12);
    const results = await battleReport.getRecommendedOpponents(wallet, limit);

    res.json({
      results: results.map(r => ({
        ...r,
        can_attack: true,
      }))
    });
  } catch (err) {
    console.error('[fleetSearch] opponents error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

module.exports = router;

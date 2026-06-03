// 킬보드 — 함선 격침 귀속 조회 (ship_wrecks). 배신 시스템 Phase 2 / 시스템3.
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/killboard — 최근 격침 (글로벌). 변절자(guild_betrayer) 피해자는 플래그.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const { rows } = await pool.query(
      `SELECT w.id, w.battle_id, w.ship_type, w.original_owner AS victim_wallet, w.killer_wallet,
              w.killer_side, w.victim_side, w.created_at,
              uk.nickname AS killer_nick, uv.nickname AS victim_nick,
              EXISTS(SELECT 1 FROM player_tags pt WHERE pt.wallet = w.original_owner AND pt.tag_id = 'guild_betrayer') AS victim_is_betrayer
         FROM ship_wrecks w
         LEFT JOIN users uk ON LOWER(uk.wallet_address) = w.killer_wallet
         LEFT JOIN users uv ON LOWER(uv.wallet_address) = w.original_owner
        WHERE w.killer_wallet IS NOT NULL
        ORDER BY w.created_at DESC
        LIMIT $1`, [limit]);
    res.json({ kills: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/killboard/:wallet — 특정 지갑 K/D 요약 + 최근 격침/피격
router.get('/:wallet', async (req, res) => {
  try {
    const w = (req.params.wallet || '').toLowerCase().trim();
    if (!w || w.length < 5) return res.status(400).json({ error: 'wallet_required' });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const [agg, kills, losses] = await Promise.all([
      pool.query(
        `SELECT (SELECT COUNT(*) FROM ship_wrecks WHERE killer_wallet = $1)  AS kills,
                (SELECT COUNT(*) FROM ship_wrecks WHERE original_owner = $1) AS losses`, [w]),
      pool.query(
        `SELECT battle_id, ship_type, original_owner AS victim_wallet, created_at
           FROM ship_wrecks WHERE killer_wallet = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
      pool.query(
        `SELECT battle_id, ship_type, killer_wallet, created_at
           FROM ship_wrecks WHERE original_owner = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
    ]);
    res.json({
      wallet: w,
      kills: parseInt(agg.rows[0].kills) || 0,
      losses: parseInt(agg.rows[0].losses) || 0,
      recentKills: kills.rows,
      recentLosses: losses.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

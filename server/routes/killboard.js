// 킬보드 — 함선 격침 귀속 조회 (ship_wrecks). 배신 시스템 Phase 2 / 시스템3.
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const resourceService = require('../services/resource');
let dailyOps;
try { dailyOps = require('./dailyOps'); } catch (_) { /* optional daily ops route helper */ }

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch (_) { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function authWallet(req) {
  return String(req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}
function fallbackWreckResources(shipValueGp, mods) {
  const value = Math.max(0, Number(shipValueGp) || 0);
  const modLevel = Math.max(0, Number(mods) || 0);
  const out = {};
  const add = (code, qty) => {
    qty = Math.floor(Number(qty) || 0);
    if (qty > 0) out[code] = (out[code] || 0) + qty;
  };
  add('iron_dust', Math.min(180, Math.max(1, Math.floor(value / 160))));
  add('hull_plate', Math.min(60, Math.floor(value / 800)));
  add('alloy_frame', Math.min(28, Math.floor(value / 2400)));
  add('plasma_coil', Math.min(12, Math.floor((value / 7000) + (modLevel / 5))));
  add('rare_metal', Math.min(8, Math.floor(value / 16000)));
  return out;
}
function dropsFromResourceMap(resources, shipValueGp, mods) {
  const src = resources && typeof resources === 'object' && !Array.isArray(resources)
    ? resources
    : fallbackWreckResources(shipValueGp, mods);
  let drops = Object.keys(src || {}).map(code => ({
    code,
    quantity: Math.max(0, Math.floor(Number(src[code]) || 0)),
  })).filter(d => d.quantity > 0);
  if (!drops.length) {
    const fb = fallbackWreckResources(shipValueGp, mods);
    drops = Object.keys(fb).map(code => ({ code, quantity: fb[code] })).filter(d => d.quantity > 0);
  }
  return drops;
}

// GET /api/killboard — 최근 격침 (글로벌). 변절자(guild_betrayer) 피해자는 플래그.
router.get('/', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 100));
    const { rows } = await pool.query(
      `SELECT w.id, w.battle_id, w.ship_type, w.ship_name, w.ship_value_gp, w.mods,
              w.original_owner AS victim_wallet, w.killer_wallet,
              w.killer_side, w.victim_side, w.resources, w.salvaged_by, w.salvaged_at, w.expires_at, w.created_at,
              uk.nickname AS killer_nick, uv.nickname AS victim_nick,
              (SELECT COALESCE(SUM(bl.reward_gp), 0) FROM bounty_listings bl
                WHERE LOWER(bl.target_wallet) = LOWER(w.original_owner)
                  AND bl.status = 'active'
                  AND (bl.expires_at IS NULL OR bl.expires_at > NOW())) AS active_bounty_gp,
              EXISTS(SELECT 1 FROM player_tags pt WHERE LOWER(pt.wallet) = LOWER(w.original_owner) AND pt.tag_id = 'guild_betrayer') AS victim_is_betrayer
         FROM ship_wrecks w
         LEFT JOIN users uk ON LOWER(uk.wallet_address) = w.killer_wallet
         LEFT JOIN users uv ON LOWER(uv.wallet_address) = w.original_owner
        WHERE w.killer_wallet IS NOT NULL
        ORDER BY w.created_at DESC
        LIMIT $1`, [limit]);
    res.json({ kills: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/killboard/:id/salvage — killer can recover one wreck once before expiry.
router.post('/:id/salvage', requireAuth, async (req, res) => {
  const wallet = authWallet(req);
  const id = parseInt(req.params.id, 10);
  if (!wallet || wallet.length < 5) return res.status(401).json({ error: 'NO_WALLET' });
  if (!id) return res.status(400).json({ error: 'INVALID_ID' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, killer_wallet, resources, ship_value_gp, mods, salvaged_by, expires_at
         FROM ship_wrecks WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const wreck = rows[0];
    if (!wreck) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'WRECK_NOT_FOUND' }); }
    if (String(wreck.killer_wallet || '').toLowerCase() !== wallet) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'NOT_KILLER' });
    }
    if (wreck.salvaged_by) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ALREADY_SALVAGED' });
    }
    if (wreck.expires_at && new Date(wreck.expires_at).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'WRECK_EXPIRED' });
    }
    const drops = dropsFromResourceMap(wreck.resources, wreck.ship_value_gp, wreck.mods);
    if (drops.length) await resourceService.addResourcesToInventory(client, wallet, drops);
    await client.query(
      `UPDATE ship_wrecks SET salvaged_by = $1, salvaged_at = NOW(), resources = $2::jsonb WHERE id = $3`,
      [wallet, JSON.stringify(Object.fromEntries(drops.map(d => [d.code, d.quantity]))), id]
    );
    await client.query('COMMIT');
    if (dailyOps && typeof dailyOps.notifyMissionProgress === 'function') {
      dailyOps.notifyMissionProgress(wallet, 'salvage_wreck').catch(() => {});
      dailyOps.notifyMissionProgress(wallet, 'salvage_wreck_3').catch(() => {});
    }
    res.json({ success: true, drops });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[killboard] salvage error:', e.message);
    res.status(500).json({ error: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
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
                (SELECT COUNT(*) FROM ship_wrecks WHERE original_owner = $1) AS losses,
                (SELECT COALESCE(SUM(ship_value_gp),0) FROM ship_wrecks WHERE killer_wallet = $1)  AS destroyed_value,
                (SELECT COALESCE(SUM(ship_value_gp),0) FROM ship_wrecks WHERE original_owner = $1) AS lost_value,
                (SELECT COALESCE(MAX(ship_value_gp),0) FROM ship_wrecks WHERE killer_wallet = $1)  AS best_kill_value`, [w]),
      pool.query(
        `SELECT battle_id, ship_type, ship_name, ship_value_gp, mods, original_owner AS victim_wallet, created_at
           FROM ship_wrecks WHERE killer_wallet = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
      pool.query(
        `SELECT battle_id, ship_type, ship_name, ship_value_gp, mods, killer_wallet, created_at
           FROM ship_wrecks WHERE original_owner = $1 ORDER BY created_at DESC LIMIT $2`, [w, limit]),
    ]);
    res.json({
      wallet: w,
      kills: parseInt(agg.rows[0].kills) || 0,
      losses: parseInt(agg.rows[0].losses) || 0,
      destroyedValue: parseInt(agg.rows[0].destroyed_value) || 0,
      lostValue: parseInt(agg.rows[0].lost_value) || 0,
      bestKillValue: parseInt(agg.rows[0].best_kill_value) || 0,
      recentKills: kills.rows,
      recentLosses: losses.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

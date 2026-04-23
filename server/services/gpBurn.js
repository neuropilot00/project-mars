'use strict';
/**
 * GP Burn Service — Migration 108
 * Players permanently destroy GP for exclusive time-limited buffs.
 * Pure economic sink — no refund, no rollover.
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('./notifications').notifyPlayer; } catch (_) {}
let seasonService;
try { seasonService = require('./season'); } catch (_) {}
let newsService;
try { newsService = require('./news'); } catch (_) {}

// ── Burn type definitions ─────────────────────────────────────────────────────

const BURN_TYPES = [
  { key: 'power_surge',    icon: '⚡', name: 'Power Surge',    desc: '2× GP earning from all sources',    color: '#FFD166', costKey: 'burn_power_surge_cost',     hoursKey: 'burn_power_surge_hours',     multKey: 'burn_power_surge_mult' },
  { key: 'territory_aura', icon: '✨', name: 'Territory Aura', desc: 'Glowing aura on your territories',  color: '#a064dc', costKey: 'burn_territory_aura_cost',  hoursKey: 'burn_territory_aura_hours',  multKey: null },
  { key: 'lucky_streak',   icon: '🍀', name: 'Lucky Streak',   desc: '+50% POI drop rate',                color: '#4cd89a', costKey: 'burn_lucky_streak_cost',   hoursKey: 'burn_lucky_streak_hours',   multKey: 'burn_lucky_streak_mult' },
  { key: 'battle_frenzy',  icon: '⚔️', name: 'Battle Frenzy',  desc: '+30% GP from battle wins',          color: '#E84855', costKey: 'burn_battle_frenzy_cost',  hoursKey: 'burn_battle_frenzy_hours',  multKey: 'burn_battle_frenzy_mult' },
  { key: 'harvest_boost',  icon: '⛏️', name: 'Harvest Boost',  desc: '+40% PP from territory harvests',   color: '#5BB8E8', costKey: 'burn_harvest_boost_cost',  hoursKey: 'burn_harvest_boost_hours',  multKey: 'burn_harvest_boost_mult' },
];

// ── Settings helper ───────────────────────────────────────────────────────────

async function getSettings() {
  const allKeys = ['burn_enabled', ...BURN_TYPES.flatMap(t => [t.costKey, t.hoursKey, ...(t.multKey ? [t.multKey] : [])])];
  const res = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [allKeys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

// ── Get burn catalog ──────────────────────────────────────────────────────────

async function getBurnCatalog(wallet) {
  const cfg = await getSettings();

  if ((cfg.burn_enabled || 'true') === 'false') {
    return { enabled: false, types: [] };
  }

  // Get active burns for this wallet
  let activeMap = {};
  if (wallet) {
    await pool.query(
      `DELETE FROM gp_burn_active WHERE wallet = $1 AND expires_at <= NOW()`,
      [wallet.toLowerCase()]
    );
    const activeRes = await pool.query(
      `SELECT burn_type, multiplier, expires_at FROM gp_burn_active WHERE wallet = $1`,
      [wallet.toLowerCase()]
    );
    activeRes.rows.forEach(r => { activeMap[r.burn_type] = r; });
  }

  const types = BURN_TYPES.map(t => {
    const cost  = parseFloat(cfg[t.costKey])  || 0;
    const hours = parseInt(cfg[t.hoursKey])   || 0;
    const mult  = t.multKey ? (parseFloat(cfg[t.multKey]) || 1.0) : 1.0;
    const active = activeMap[t.key] || null;
    return {
      key:       t.key,
      icon:      t.icon,
      name:      t.name,
      desc:      t.desc,
      color:     t.color,
      cost,
      hours,
      mult,
      active:    !!active,
      expires_at: active ? active.expires_at : null,
      seconds_remaining: active ? Math.max(0, Math.floor((new Date(active.expires_at) - Date.now()) / 1000)) : 0,
    };
  });

  return { enabled: true, types };
}

// ── Execute burn ──────────────────────────────────────────────────────────────

/**
 * Burn GP for a specific buff.
 * @param {object} client - pg client (BEGIN already called)
 * @param {string} wallet
 * @param {string} burnType
 */
async function burnGP(client, wallet, burnType) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  if ((cfg.burn_enabled || 'true') === 'false') {
    throw new Error('GP burn is currently disabled');
  }

  const typeDef = BURN_TYPES.find(t => t.key === burnType);
  if (!typeDef) throw new Error(`Unknown burn type: ${burnType}`);

  const cost   = parseFloat(cfg[typeDef.costKey]);
  const hours  = parseInt(cfg[typeDef.hoursKey]);
  const mult   = typeDef.multKey ? (parseFloat(cfg[typeDef.multKey]) || 1.0) : 1.0;

  if (!cost || !hours) throw new Error('Burn type not configured');

  // Check GP balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < cost) {
    throw new Error(`Insufficient GP: need ${cost}, have ${balance.toFixed(2)}`);
  }

  // Check if already active — allow re-burning to extend
  const existingRes = await client.query(
    `SELECT id, expires_at FROM gp_burn_active WHERE wallet = $1 AND burn_type = $2`,
    [w, burnType]
  );
  const existing = existingRes.rows[0] || null;

  // Deduct GP (burned = gone forever)
  await client.query(
    `UPDATE users SET gp_balance = gp_balance - $2 WHERE wallet_address = $1`,
    [w, cost]
  );

  // Calculate new expiry
  let expiresAt;
  if (existing) {
    // Extend from current expiry or now, whichever is later
    const base = new Date(existing.expires_at) > new Date() ? new Date(existing.expires_at) : new Date();
    expiresAt = new Date(base.getTime() + hours * 3600 * 1000);
  } else {
    expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  }

  // Log the burn
  const logRes = await client.query(
    `INSERT INTO gp_burn_log (wallet, burn_type, gp_burned, duration_h, expires_at, meta)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [w, burnType, cost, hours, expiresAt, JSON.stringify({ name: typeDef.name, mult, extended: !!existing })]
  );
  const logId = logRes.rows[0].id;

  // Upsert active effect
  if (existing) {
    await client.query(
      `UPDATE gp_burn_active SET expires_at = $3, multiplier = $4, burn_log_id = $5 WHERE wallet = $1 AND burn_type = $2`,
      [w, burnType, expiresAt, mult, logId]
    );
  } else {
    await client.query(
      `INSERT INTO gp_burn_active (wallet, burn_type, multiplier, expires_at, burn_log_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [w, burnType, mult, expiresAt, logId]
    );
  }

  // Dividend pool: route portion of burned GP
  try { const divSvc = require('./dividends'); divSvc.addToPool(cost, 'burn').catch(() => {}); } catch (_dv) {}

  return { burnType, cost, hours, mult, expiresAt, extended: !!existing, name: typeDef.name, icon: typeDef.icon };
}

// ── Check active effect ───────────────────────────────────────────────────────

/**
 * Get the active multiplier for a specific burn type for a wallet.
 * Returns 1.0 if no active effect.
 */
async function getActiveMultiplier(wallet, burnType) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT multiplier FROM gp_burn_active WHERE wallet = $1 AND burn_type = $2 AND expires_at > NOW()`,
    [w, burnType]
  );
  return parseFloat(res.rows[0]?.multiplier) || 1.0;
}

/**
 * Get all active burn effects for a wallet as a map of type→multiplier.
 */
async function getActiveEffects(wallet) {
  const w = wallet.toLowerCase();
  // Expire stale first
  await pool.query(`DELETE FROM gp_burn_active WHERE wallet = $1 AND expires_at <= NOW()`, [w]);
  const res = await pool.query(
    `SELECT burn_type, multiplier, expires_at FROM gp_burn_active WHERE wallet = $1`,
    [w]
  );
  const map = {};
  res.rows.forEach(r => { map[r.burn_type] = { multiplier: parseFloat(r.multiplier), expires_at: r.expires_at }; });
  return map;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanExpiredBurns() {
  const res = await pool.query(
    `DELETE FROM gp_burn_active WHERE expires_at <= NOW() RETURNING id`
  );
  return res.rowCount;
}

// ── Admin stats ───────────────────────────────────────────────────────────────

async function getAdminStats() {
  const [totalsRes, byTypeRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)              AS total_burns,
             COALESCE(SUM(gp_burned), 0) AS total_gp_burned,
             COUNT(DISTINCT wallet) AS unique_burners
        FROM gp_burn_log
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT burn_type, COUNT(*) AS cnt, COALESCE(SUM(gp_burned), 0) AS total_burned
        FROM gp_burn_log
       GROUP BY burn_type ORDER BY total_burned DESC
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT l.wallet, l.burn_type, l.gp_burned, l.created_at, u.nickname
        FROM gp_burn_log l
        LEFT JOIN users u ON u.wallet_address = l.wallet
       ORDER BY l.created_at DESC LIMIT 20
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'burn_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const t = totalsRes.rows[0] || {};
  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    total_burns:     parseInt(t.total_burns)     || 0,
    total_gp_burned: parseFloat(t.total_gp_burned) || 0,
    unique_burners:  parseInt(t.unique_burners)  || 0,
    by_type:         byTypeRes.rows,
    recent_burns:    recentRes.rows,
    settings:        settingsMap,
  };
}

module.exports = {
  getBurnCatalog,
  burnGP,
  getActiveMultiplier,
  getActiveEffects,
  cleanExpiredBurns,
  getAdminStats,
  BURN_TYPES,
};

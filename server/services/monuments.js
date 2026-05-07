'use strict';
/**
 * Territory Monument Service — Migration 111
 * Players permanently burn GP to place named monuments on their territories.
 * Visible on the map, destroyed on territory loss (unless preserved).
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('../db').notifyPlayer; } catch (_) {}
let newsService;
try { newsService = require('./news'); } catch (_) {}
let divSvc;
try { divSvc = require('./dividends'); } catch (_) {}

// ── Monument types ────────────────────────────────────────────────────────────

const MONUMENT_TYPES = {
  pillar:   { icon: '🗿', name: 'Pillar',   desc: 'A simple stone pillar' },
  obelisk:  { icon: '⬆️', name: 'Obelisk',  desc: 'A tall pointed monument' },
  shrine:   { icon: '⛩️', name: 'Shrine',   desc: 'A sacred shrine' },
  beacon:   { icon: '🔦', name: 'Beacon',   desc: 'A glowing beacon tower' },
  fortress: { icon: '🏰', name: 'Fortress', desc: 'A miniature fortress replica' },
};

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const keys = [
    'monument_enabled', 'monument_cost_base', 'monument_cost_per_pixel',
    'monument_max_per_wallet', 'monument_max_per_claim', 'monument_preserve_cost',
    'monument_name_max_len', 'monument_msg_max_len',
  ];
  const res = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });
  return {
    enabled:        (map.monument_enabled || 'true') !== 'false',
    costBase:       parseFloat(map.monument_cost_base)       || 150,
    costPerPixel:   parseFloat(map.monument_cost_per_pixel)  || 0.5,
    maxPerWallet:   parseInt(map.monument_max_per_wallet)    || 10,
    maxPerClaim:    parseInt(map.monument_max_per_claim)     || 1,
    preserveCost:   parseFloat(map.monument_preserve_cost)   || 50,
    nameMaxLen:     parseInt(map.monument_name_max_len)      || 60,
    msgMaxLen:      parseInt(map.monument_msg_max_len)       || 200,
  };
}

// ── Cost calculation ──────────────────────────────────────────────────────────

async function calculateCost(claimId, cfg = null) {
  if (!cfg) cfg = await getSettings();
  const claimRes = await pool.query(
    `SELECT width * height AS pixel_count FROM claims WHERE id = $1 AND deleted_at IS NULL`,
    [claimId]
  );
  if (!claimRes.rows.length) throw new Error('Claim not found');
  const pixels = parseInt(claimRes.rows[0].pixel_count) || 1;
  return +(cfg.costBase + pixels * cfg.costPerPixel).toFixed(2);
}

// ── Place monument ────────────────────────────────────────────────────────────

async function placeMonument(client, wallet, claimId, monumentType, name, message) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  if (!cfg.enabled) throw new Error('Monument system is currently disabled');

  // Validate type
  if (!MONUMENT_TYPES[monumentType]) throw new Error(`Unknown monument type: ${monumentType}`);

  // Validate name/message length
  const trimName = (name || '').trim().slice(0, cfg.nameMaxLen);
  if (!trimName) throw new Error('Monument name is required');
  const trimMsg = (message || '').trim().slice(0, cfg.msgMaxLen);

  // Verify ownership
  const claimRes = await client.query(
    `SELECT id, owner, width, height, width * height AS pixel_count
       FROM claims WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
    [claimId]
  );
  if (!claimRes.rows.length) throw new Error('Territory not found');
  const claim = claimRes.rows[0];
  if (claim.owner.toLowerCase() !== w) throw new Error('You do not own this territory');

  // Check per-wallet limit
  const walletCount = await client.query(
    `SELECT COUNT(*) AS n FROM territory_monuments WHERE owner = $1 AND is_active = true`,
    [w]
  );
  if (parseInt(walletCount.rows[0]?.n) >= cfg.maxPerWallet) {
    throw new Error(`Maximum ${cfg.maxPerWallet} active monuments per wallet`);
  }

  // Check per-claim limit
  if (cfg.maxPerClaim > 0) {
    const claimCount = await client.query(
      `SELECT COUNT(*) AS n FROM territory_monuments WHERE claim_id = $1 AND is_active = true`,
      [claimId]
    );
    if (parseInt(claimCount.rows[0]?.n) >= cfg.maxPerClaim) {
      throw new Error(`This territory already has a monument`);
    }
  }

  // Calculate cost
  const pixels = parseInt(claim.pixel_count) || 1;
  const cost = +(cfg.costBase + pixels * cfg.costPerPixel).toFixed(2);

  // Check balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < cost) throw new Error(`Insufficient GP: need ${cost}, have ${balance.toFixed(2)}`);

  // Deduct GP
  const monDeduct = await client.query(
    `UPDATE users SET gp_balance = gp_balance - $2 WHERE LOWER(wallet_address) = LOWER($1) AND gp_balance >= $2`,
    [w, cost]
  );
  if (monDeduct.rowCount === 0) throw new Error('INSUFFICIENT_GP');

  // Create monument
  const ins = await client.query(
    `INSERT INTO territory_monuments (claim_id, owner, monument_type, name, message, icon, gp_spent)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [claimId, w, monumentType, trimName, trimMsg || null, MONUMENT_TYPES[monumentType].icon, cost]
  );

  return { monument: ins.rows[0], cost };
}

// ── Destroy monument (on hijack) ──────────────────────────────────────────────

/**
 * Destroy all monuments on a claim when it's hijacked.
 * @returns {object[]} monuments that were destroyed (for notification to original owners)
 */
async function destroyClaimMonuments(client, claimId, attackerWallet = null) {
  const res = await client.query(
    `UPDATE territory_monuments
        SET is_active = false, destroyed_at = NOW()
      WHERE claim_id = $1 AND is_active = true
      RETURNING *`,
    [claimId]
  );

  // Notify original owners
  for (const m of res.rows) {
    if (notifyPlayer) {
      notifyPlayer(m.owner, `🏴 Your monument "${m.name}" was destroyed when your territory was taken!`, 'monument').catch(() => {});
    }
  }

  return res.rows;
}

/**
 * Attacker preserves a monument instead of destroying it (pay GP cost).
 */
async function preserveMonument(client, wallet, monumentId) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  const mRes = await client.query(
    `SELECT * FROM territory_monuments WHERE id = $1 AND is_active = true FOR UPDATE`,
    [monumentId]
  );
  if (!mRes.rows.length) throw new Error('Monument not found or already inactive');
  const monument = mRes.rows[0];

  // Check attacker owns the territory now
  const claimRes = await client.query(
    `SELECT owner FROM claims WHERE id = $1 AND deleted_at IS NULL`,
    [monument.claim_id]
  );
  if (!claimRes.rows.length) throw new Error('Territory not found');
  if (claimRes.rows[0].owner.toLowerCase() !== w) throw new Error('You must own the territory to preserve its monument');

  const cost = cfg.preserveCost;
  const userRes = await client.query(`SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]);
  if (!userRes.rows.length) throw new Error('User not found');
  if (parseFloat(userRes.rows[0].gp_balance) < cost) throw new Error(`Need ${cost} GP to preserve monument`);

  const preDeduct = await client.query(`UPDATE users SET gp_balance = gp_balance - $2 WHERE LOWER(wallet_address) = LOWER($1) AND gp_balance >= $2`, [w, cost]);
  if (preDeduct.rowCount === 0) throw new Error('INSUFFICIENT_GP');
  await client.query(
    `UPDATE territory_monuments SET preserved_by = $2 WHERE id = $1`,
    [monumentId, w]
  );

  // Notify original owner
  if (notifyPlayer) {
    notifyPlayer(monument.owner, `✨ ${w.slice(0,8)}... preserved your monument "${monument.name}"!`, 'monument').catch(() => {});
  }

  return { cost, monument };
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getMonument(claimId) {
  const res = await pool.query(
    `SELECT m.*, u.nickname AS owner_nick
       FROM territory_monuments m
       LEFT JOIN users u ON u.wallet_address = m.owner
      WHERE m.claim_id = $1 AND m.is_active = true
      LIMIT 1`,
    [claimId]
  );
  return res.rows[0] || null;
}

async function getMyMonuments(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT m.*, c.center_lng AS sector_x, c.center_lat AS sector_y, c.width, c.height,
            (c.deleted_at IS NOT NULL) AS territory_lost
       FROM territory_monuments m
       LEFT JOIN claims c ON c.id = m.claim_id
      WHERE m.owner = $1
      ORDER BY m.created_at DESC`,
    [w]
  );
  return res.rows;
}

async function getRecentMonuments(limit = 20) {
  const res = await pool.query(
    `SELECT m.*, u.nickname AS owner_nick, c.center_lng AS sector_x, c.center_lat AS sector_y
       FROM territory_monuments m
       LEFT JOIN users u ON u.wallet_address = m.owner
       LEFT JOIN claims c ON c.id = m.claim_id
      WHERE m.is_active = true
      ORDER BY m.created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function getMonumentTypes() {
  return Object.entries(MONUMENT_TYPES).map(([key, val]) => ({ key, ...val }));
}

async function getAdminStats() {
  const [totalsRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                                    AS total,
             COUNT(*) FILTER (WHERE is_active)          AS active,
             COALESCE(SUM(gp_spent), 0)                 AS total_gp_spent,
             COUNT(*) FILTER (WHERE destroyed_at IS NOT NULL) AS destroyed
        FROM territory_monuments
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT m.*, u.nickname AS owner_nick
        FROM territory_monuments m
        LEFT JOIN users u ON u.wallet_address = m.owner
       ORDER BY m.created_at DESC LIMIT 30
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'monument_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const t = totalsRes.rows[0] || {};
  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    total:       parseInt(t.total)       || 0,
    active:      parseInt(t.active)      || 0,
    total_gp:    parseFloat(t.total_gp_spent) || 0,
    destroyed:   parseInt(t.destroyed)   || 0,
    recent:      recentRes.rows,
    settings:    settingsMap,
  };
}

module.exports = {
  placeMonument,
  destroyClaimMonuments,
  preserveMonument,
  getMonument,
  getMyMonuments,
  getRecentMonuments,
  getMonumentTypes,
  calculateCost,
  getAdminStats,
  MONUMENT_TYPES,
};

'use strict';
/**
 * Territory Shield Service — Migration 114
 * Players spend GP to activate a temporary hijack-prevention shield on their territory.
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('../db').notifyPlayer; } catch (_) {}

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const keys = [
    'shield_enabled', 'shield_options', 'shield_max_per_wallet', 'shield_stack_allowed',
    'shield_cost_6h', 'shield_cost_12h', 'shield_cost_24h', 'shield_cost_48h', 'shield_cost_72h',
  ];
  const res = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });

  const options = (map.shield_options || '6,12,24,48,72')
    .split(',').map(v => parseInt(v.trim())).filter(n => n > 0);

  const costs = {};
  options.forEach(h => {
    costs[h] = parseFloat(map[`shield_cost_${h}h`]) || (h * 12); // fallback: 12 GP/h
  });

  return {
    enabled:      (map.shield_enabled || 'true') !== 'false',
    options,
    costs,
    maxPerWallet: parseInt(map.shield_max_per_wallet) || 5,
    stackAllowed: (map.shield_stack_allowed || 'false') !== 'false',
  };
}

// ── Get catalog (options + costs) ─────────────────────────────────────────────

async function getShieldCatalog() {
  const cfg = await getSettings();
  return {
    enabled: cfg.enabled,
    options: cfg.options.map(h => ({
      hours: h,
      cost: cfg.costs[h],
      label: h < 24 ? `${h}h` : `${h / 24}d`,
    })),
  };
}

// ── Activate shield ───────────────────────────────────────────────────────────

async function activateShield(client, wallet, claimId, durationH) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  if (!cfg.enabled) throw new Error('Territory shield system is currently disabled');
  if (!cfg.options.includes(durationH)) throw new Error(`Invalid duration. Choose: ${cfg.options.join(', ')} hours`);
  const cost = cfg.costs[durationH];
  if (!cost) throw new Error('No cost configured for this duration');

  // Verify ownership
  const claimRes = await client.query(
    `SELECT id, owner FROM claims WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
    [claimId]
  );
  if (!claimRes.rows.length) throw new Error('Territory not found');
  if (claimRes.rows[0].owner.toLowerCase() !== w) throw new Error('You do not own this territory');

  // Check existing active shield
  const existingRes = await client.query(
    `SELECT id, expires_at FROM territory_shields WHERE claim_id = $1 AND is_active = true FOR UPDATE`,
    [claimId]
  );

  if (existingRes.rows.length > 0) {
    if (!cfg.stackAllowed) {
      // Replace: deactivate existing, create new
      await client.query(
        `UPDATE territory_shields SET is_active = false WHERE claim_id = $1 AND is_active = true`,
        [claimId]
      );
    }
    // If stacking: new shield starts from max(now, existing expiry) - complex, just replace for now
  }

  // Check per-wallet limit
  const countRes = await client.query(
    `SELECT COUNT(*) AS n FROM territory_shields WHERE owner = $1 AND is_active = true`, [w]
  );
  if (parseInt(countRes.rows[0]?.n) >= cfg.maxPerWallet) {
    throw new Error(`Maximum ${cfg.maxPerWallet} active shields per wallet`);
  }

  // Check balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < cost) throw new Error(`Insufficient GP: need ${cost}, have ${balance.toFixed(2)}`);

  // Deduct GP
  await client.query(`UPDATE users SET gp_balance = gp_balance - $2 WHERE wallet_address = $1`, [w, cost]);

  // Create shield
  const expiresAt = new Date(Date.now() + durationH * 3600 * 1000);
  const ins = await client.query(
    `INSERT INTO territory_shields (claim_id, owner, duration_h, gp_spent, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (claim_id) DO UPDATE
       SET owner = EXCLUDED.owner, duration_h = EXCLUDED.duration_h, gp_spent = EXCLUDED.gp_spent,
           activated_at = NOW(), expires_at = EXCLUDED.expires_at, is_active = true,
           broken_by = NULL, broken_at = NULL
     RETURNING *`,
    [claimId, w, durationH, cost, expiresAt]
  );

  return { shield: ins.rows[0], cost, expiresAt };
}

// ── Check if a claim is shielded (called in hijack validation) ────────────────

// ✅ [P0-1 FIX] 두 shield 테이블을 동시에 조회.
// territory_shields = GP shield 시스템, pixel_shields = 상점 아이템 shield.
// 이전엔 territory_shields 만 조회해 상점 shield 가 hijack 을 못 막던 버그.
async function isClaimShielded(claimId) {
  const res = await pool.query(
    `SELECT 'territory' AS src, id, expires_at FROM territory_shields
       WHERE claim_id = $1 AND is_active = true AND expires_at > NOW()
     UNION ALL
     SELECT 'pixel' AS src, id, expires_at FROM pixel_shields
       WHERE claim_id = $1 AND expires_at > NOW()
     LIMIT 1`,
    [claimId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * Same as above but using a transaction client (for use inside hijack transaction).
 */
async function isClaimShieldedTx(client, claimId) {
  const res = await client.query(
    `SELECT 'territory' AS src, id, expires_at FROM territory_shields
       WHERE claim_id = $1 AND is_active = true AND expires_at > NOW()
     UNION ALL
     SELECT 'pixel' AS src, id, expires_at FROM pixel_shields
       WHERE claim_id = $1 AND expires_at > NOW()
     LIMIT 1`,
    [claimId]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

// ── Expire stale shields (scheduler) ─────────────────────────────────────────

async function expireShields() {
  const res = await pool.query(
    `UPDATE territory_shields SET is_active = false
      WHERE is_active = true AND expires_at < NOW()
      RETURNING claim_id, owner, duration_h`
  );
  if (res.rows.length > 0) {
    console.log(`[Shield] Expired ${res.rows.length} shield(s)`);
    for (const s of res.rows) {
      if (notifyPlayer) {
        notifyPlayer(s.owner, `🛡️ Your ${s.duration_h}h territory shield has expired`, 'shield').catch(() => {});
      }
    }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getMyShields(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT s.*, c.center_lng AS sector_x, c.center_lat AS sector_y, c.width, c.height, c.custom_name
       FROM territory_shields s
       LEFT JOIN claims c ON c.id = s.claim_id
      WHERE s.owner = $1
      ORDER BY s.expires_at DESC
      LIMIT 20`,
    [w]
  );
  return res.rows;
}

async function getClaimShield(claimId) {
  const res = await pool.query(
    `SELECT * FROM territory_shields WHERE claim_id = $1 AND is_active = true AND expires_at > NOW() LIMIT 1`,
    [claimId]
  );
  return res.rows[0] || null;
}

async function getAdminStats() {
  const [totalsRes, recentRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                                  AS total,
             COUNT(*) FILTER (WHERE is_active AND expires_at > NOW()) AS active,
             COALESCE(SUM(gp_spent), 0)               AS total_gp,
             COUNT(*) FILTER (WHERE broken_at IS NOT NULL) AS broken
        FROM territory_shields
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT s.*, u.nickname AS owner_nick
        FROM territory_shields s
        LEFT JOIN users u ON u.wallet_address = s.owner
       ORDER BY s.activated_at DESC LIMIT 30
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'shield_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const t = totalsRes.rows[0] || {};
  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    total:    parseInt(t.total)   || 0,
    active:   parseInt(t.active)  || 0,
    total_gp: parseFloat(t.total_gp) || 0,
    broken:   parseInt(t.broken)  || 0,
    recent:   recentRes.rows,
    settings: settingsMap,
  };
}

module.exports = {
  activateShield,
  isClaimShielded,
  isClaimShieldedTx,
  expireShields,
  getShieldCatalog,
  getMyShields,
  getClaimShield,
  getAdminStats,
};

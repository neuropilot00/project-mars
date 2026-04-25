'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, maxLen, minDays, maxDays, maxPerWallet, visibleCount] = await Promise.all([
    getSetting('capsule_enabled',        'true'),
    getSetting('capsule_cost_gp',        '35'),
    getSetting('capsule_max_length',     '280'),
    getSetting('capsule_min_days',       '1'),
    getSetting('capsule_max_days',       '365'),
    getSetting('capsule_max_per_wallet', '5'),
    getSetting('capsule_visible_count',  '20'),
  ]);
  return {
    enabled:       enabled === 'true',
    costGP:        parseInt(costGP,        10),
    maxLen:        parseInt(maxLen,        10),
    minDays:       parseInt(minDays,       10),
    maxDays:       parseInt(maxDays,       10),
    maxPerWallet:  parseInt(maxPerWallet,  10),
    visibleCount:  parseInt(visibleCount,  10),
  };
}

// Reveal capsules whose reveal_at has passed
async function revealDueCapsules() {
  const { rows } = await pool.query(
    `UPDATE time_capsules
     SET is_revealed=true, revealed_at=NOW()
     WHERE is_revealed=false AND reveal_at <= NOW()
     RETURNING id, wallet, message, revealed_at`
  );
  return rows;
}

// Get recently revealed capsules (public feed)
async function getRevealed() {
  const cfg = await getCfg();
  const { rows } = await pool.query(
    `SELECT tc.id, tc.wallet, tc.message, tc.reveal_at, tc.revealed_at, tc.gp_paid,
            COALESCE(tc.nickname_snapshot, u.nickname, tc.wallet) AS nickname
     FROM time_capsules tc
     LEFT JOIN users u ON u.wallet_address = tc.wallet
     WHERE tc.is_revealed=true
     ORDER BY tc.revealed_at DESC LIMIT $1`,
    [cfg.visibleCount]
  );
  return rows;
}

// Get unrevealed capsule count + countdown for public (no message shown)
async function getUpcoming() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS pending,
            MIN(reveal_at) AS next_reveal
     FROM time_capsules
     WHERE is_revealed=false`
  );
  return rows[0] || { pending: 0, next_reveal: null };
}

// Player's own capsules (full message visible)
async function getMyCapsules(wallet) {
  const { rows } = await pool.query(
    `SELECT id, message, reveal_at, is_revealed, revealed_at, gp_paid, created_at
     FROM time_capsules
     WHERE wallet=$1
     ORDER BY created_at DESC`,
    [wallet]
  );
  return rows;
}

async function buryCapsule(wallet, message, revealInDays) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Time capsule system disabled');
  const trimmed = (message || '').trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length > cfg.maxLen) throw new Error(`Max ${cfg.maxLen} characters`);
  const days = parseInt(revealInDays, 10);
  if (isNaN(days) || days < cfg.minDays) throw new Error(`Minimum ${cfg.minDays} day(s)`);
  if (days > cfg.maxDays) throw new Error(`Maximum ${cfg.maxDays} days`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check per-wallet unrevealed limit
    const countRow = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM time_capsules WHERE wallet=$1 AND is_revealed=false`,
      [wallet]
    );
    if (countRow.rows[0].cnt >= cfg.maxPerWallet) {
      throw new Error(`Max ${cfg.maxPerWallet} unrevealed capsules per wallet`);
    }

    // Deduct GP
    const balRow = await client.query(
      `SELECT gp_balance, nickname FROM users WHERE wallet_address=$1 FOR UPDATE`, [wallet]
    );
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < cfg.costGP) throw new Error(`Need ${cfg.costGP} GP`);
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address=$2`,
      [cfg.costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, note)
       VALUES($1,$2,'capsule','Time Capsule burial')`,
      [wallet, -cfg.costGP]
    );

    // Insert capsule
    const revealAt = new Date(Date.now() + days * 86_400_000);
    const { rows } = await client.query(
      `INSERT INTO time_capsules(wallet, nickname_snapshot, message, reveal_at, gp_paid)
       VALUES($1, $2, $3, $4, $5) RETURNING id`,
      [wallet, balRow.rows[0].nickname || null, trimmed, revealAt, cfg.costGP]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, -cfg.costGP, 'capsule', `Time Capsule — reveals in ${days}d`);
    } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, cfg.costGP, 'capsule').catch(() => {});

    return { id: rows[0].id, revealAt, gpCost: cfg.costGP };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int                                                AS total,
            COUNT(*) FILTER(WHERE is_revealed)::int                     AS revealed,
            COUNT(*) FILTER(WHERE NOT is_revealed)::int                 AS pending,
            COALESCE(SUM(gp_paid), 0)::int                              AS total_gp_sunk
     FROM time_capsules`
  );
  const { rows: recent } = await pool.query(
    `SELECT tc.id, tc.wallet, tc.message, tc.gp_paid, tc.reveal_at,
            tc.is_revealed, tc.revealed_at,
            COALESCE(tc.nickname_snapshot, u.nickname, tc.wallet) AS nickname
     FROM time_capsules tc
     LEFT JOIN users u ON u.wallet_address = tc.wallet
     ORDER BY tc.created_at DESC LIMIT 30`
  );
  return { stats, recent };
}

async function adminDeleteCapsule(id) {
  await pool.query(`DELETE FROM time_capsules WHERE id=$1`, [id]);
}

module.exports = {
  getCfg, revealDueCapsules, getRevealed, getUpcoming,
  getMyCapsules, buryCapsule, getAdminStats, adminDeleteCapsule
};

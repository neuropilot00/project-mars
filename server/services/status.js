'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, durH, maxLen, maxDur, disc] = await Promise.all([
    getSetting('status_enabled',       'true'),
    getSetting('status_cost_gp',       '20'),
    getSetting('status_duration_h',    '24'),
    getSetting('status_max_length',    '60'),
    getSetting('status_max_duration_h','168'),
    getSetting('status_renewal_disc',  '0'),
  ]);
  return {
    enabled:    enabled === 'true',
    costGP:     parseInt(costGP, 10),
    durH:       parseInt(durH, 10),
    maxLen:     parseInt(maxLen, 10),
    maxDurH:    parseInt(maxDur, 10),
    renewalDisc: parseInt(disc, 10),  // % discount on renewal
  };
}

async function getMyStatus(wallet) {
  const { rows } = await pool.query(
    `SELECT status, gp_paid, expires_at FROM player_status WHERE wallet=$1`, [wallet]
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    status:   row.status,
    gpPaid:   row.gp_paid,
    expiresAt: row.expires_at,
    isActive: new Date(row.expires_at) > new Date(),
  };
}

async function getActiveStatuses() {
  const { rows } = await pool.query(
    `SELECT ps.wallet, COALESCE(u.nickname, ps.wallet) AS nickname, ps.status, ps.expires_at
     FROM player_status ps
     LEFT JOIN users u ON u.wallet = ps.wallet
     WHERE ps.expires_at > NOW()
     ORDER BY ps.updated_at DESC LIMIT 50`
  );
  return rows;
}

async function setStatus(wallet, statusText, durationH) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Status system disabled');
  if (!statusText || statusText.trim().length === 0) throw new Error('Status cannot be empty');
  statusText = statusText.trim();
  if (statusText.length > cfg.maxLen) throw new Error(`Max ${cfg.maxLen} characters`);
  durationH = Math.max(1, Math.min(cfg.maxDurH, parseInt(durationH, 10) || cfg.durH));

  // Cost: check for renewal discount
  const existing = await getMyStatus(wallet);
  const isRenewal = existing && existing.isActive;
  const disc = isRenewal ? cfg.renewalDisc : 0;
  const costGP = Math.max(1, Math.floor(cfg.costGP * (1 - disc / 100)));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRow = await client.query('SELECT gp_balance FROM users WHERE wallet=$1 FOR UPDATE', [wallet]);
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < costGP) throw new Error(`Need ${costGP} GP`);

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet=$2', [costGP, wallet]);

    const expiresAt = new Date(Date.now() + durationH * 3600000);
    await client.query(
      `INSERT INTO player_status(wallet, status, gp_paid, expires_at, updated_at)
       VALUES($1,$2,$3,$4,NOW())
       ON CONFLICT(wallet) DO UPDATE
         SET status=$2, gp_paid=$3, expires_at=$4, updated_at=NOW()`,
      [wallet, statusText, costGP, expiresAt]
    );

    await client.query(
      `INSERT INTO status_log(wallet, status, gp_paid, expires_at) VALUES($1,$2,$3,$4)`,
      [wallet, statusText, costGP, expiresAt]
    );

    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
       VALUES($1,$2,'status',NULL,'Status Message')`,
      [wallet, -costGP]
    );

    await client.query('COMMIT');
    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(wallet, -costGP, 'status', statusText.slice(0,20)); } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, costGP, 'status').catch(() => {});

    return { ok: true, expiresAt, costGP, isRenewal };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function clearStatus(wallet) {
  await pool.query(`DELETE FROM player_status WHERE wallet=$1`, [wallet]);
  return { ok: true };
}

async function expireStatuses() {
  const { rowCount } = await pool.query(
    `DELETE FROM player_status WHERE expires_at <= NOW()`
  );
  return rowCount;
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int AS total_statuses,
            COUNT(CASE WHEN expires_at > NOW() THEN 1 END)::int AS active_statuses,
            COALESCE(SUM(gp_paid),0)::int AS total_gp_sunk
     FROM player_status`
  );
  const { rows: log_stats } = await pool.query(
    `SELECT COALESCE(SUM(gp_paid),0)::int AS all_time_gp FROM status_log`
  );
  const { rows: recent } = await pool.query(
    `SELECT sl.wallet, COALESCE(u.nickname,sl.wallet) AS nickname, sl.status, sl.gp_paid, sl.expires_at, sl.created_at
     FROM status_log sl LEFT JOIN users u ON u.wallet=sl.wallet
     ORDER BY sl.created_at DESC LIMIT 20`
  );
  return { stats: { ...stats, all_time_gp: log_stats[0].all_time_gp }, recent };
}

module.exports = { getCfg, getMyStatus, getActiveStatuses, setStatus, clearStatus, expireStatuses, getAdminStats };

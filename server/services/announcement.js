'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, costGP, maxLen, maxDuration, cooldownH, maxActive] = await Promise.all([
    getSetting('announce_enabled',       'true'),
    getSetting('announce_cost_gp',       '80'),
    getSetting('announce_max_length',    '80'),
    getSetting('announce_max_duration_m','180'),
    getSetting('announce_cooldown_h',    '6'),
    getSetting('announce_max_active',    '3'),
  ]);
  return {
    enabled:     enabled === 'true',
    costGP:      parseInt(costGP,      10),
    maxLen:      parseInt(maxLen,      10),
    maxDuration: parseInt(maxDuration, 10),
    cooldownH:   parseInt(cooldownH,   10),
    maxActive:   parseInt(maxActive,   10),
  };
}

async function expireAnnouncements() {
  const { rows } = await pool.query(
    `UPDATE colony_announcements SET is_active=false
     WHERE is_active=true AND expires_at <= NOW()
     RETURNING id`
  );
  return rows;
}

async function getActiveAnnouncements() {
  const { rows } = await pool.query(`
    SELECT a.id, a.wallet, u.nickname AS player_name,
           a.message, a.gp_paid, a.duration_m, a.expires_at, a.created_at
    FROM colony_announcements a
    LEFT JOIN users u ON u.wallet_address = a.wallet
    WHERE a.is_active=true AND a.expires_at > NOW()
    ORDER BY a.gp_paid DESC, a.created_at DESC
    LIMIT 5
  `);
  return rows;
}

async function postAnnouncement(wallet, message, durationM) {
  if (!wallet) throw new Error('wallet required');
  if (!message || !message.trim()) throw new Error('message required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Colony announcements are disabled');

  const safeMsg = message.trim().slice(0, cfg.maxLen);
  const durM = Math.min(Math.max(parseInt(durationM, 10) || 30, 1), cfg.maxDuration);

  // Cost scales linearly with duration (30-min blocks)
  const blocks  = Math.ceil(durM / 30);
  const costGP  = cfg.costGP * blocks;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Global cap on active announcements
    const active = await client.query(
      `SELECT COUNT(*) FROM colony_announcements WHERE is_active=true AND expires_at > NOW()`
    );
    if (parseInt(active.rows[0].count, 10) >= cfg.maxActive)
      throw new Error(`Max ${cfg.maxActive} announcements active at once — try again later`);

    // Cooldown check
    if (cfg.cooldownH > 0) {
      const last = await client.query(
        `SELECT created_at FROM colony_announcements WHERE wallet=$1 ORDER BY created_at DESC LIMIT 1`,
        [wallet]
      );
      if (last.rows.length) {
        const elapsed = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 3600000;
        if (elapsed < cfg.cooldownH)
          throw new Error(`Cooldown active — next announcement in ${Math.ceil(cfg.cooldownH - elapsed)}h`);
      }
    }

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < costGP)
      throw new Error(`Insufficient GP (need ${costGP} for ${durM}min broadcast)`);

    const announceDeductRes = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [costGP, wallet]
    );
    if (announceDeductRes.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'announce', $3)`,
      [wallet, -costGP, `Colony announcement: "${safeMsg}" (${durM}min)`]
    );

    const expiresAt = new Date(Date.now() + durM * 60 * 1000);
    const ins = await client.query(
      `INSERT INTO colony_announcements (wallet, message, gp_paid, duration_m, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [wallet, safeMsg, costGP, durM, expiresAt]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', costGP, `announce: ${safeMsg}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, costGP, 'announce');
    } catch(_) {}

    return {
      success: true,
      id: ins.rows[0].id,
      costGP,
      durationM: durM,
      expiresAt,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getAdminStats() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM colony_announcements)                                                AS total,
      (SELECT COUNT(*) FROM colony_announcements WHERE is_active=true AND expires_at>NOW())      AS active,
      (SELECT SUM(gp_paid) FROM colony_announcements)                                            AS total_gp,
      (SELECT COUNT(*) FROM colony_announcements WHERE created_at > NOW()-INTERVAL '24h')        AS posted_24h
  `);
  const recent = await pool.query(`
    SELECT a.id, a.wallet, u.nickname, a.message, a.gp_paid, a.duration_m,
           a.is_active, a.expires_at, a.created_at
    FROM colony_announcements a
    LEFT JOIN users u ON u.wallet_address = a.wallet
    ORDER BY a.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminExpireAnnouncement(id) {
  await pool.query(
    'UPDATE colony_announcements SET is_active=false, expires_at=NOW() WHERE id=$1', [id]
  );
  return { success: true };
}

module.exports = {
  getCfg, expireAnnouncements, getActiveAnnouncements,
  postAnnouncement, getAdminStats, adminExpireAnnouncement
};

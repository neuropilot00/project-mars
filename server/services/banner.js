'use strict';
const { pool, getSetting } = require('../db');

const ALLOWED_EMOJIS = ['🚩','⚔️','👑','🏆','💎','🔥','⚡','🌟','🗡️','🛡️','🦅','🐉','💀','🎯','🏴'];

async function getCfg() {
  const [enabled, costGP, durD, maxLen, maxPer] = await Promise.all([
    getSetting('banner_enabled',      'true'),
    getSetting('banner_cost_gp',      '30'),
    getSetting('banner_duration_d',   '7'),
    getSetting('banner_max_length',   '50'),
    getSetting('banner_max_per_claim','3'),
  ]);
  return {
    enabled:  enabled === 'true',
    costGP:   parseInt(costGP,   10),
    durD:     parseInt(durD,     10),
    maxLen:   parseInt(maxLen,   10),
    maxPer:   parseInt(maxPer,   10),
    emojis:   ALLOWED_EMOJIS,
  };
}

async function expireBanners() {
  const { rows } = await pool.query(
    `UPDATE territory_banners SET is_active=false
     WHERE is_active=true AND expires_at <= NOW()
     RETURNING id`
  );
  return rows;
}

async function getActiveBanners(claimId) {
  const { rows } = await pool.query(`
    SELECT b.id, b.wallet, u.nickname AS player_name,
           b.emoji, b.message, b.gp_paid, b.expires_at, b.created_at
    FROM territory_banners b
    LEFT JOIN users u ON u.wallet = b.wallet
    WHERE b.claim_id=$1 AND b.is_active=true AND b.expires_at>NOW()
    ORDER BY b.gp_paid DESC, b.created_at DESC
    LIMIT 5
  `, [claimId]);
  return rows;
}

async function plantBanner(wallet, claimId, emoji, message) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Banner system is disabled');

  const safeEmoji = ALLOWED_EMOJIS.includes(emoji) ? emoji : ALLOWED_EMOJIS[0];
  const msg = message ? String(message).trim().slice(0, cfg.maxLen) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim exists and belongs to wallet
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id=$1 AND deleted_at IS NULL', [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');
    if (claimRes.rows[0].owner !== wallet) throw new Error('You must own this territory to plant a banner');

    // Check max per claim
    const activeCount = await client.query(
      'SELECT COUNT(*) FROM territory_banners WHERE claim_id=$1 AND is_active=true AND expires_at>NOW()',
      [claimId]
    );
    if (parseInt(activeCount.rows[0].count, 10) >= cfg.maxPer)
      throw new Error(`Territory already has ${cfg.maxPer} active banners`);

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet=$1 FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet=$2',
      [cfg.costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'banner', $3)`,
      [wallet, -cfg.costGP, `Victory banner on claim #${claimId}`]
    );

    const expiresAt = new Date(Date.now() + cfg.durD * 24 * 3600 * 1000);
    const ins = await client.query(
      `INSERT INTO territory_banners (claim_id, wallet, emoji, message, gp_paid, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [claimId, wallet, safeEmoji, msg, cfg.costGP, expiresAt]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('./gpActivity');
      await logGPActivity(wallet, 'spend', cfg.costGP, `banner claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'banner');
    } catch(_) {}

    return { success: true, id: ins.rows[0].id, costGP: cfg.costGP, expiresAt };
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
      (SELECT COUNT(*) FROM territory_banners)                                                AS total,
      (SELECT COUNT(*) FROM territory_banners WHERE is_active=true AND expires_at>NOW())      AS active,
      (SELECT SUM(gp_paid) FROM territory_banners)                                            AS total_gp,
      (SELECT COUNT(*) FROM territory_banners WHERE created_at>NOW()-INTERVAL '24h')          AS planted_24h
  `);
  const recent = await pool.query(`
    SELECT b.id, b.claim_id, b.wallet, u.nickname,
           b.emoji, b.message, b.gp_paid, b.is_active, b.expires_at
    FROM territory_banners b
    LEFT JOIN users u ON u.wallet = b.wallet
    ORDER BY b.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminRemoveBanner(id) {
  await pool.query('UPDATE territory_banners SET is_active=false WHERE id=$1', [id]);
  return { success: true };
}

module.exports = { getCfg, expireBanners, getActiveBanners, plantBanner, getAdminStats, adminRemoveBanner, ALLOWED_EMOJIS };

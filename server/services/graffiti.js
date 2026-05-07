'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, costGP, maxLen, durH, maxPer, allowOwn] = await Promise.all([
    getSetting('graffiti_enabled',           'true'),
    getSetting('graffiti_cost_gp',           '20'),
    getSetting('graffiti_max_length',        '30'),
    getSetting('graffiti_duration_h',        '48'),
    getSetting('graffiti_max_per_territory', '5'),
    getSetting('graffiti_allow_own',         'true'),
  ]);
  return {
    enabled:   enabled === 'true',
    costGP:    parseInt(costGP,  10),
    maxLen:    parseInt(maxLen,  10),
    durH:      parseInt(durH,    10),
    maxPer:    parseInt(maxPer,  10),
    allowOwn:  allowOwn === 'true',
  };
}

async function expireGraffiti() {
  const { rows } = await pool.query(
    `UPDATE territory_graffiti SET is_active=false
     WHERE is_active=true AND expires_at <= NOW()
     RETURNING id`
  );
  return rows;
}

async function getActiveGraffiti(claimId) {
  const { rows } = await pool.query(`
    SELECT g.id, g.from_wallet, u.nickname AS from_nickname,
           g.text, g.gp_paid, g.expires_at, g.created_at
    FROM territory_graffiti g
    LEFT JOIN users u ON u.wallet_address = g.from_wallet
    WHERE g.claim_id = $1 AND g.is_active = true AND g.expires_at > NOW()
    ORDER BY g.gp_paid DESC, g.created_at DESC
    LIMIT 10
  `, [claimId]);
  return rows;
}

async function placeGraffiti(wallet, claimId, text) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Graffiti system is disabled');

  if (!text || typeof text !== 'string') throw new Error('text required');
  const trimmed = text.trim();
  if (!trimmed.length) throw new Error('text cannot be empty');
  if (trimmed.length > cfg.maxLen) throw new Error(`text too long (max ${cfg.maxLen})`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim exists
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id = $1 AND deleted_at IS NULL',
      [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');

    // Check allow_own
    if (!cfg.allowOwn && claimRes.rows[0].owner === wallet) {
      throw new Error('Cannot place graffiti on your own territory');
    }

    // Check max active per territory
    const activeCount = await client.query(
      'SELECT COUNT(*) FROM territory_graffiti WHERE claim_id=$1 AND is_active=true AND expires_at>NOW()',
      [claimId]
    );
    if (parseInt(activeCount.rows[0].count, 10) >= cfg.maxPer)
      throw new Error(`Territory already has ${cfg.maxPer} active graffiti`);

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    const deductGraffiti = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1',
      [cfg.costGP, wallet]
    );
    if (deductGraffiti.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'graffiti', $3)`,
      [wallet, -cfg.costGP, `Graffiti on claim #${claimId}: ${trimmed}`]
    );

    // Insert graffiti
    const expiresAt = new Date(Date.now() + cfg.durH * 3600 * 1000);
    const ins = await client.query(
      `INSERT INTO territory_graffiti (claim_id, from_wallet, text, gp_paid, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [claimId, wallet, trimmed, cfg.costGP, expiresAt]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', cfg.costGP, `graffiti claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'graffiti');
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
      (SELECT COUNT(*) FROM territory_graffiti)                                              AS total,
      (SELECT COUNT(*) FROM territory_graffiti WHERE is_active=true AND expires_at>NOW())    AS active,
      (SELECT SUM(gp_paid) FROM territory_graffiti)                                          AS total_gp,
      (SELECT COUNT(*) FROM territory_graffiti WHERE created_at > NOW()-INTERVAL '24h')      AS placed_24h
  `);
  const recent = await pool.query(`
    SELECT g.id, g.claim_id, g.from_wallet, u.nickname,
           g.text, g.gp_paid, g.is_active, g.expires_at, g.created_at
    FROM territory_graffiti g
    LEFT JOIN users u ON u.wallet_address = g.from_wallet
    ORDER BY g.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminDeleteGraffiti(id) {
  await pool.query(
    'UPDATE territory_graffiti SET is_active=false WHERE id=$1', [id]
  );
  return { success: true };
}

module.exports = { getCfg, expireGraffiti, getActiveGraffiti, placeGraffiti, getAdminStats, adminDeleteGraffiti };

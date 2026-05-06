'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, minGP, maxGP, maxMsg, cooldownMin] = await Promise.all([
    getSetting('tribute_enabled',      'true'),
    getSetting('tribute_min_gp',       '10'),
    getSetting('tribute_max_gp',       '500'),
    getSetting('tribute_max_msg_len',  '80'),
    getSetting('tribute_cooldown_min', '60'),
  ]);
  return {
    enabled:     enabled === 'true',
    minGP:       parseInt(minGP,       10),
    maxGP:       parseInt(maxGP,       10),
    maxMsg:      parseInt(maxMsg,      10),
    cooldownMin: parseInt(cooldownMin, 10),
  };
}

async function getClaimTributes(claimId, limit = 10) {
  const { rows } = await pool.query(`
    SELECT t.id, t.from_wallet, u.nickname AS from_nickname,
           t.amount_gp, t.message, t.created_at
    FROM territory_tributes t
    LEFT JOIN users u ON u.wallet_address = t.from_wallet
    WHERE t.claim_id = $1
    ORDER BY t.created_at DESC
    LIMIT $2
  `, [claimId, limit]);
  return rows;
}

async function getMyTributes(wallet) {
  const { rows } = await pool.query(`
    SELECT t.id, t.claim_id, c.custom_name AS claim_name,
           t.to_wallet, u2.nickname AS to_nickname,
           t.amount_gp, t.message, t.created_at
    FROM territory_tributes t
    LEFT JOIN claims c ON c.id = t.claim_id
    LEFT JOIN users u2 ON u2.wallet_address = t.to_wallet
    WHERE t.from_wallet = $1
    ORDER BY t.created_at DESC
    LIMIT 30
  `, [wallet]);
  return rows;
}

async function sendTribute(wallet, claimId, amountGP, message) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Tribute system is disabled');

  amountGP = parseInt(amountGP, 10);
  if (isNaN(amountGP) || amountGP < cfg.minGP)
    throw new Error(`Minimum tribute is ${cfg.minGP} GP`);
  if (amountGP > cfg.maxGP)
    throw new Error(`Maximum tribute is ${cfg.maxGP} GP`);

  const msg = message ? String(message).trim().slice(0, cfg.maxMsg) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim exists and get owner
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id = $1 AND deleted_at IS NULL',
      [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');
    const owner = claimRes.rows[0].owner;

    // Block self-tribute
    if (owner === wallet) throw new Error('Cannot tribute your own territory');

    // Cooldown check
    if (cfg.cooldownMin > 0) {
      const cooldown = await client.query(`
        SELECT created_at FROM territory_tributes
        WHERE from_wallet = $1 AND claim_id = $2
        ORDER BY created_at DESC LIMIT 1
      `, [wallet, claimId]);
      if (cooldown.rows.length) {
        const elapsed = (Date.now() - new Date(cooldown.rows[0].created_at)) / 60000;
        if (elapsed < cfg.cooldownMin)
          throw new Error(`Cooldown: wait ${Math.ceil(cfg.cooldownMin - elapsed)} more minutes`);
      }
    }

    // Deduct GP (burned — not transferred)
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < amountGP)
      throw new Error(`Insufficient GP (need ${amountGP})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
      [amountGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'tribute', $3)`,
      [wallet, -amountGP, `Tribute to claim #${claimId}${msg ? ': '+msg : ''}`]
    );

    // Record tribute
    const ins = await client.query(
      `INSERT INTO territory_tributes (claim_id, from_wallet, to_wallet, amount_gp, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [claimId, wallet, owner, amountGP, msg]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', amountGP, `tribute claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, amountGP, 'tribute');
    } catch(_) {}

    return { success: true, id: ins.rows[0].id, amountGP };
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
      (SELECT COUNT(*)        FROM territory_tributes)                                         AS total_tributes,
      (SELECT SUM(amount_gp)  FROM territory_tributes)                                         AS total_gp_burned,
      (SELECT COUNT(*)        FROM territory_tributes WHERE created_at > NOW()-INTERVAL '24h') AS tributes_24h,
      (SELECT SUM(amount_gp)  FROM territory_tributes WHERE created_at > NOW()-INTERVAL '24h') AS gp_24h
  `);
  const recent = await pool.query(`
    SELECT t.id, t.claim_id, uf.nickname AS from_nickname, t.from_wallet,
           ut.nickname AS to_nickname, t.to_wallet,
           t.amount_gp, t.message, t.created_at
    FROM territory_tributes t
    LEFT JOIN users uf ON uf.wallet_address = t.from_wallet
    LEFT JOIN users ut ON ut.wallet_address = t.to_wallet
    ORDER BY t.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

module.exports = { getCfg, getClaimTributes, getMyTributes, sendTribute, getAdminStats };

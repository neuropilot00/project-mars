'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, durH, maxMsg, maxPerTerritory, cooldownH] = await Promise.all([
    getSetting('sponsor_enabled',           'true'),
    getSetting('sponsor_cost_gp',           '50'),
    getSetting('sponsor_duration_h',        '24'),
    getSetting('sponsor_max_msg_length',    '60'),
    getSetting('sponsor_max_per_territory', '3'),
    getSetting('sponsor_cooldown_h',        '0'),
  ]);
  return {
    enabled:          enabled === 'true',
    costGP:           parseInt(costGP,           10),
    durH:             parseInt(durH,             10),
    maxMsg:           parseInt(maxMsg,           10),
    maxPerTerritory:  parseInt(maxPerTerritory,  10),
    cooldownH:        parseInt(cooldownH,        10),
  };
}

async function expireSponsors() {
  const { rowCount } = await pool.query(
    `UPDATE territory_sponsors SET is_active=false
     WHERE is_active=true AND expires_at <= NOW()`
  );
  return rowCount;
}

async function getActiveSponsors(claimId) {
  const { rows } = await pool.query(
    `SELECT ts.id, ts.claim_id, ts.sponsor_wallet, ts.message, ts.gp_paid, ts.expires_at,
            COALESCE(u.nickname, ts.sponsor_wallet) AS nickname
     FROM territory_sponsors ts
     LEFT JOIN users u ON u.wallet_address = ts.sponsor_wallet
     WHERE ts.claim_id=$1 AND ts.is_active=true AND ts.expires_at > NOW()
     ORDER BY ts.gp_paid DESC, ts.created_at ASC`,
    [claimId]
  );
  return rows;
}

async function getMySponsorships(wallet) {
  const { rows } = await pool.query(
    `SELECT ts.id, ts.claim_id, ts.message, ts.gp_paid, ts.expires_at, ts.is_active,
            c.custom_name AS claim_name
     FROM territory_sponsors ts
     LEFT JOIN claims c ON c.id = ts.claim_id
     WHERE ts.sponsor_wallet=$1
     ORDER BY ts.created_at DESC LIMIT 30`,
    [wallet]
  );
  return rows;
}

async function placeSponsor(wallet, claimId, message) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Sponsor system disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Claim must exist and not be deleted
    const claimRow = await client.query(
      `SELECT id FROM claims WHERE id=$1 AND deleted_at IS NULL`,
      [claimId]
    );
    if (!claimRow.rows.length) throw new Error('Claim not found');

    // Cannot sponsor your own territory
    const ownRow = await client.query(
      `SELECT owner FROM claims WHERE id=$1`, [claimId]
    );
    if (ownRow.rows[0]?.owner === wallet) throw new Error('Cannot sponsor your own territory');

    // Check max concurrent sponsors per territory
    const countRow = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM territory_sponsors
       WHERE claim_id=$1 AND is_active=true AND expires_at > NOW()`,
      [claimId]
    );
    if (countRow.rows[0].cnt >= cfg.maxPerTerritory) {
      throw new Error(`Max ${cfg.maxPerTerritory} active sponsors per territory`);
    }

    // Cooldown check (per wallet per territory)
    if (cfg.cooldownH > 0) {
      const coolRow = await client.query(
        `SELECT created_at FROM territory_sponsors
         WHERE claim_id=$1 AND sponsor_wallet=$2
         ORDER BY created_at DESC LIMIT 1`,
        [claimId, wallet]
      );
      if (coolRow.rows.length) {
        const elapsedH = (Date.now() - new Date(coolRow.rows[0].created_at).getTime()) / 3_600_000;
        if (elapsedH < cfg.cooldownH) {
          const hoursLeft = (cfg.cooldownH - elapsedH).toFixed(1);
          throw new Error(`Cooldown: ${hoursLeft}h remaining`);
        }
      }
    }

    // Deduct GP
    const balRow = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`, [wallet]
    );
    if (!balRow.rows.length) throw new Error('User not found');
    if (balRow.rows[0].gp_balance < cfg.costGP) throw new Error(`Need ${cfg.costGP} GP`);
    const deductSponsor = await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1`,
      [cfg.costGP, wallet]
    );
    if (deductSponsor.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
       VALUES($1,$2,'sponsor',$3,'Territory sponsor')`,
      [wallet, -cfg.costGP, claimId]
    );

    // Insert sponsor
    const msg = message ? message.trim().slice(0, cfg.maxMsg) : null;
    const expiresAt = new Date(Date.now() + cfg.durH * 3_600_000);
    const { rows } = await client.query(
      `INSERT INTO territory_sponsors(claim_id, sponsor_wallet, message, gp_paid, expires_at)
       VALUES($1, $2, $3, $4, $5) RETURNING id`,
      [claimId, wallet, msg, cfg.costGP, expiresAt]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, -cfg.costGP, 'sponsor', `Territory sponsor #${claimId}`);
    } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, cfg.costGP, 'sponsor').catch(() => {});

    return { id: rows[0].id, expiresAt, gpCost: cfg.costGP };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int                        AS total,
            COUNT(*) FILTER(WHERE is_active AND expires_at > NOW())::int AS active,
            COALESCE(SUM(gp_paid), 0)::int       AS total_gp_sunk
     FROM territory_sponsors`
  );
  const { rows: recent } = await pool.query(
    `SELECT ts.id, ts.claim_id, ts.sponsor_wallet, ts.message, ts.gp_paid,
            ts.expires_at, ts.is_active,
            COALESCE(u.nickname, ts.sponsor_wallet) AS nickname
     FROM territory_sponsors ts
     LEFT JOIN users u ON u.wallet_address = ts.sponsor_wallet
     ORDER BY ts.created_at DESC LIMIT 30`
  );
  return { stats, recent };
}

module.exports = { getCfg, expireSponsors, getActiveSponsors, getMySponsorships, placeSponsor, getAdminStats };

'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, firstGP, changeGP, maxLen, cooldownH] = await Promise.all([
    getSetting('tdesc_enabled',   'true'),
    getSetting('tdesc_first_gp',  '0'),
    getSetting('tdesc_change_gp', '30'),
    getSetting('tdesc_max_length','200'),
    getSetting('tdesc_cooldown_h','12'),
  ]);
  return {
    enabled:   enabled === 'true',
    firstGP:   parseInt(firstGP,   10),
    changeGP:  parseInt(changeGP,  10),
    maxLen:    parseInt(maxLen,    10),
    cooldownH: parseInt(cooldownH, 10),
  };
}

async function getDescription(claimId) {
  const { rows } = await pool.query(
    `SELECT td.*, COALESCE(u.nickname, td.wallet) AS nickname
     FROM territory_descriptions td
     LEFT JOIN users u ON u.wallet = td.wallet
     WHERE td.claim_id = $1`,
    [claimId]
  );
  return rows[0] || null;
}

async function setDescription(wallet, claimId, text) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Territory descriptions disabled');
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Description cannot be empty');
  if (trimmed.length > cfg.maxLen) throw new Error(`Max ${cfg.maxLen} characters`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim ownership
    const claimRow = await client.query(
      `SELECT id FROM claims WHERE id=$1 AND owner=$2 AND deleted_at IS NULL`,
      [claimId, wallet]
    );
    if (!claimRow.rows.length) throw new Error('You do not own this territory');

    // Check existing description
    const existRow = await client.query(
      `SELECT claim_id, updated_at FROM territory_descriptions WHERE claim_id=$1 FOR UPDATE`,
      [claimId]
    );
    const isFirst = !existRow.rows.length;
    const gpCost  = isFirst ? cfg.firstGP : cfg.changeGP;

    // Cooldown check (only when updating and cooldown is configured)
    if (!isFirst && cfg.cooldownH > 0) {
      const lastUpdated = existRow.rows[0].updated_at;
      const elapsedH    = (Date.now() - new Date(lastUpdated).getTime()) / 3_600_000;
      if (elapsedH < cfg.cooldownH) {
        const hoursLeft = (cfg.cooldownH - elapsedH).toFixed(1);
        throw new Error(`Cooldown: ${hoursLeft}h remaining`);
      }
    }

    // Deduct GP if needed
    if (gpCost > 0) {
      const balRow = await client.query(
        `SELECT gp_balance FROM users WHERE wallet=$1 FOR UPDATE`, [wallet]
      );
      if (!balRow.rows.length) throw new Error('User not found');
      if (balRow.rows[0].gp_balance < gpCost) throw new Error(`Need ${gpCost} GP`);
      await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet=$2`,
        [gpCost, wallet]
      );
      await client.query(
        `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
         VALUES($1,$2,'tdesc',$3,'Territory description')`,
        [wallet, -gpCost, claimId]
      );
    }

    // Upsert description
    await client.query(
      `INSERT INTO territory_descriptions(claim_id, wallet, description, gp_paid, updated_at, created_at)
       VALUES($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT(claim_id) DO UPDATE
         SET description = $3,
             gp_paid     = territory_descriptions.gp_paid + $4,
             updated_at  = NOW()`,
      [claimId, wallet, trimmed, gpCost]
    );

    // Log entry
    await client.query(
      `INSERT INTO tdesc_log(claim_id, wallet, description, gp_paid) VALUES($1,$2,$3,$4)`,
      [claimId, wallet, trimmed, gpCost]
    );

    await client.query('COMMIT');

    if (gpCost > 0) {
      try {
        const { logGPActivity } = require('./gpActivity');
        await logGPActivity(wallet, -gpCost, 'tdesc', `Territory description #${claimId}`);
      } catch(_) {}
      seasonService?.trackGPSpend?.(wallet, gpCost, 'tdesc').catch(() => {});
    }

    return { gpCost, isFirst };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getMyDescriptions(wallet) {
  const { rows } = await pool.query(
    `SELECT td.claim_id, td.description, td.gp_paid, td.updated_at,
            c.name AS claim_name, c.x, c.y
     FROM territory_descriptions td
     LEFT JOIN claims c ON c.id = td.claim_id
     WHERE td.wallet = $1
     ORDER BY td.updated_at DESC`,
    [wallet]
  );
  return rows;
}

async function deleteDescription(claimId) {
  await pool.query(`DELETE FROM territory_descriptions WHERE claim_id=$1`, [claimId]);
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int                        AS total,
            COALESCE(SUM(gp_paid), 0)::int       AS total_gp_sunk
     FROM territory_descriptions`
  );
  const { rows: recent } = await pool.query(
    `SELECT td.claim_id, td.wallet, td.description, td.gp_paid, td.updated_at,
            COALESCE(u.nickname, td.wallet) AS nickname
     FROM territory_descriptions td
     LEFT JOIN users u ON u.wallet = td.wallet
     ORDER BY td.updated_at DESC LIMIT 30`
  );
  return { stats, recent };
}

module.exports = { getCfg, getDescription, setDescription, getMyDescriptions, deleteDescription, getAdminStats };

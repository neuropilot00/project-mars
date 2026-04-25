'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, costGP, maxLen, maxPer, reqPrev] = await Promise.all([
    getSetting('tombstone_enabled',         'true'),
    getSetting('tombstone_cost_gp',         '35'),
    getSetting('tombstone_max_length',      '60'),
    getSetting('tombstone_max_per_claim',   '5'),
    getSetting('tombstone_require_prev_owner', 'true'),
  ]);
  return {
    enabled:    enabled === 'true',
    costGP:     parseInt(costGP,   10),
    maxLen:     parseInt(maxLen,   10),
    maxPer:     parseInt(maxPer,   10),
    requirePrevOwner: reqPrev === 'true',
  };
}

async function getTombstones(claimId) {
  const { rows } = await pool.query(`
    SELECT t.id, t.wallet, u.nickname AS player_name, t.epitaph, t.gp_paid, t.created_at
    FROM territory_tombstones t
    LEFT JOIN users u ON u.wallet_address = t.wallet
    WHERE t.claim_id=$1
    ORDER BY t.created_at ASC
  `, [claimId]);
  return rows;
}

async function placeTombstone(wallet, claimId, epitaph) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Tombstone system is disabled');

  const safeEpitaph = epitaph ? String(epitaph).trim().slice(0, cfg.maxLen) : 'I was here.';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify the territory exists
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id=$1 AND deleted_at IS NULL', [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');

    const currentOwner = claimRes.rows[0].owner;

    // If requirePrevOwner is true, verify wallet was a previous owner via hijack log or ownership check
    if (cfg.requirePrevOwner) {
      if (currentOwner === wallet)
        throw new Error('You still own this territory — tombstones are for lost territories');

      // Check if wallet was ever associated with this claim via hijack history.
      // hijack_log은 phantom 테이블이었음 — 실제는 hijack_battles에 attacker_wallet+target_claim_id가 있고,
      // 'previous owner'를 가리키는 정확한 컬럼은 없음. 가장 근접한 것: 이 클레임을 이전에 침공해서
      // 이긴 적이 있는 attacker (즉 이 wallet이 한때 점령자였을 가능성).
      const prevOwnerCheck = await client.query(
        `SELECT 1 FROM hijack_battles
          WHERE target_claim_id = $1
            AND attacker_wallet = $2
            AND final_result = 'attacker_win'
          LIMIT 1`,
        [claimId, wallet]
      );
      if (!prevOwnerCheck.rows.length)
        throw new Error('You were not a previous owner of this territory');
    }

    // Check max tombstones per territory
    const countRes = await client.query(
      'SELECT COUNT(*) FROM territory_tombstones WHERE claim_id=$1', [claimId]
    );
    if (parseInt(countRes.rows[0].count, 10) >= cfg.maxPer)
      throw new Error(`Territory already has ${cfg.maxPer} tombstones`);

    // Check if this wallet already placed a tombstone here
    const dupCheck = await client.query(
      'SELECT id FROM territory_tombstones WHERE claim_id=$1 AND wallet=$2', [claimId, wallet]
    );
    if (dupCheck.rows.length)
      throw new Error('You have already placed a tombstone on this territory');

    // Deduct GP
    const bal = await client.query(
      'SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]
    );
    if (!bal.rows.length) throw new Error('User not found');
    if (bal.rows[0].gp_balance < cfg.costGP)
      throw new Error(`Insufficient GP (need ${cfg.costGP})`);

    await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address=$2',
      [cfg.costGP, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, type, note)
       VALUES ($1, $2, 'tombstone', $3)`,
      [wallet, -cfg.costGP, `Tombstone on territory #${claimId}: "${safeEpitaph}"`]
    );

    const ins = await client.query(
      `INSERT INTO territory_tombstones (claim_id, wallet, epitaph, gp_paid)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [claimId, wallet, safeEpitaph, cfg.costGP]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('../db');
      await logGPActivity(wallet, 'spend', cfg.costGP, `tombstone claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      await seasonService.trackGPSpend(wallet, cfg.costGP, 'tombstone');
    } catch(_) {}

    return { success: true, id: ins.rows[0].id, costGP: cfg.costGP };
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
      (SELECT COUNT(*) FROM territory_tombstones)                                             AS total,
      (SELECT SUM(gp_paid) FROM territory_tombstones)                                        AS total_gp,
      (SELECT COUNT(*) FROM territory_tombstones WHERE created_at > NOW()-INTERVAL '24h')    AS placed_24h,
      (SELECT COUNT(DISTINCT claim_id) FROM territory_tombstones)                            AS territories_with_stones
  `);
  const recent = await pool.query(`
    SELECT t.id, t.claim_id, t.wallet, u.nickname, t.epitaph, t.gp_paid, t.created_at
    FROM territory_tombstones t
    LEFT JOIN users u ON u.wallet_address = t.wallet
    ORDER BY t.created_at DESC LIMIT 20
  `);
  return { stats: rows[0], recent: recent.rows };
}

async function adminRemoveTombstone(id) {
  await pool.query('DELETE FROM territory_tombstones WHERE id=$1', [id]);
  return { success: true };
}

module.exports = { getCfg, getTombstones, placeTombstone, getAdminStats, adminRemoveTombstone };

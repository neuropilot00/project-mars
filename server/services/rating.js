'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, costGP, changeGP, minVotes] = await Promise.all([
    getSetting('rating_enabled',   'true'),
    getSetting('rating_cost_gp',   '5'),
    getSetting('rating_change_gp', '3'),
    getSetting('rating_min_votes', '3'),
  ]);
  return {
    enabled:  enabled === 'true',
    costGP:   parseInt(costGP,   10),
    changeGP: parseInt(changeGP, 10),
    minVotes: parseInt(minVotes, 10),
  };
}

async function getClaimRating(claimId) {
  const cfg = await getCfg();
  const { rows } = await pool.query(`
    SELECT
      COUNT(*)::INT       AS vote_count,
      AVG(rating)::FLOAT  AS avg_rating,
      SUM(gp_paid)::INT   AS total_gp
    FROM territory_ratings
    WHERE claim_id = $1
  `, [claimId]);
  const s = rows[0];
  const voteCount = s.vote_count || 0;
  return {
    voteCount,
    avgRating: voteCount >= cfg.minVotes ? Math.round((s.avg_rating||0) * 10) / 10 : null,
    totalGP:   s.total_gp || 0,
    isPublic:  voteCount >= cfg.minVotes,
  };
}

async function getMyRating(claimId, wallet) {
  const { rows } = await pool.query(
    'SELECT rating, gp_paid FROM territory_ratings WHERE claim_id=$1 AND voter_wallet=$2',
    [claimId, wallet]
  );
  return rows[0] || null;
}

async function rateTerritory(wallet, claimId, rating) {
  if (!wallet) throw new Error('wallet required');
  if (!claimId) throw new Error('claimId required');
  rating = parseInt(rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) throw new Error('Rating must be 1-5');

  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Rating system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim exists
    const claimRes = await client.query(
      'SELECT id, owner FROM claims WHERE id=$1 AND deleted_at IS NULL', [claimId]
    );
    if (!claimRes.rows.length) throw new Error('Territory not found');
    if (claimRes.rows[0].owner === wallet) throw new Error('Cannot rate your own territory');

    // Check existing
    const existing = await client.query(
      'SELECT id, rating FROM territory_ratings WHERE claim_id=$1 AND voter_wallet=$2',
      [claimId, wallet]
    );
    const isNew  = existing.rows.length === 0;
    const gpCost = isNew ? cfg.costGP : cfg.changeGP;

    if (gpCost > 0) {
      const bal = await client.query(
        'SELECT gp_balance FROM users WHERE wallet_address=$1 FOR UPDATE', [wallet]
      );
      if (!bal.rows.length) throw new Error('User not found');
      if (bal.rows[0].gp_balance < gpCost)
        throw new Error(`Insufficient GP (need ${gpCost})`);

      await client.query(
        'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address=$2',
        [gpCost, wallet]
      );
      await client.query(
        `INSERT INTO gp_transactions (wallet, amount, type, note)
         VALUES ($1, $2, 'rating', $3)`,
        [wallet, -gpCost, `Rate claim #${claimId}: ${rating}★`]
      );
    }

    await client.query(
      `INSERT INTO territory_ratings (claim_id, voter_wallet, rating, gp_paid, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (claim_id, voter_wallet) DO UPDATE
         SET rating = EXCLUDED.rating,
             gp_paid = territory_ratings.gp_paid + $4,
             updated_at = NOW()`,
      [claimId, wallet, rating, gpCost]
    );

    await client.query('COMMIT');

    try {
      const { logGPActivity } = require('./gpActivity');
      if (gpCost > 0) await logGPActivity(wallet, 'spend', gpCost, `rating claim#${claimId}`);
    } catch(_) {}
    try {
      const seasonService = require('./season');
      if (gpCost > 0) await seasonService.trackGPSpend(wallet, gpCost, 'rating');
    } catch(_) {}

    return { success: true, rating, gpCost, isNew };
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
      (SELECT COUNT(*)              FROM territory_ratings)                                     AS total_ratings,
      (SELECT SUM(gp_paid)          FROM territory_ratings)                                     AS total_gp,
      (SELECT COUNT(DISTINCT claim_id) FROM territory_ratings)                                  AS rated_territories,
      (SELECT COUNT(*)              FROM territory_ratings WHERE created_at>NOW()-INTERVAL '24h') AS ratings_24h
  `);
  const topRated = await pool.query(`
    SELECT r.claim_id, c.name AS claim_name,
           COUNT(r.id)::INT AS votes, AVG(r.rating)::FLOAT AS avg_rating
    FROM territory_ratings r
    LEFT JOIN claims c ON c.id = r.claim_id
    GROUP BY r.claim_id, c.name
    HAVING COUNT(r.id) >= 1
    ORDER BY avg_rating DESC, votes DESC
    LIMIT 10
  `);
  return { stats: rows[0], topRated: topRated.rows };
}

module.exports = { getCfg, getClaimRating, getMyRating, rateTerritory, getAdminStats };

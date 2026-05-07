'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, houseCut, minBet, maxBet, autoLock] = await Promise.all([
    getSetting('wager_enabled', 'true'),
    getSetting('wager_house_cut_pct', '10'),
    getSetting('wager_min_bet_gp', '10'),
    getSetting('wager_max_bet_gp', '0'),
    getSetting('wager_auto_lock', 'true'),
  ]);
  return {
    enabled: enabled === 'true',
    houseCutPct: parseInt(houseCut)||10,
    minBetGp: parseInt(minBet)||10,
    maxBetGp: parseInt(maxBet)||0,
    autoLock: autoLock === 'true',
  };
}

async function getOpenPools() {
  const r = await pool.query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM wager_bets WHERE pool_id=p.id) AS bet_count,
       (SELECT COUNT(DISTINCT target_wallet) FROM wager_bets WHERE pool_id=p.id) AS candidate_count
     FROM wager_pools p
     WHERE p.status IN ('open','locked')
     ORDER BY p.closes_at ASC`
  );
  return r.rows;
}

async function getPool(id) {
  const r = await pool.query(`SELECT * FROM wager_pools WHERE id=$1`, [id]);
  return r.rows[0] || null;
}

async function getPoolBets(poolId) {
  const r = await pool.query(
    `SELECT b.*, u.nickname FROM wager_bets b
       LEFT JOIN users u ON LOWER(b.target_wallet)=LOWER(u.wallet_address)
       WHERE b.pool_id=$1
       ORDER BY b.gp_amount DESC`,
    [poolId]
  );
  return r.rows;
}

async function getMyBets(wallet) {
  const r = await pool.query(
    `SELECT b.*, p.title, p.icon, p.status, p.winner_wallet, p.closes_at
       FROM wager_bets b
       JOIN wager_pools p ON p.id = b.pool_id
       WHERE LOWER(b.bettor_wallet)=LOWER($1)
       ORDER BY b.created_at DESC LIMIT 20`,
    [wallet]
  );
  return r.rows;
}

async function placeBet(wallet, poolId, targetWallet, gpAmount) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Wager system disabled');
  if (gpAmount < cfg.minBetGp) throw new Error(`Minimum bet is ${cfg.minBetGp} GP`);
  if (cfg.maxBetGp > 0 && gpAmount > cfg.maxBetGp) throw new Error(`Maximum bet is ${cfg.maxBetGp} GP`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock pool
    const poolRes = await client.query(
      `SELECT * FROM wager_pools WHERE id=$1 AND status='open' FOR UPDATE`,
      [poolId]
    );
    if (!poolRes.rows.length) throw new Error('Pool not found or not accepting bets');
    const wPool = poolRes.rows[0];
    if (new Date(wPool.closes_at) <= new Date()) throw new Error('Betting period has closed');

    // Per-pool max check
    if (wPool.max_bet_gp && gpAmount > wPool.max_bet_gp) throw new Error(`Max bet for this pool is ${wPool.max_bet_gp} GP`);

    // One bet per pool
    const existing = await client.query(
      `SELECT id FROM wager_bets WHERE pool_id=$1 AND LOWER(bettor_wallet)=LOWER($2)`,
      [poolId, wallet]
    );
    if (existing.rows.length) throw new Error('You already placed a bet in this pool');

    // Don't bet on yourself
    if (wallet.toLowerCase() === targetWallet.toLowerCase()) throw new Error('Cannot bet on yourself');

    // User balance
    const userRes = await client.query(
      `SELECT gp_balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`,
      [wallet]
    );
    if (!userRes.rows.length) throw new Error('User not found');
    if (userRes.rows[0].gp_balance < gpAmount) throw new Error('Insufficient GP');

    // Deduct GP
    await client.query(
      `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1`,
      [gpAmount, wallet]
    );
    await client.query(
      `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
       VALUES ($1, $2, 'wager_bet', $3)`,
      [wallet, -gpAmount, `Bet on ${targetWallet.slice(0,6)}… in wager #${poolId}`]
    );

    // Add to pot
    await client.query(
      `UPDATE wager_pools SET total_pot_gp = total_pot_gp + $1 WHERE id=$2`,
      [gpAmount, poolId]
    );

    // Insert bet
    await client.query(
      `INSERT INTO wager_bets (pool_id, bettor_wallet, target_wallet, gp_amount)
       VALUES ($1, $2, $3, $4)`,
      [poolId, wallet, targetWallet, gpAmount]
    );

    await client.query('COMMIT');

    try { const { logGPActivity } = require('../db'); await logGPActivity(wallet, -gpAmount, 'wager_bet', `Pool #${poolId}`); } catch(_) {}
    try { const seasonService = require('./season'); await seasonService.trackGPSpend(wallet, gpAmount); } catch(_) {}

    return { success: true, gpAmount, poolId, targetWallet };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function settlePool(poolId, winnerWallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const poolRes = await client.query(
      `SELECT * FROM wager_pools WHERE id=$1 FOR UPDATE`,
      [poolId]
    );
    if (!poolRes.rows.length) throw new Error('Pool not found');
    const wPool = poolRes.rows[0];
    if (wPool.status === 'settled') throw new Error('Already settled');
    if (wPool.status === 'cancelled') throw new Error('Pool was cancelled');

    const totalPot = wPool.total_pot_gp;
    const houseCut = Math.floor(totalPot * wPool.house_cut_pct / 100);
    const payoutPot = totalPot - houseCut;

    // Find winning bets
    const winnersRes = await client.query(
      `SELECT * FROM wager_bets WHERE pool_id=$1 AND LOWER(target_wallet)=LOWER($2)`,
      [poolId, winnerWallet]
    );
    const winners = winnersRes.rows;
    const winnerTotal = winners.reduce(function(s, b) { return s + b.gp_amount; }, 0);

    // Distribute payout proportionally
    for (const bet of winners) {
      const payout = winnerTotal > 0 ? Math.floor(payoutPot * bet.gp_amount / winnerTotal) : 0;
      if (payout > 0) {
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`,
          [payout, bet.bettor_wallet]
        );
        await client.query(
          `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
           VALUES ($1, $2, 'wager_payout', $3)`,
          [bet.bettor_wallet, payout, `Wager payout pool #${poolId}`]
        );
        await client.query(`UPDATE wager_bets SET payout=$1 WHERE id=$2`, [payout, bet.id]);
      }
    }

    // Mark settled
    await client.query(
      `UPDATE wager_pools SET status='settled', winner_wallet=$1, settled_at=NOW() WHERE id=$2`,
      [winnerWallet, poolId]
    );

    await client.query('COMMIT');
    return { ok: true, winners: winners.length, payoutPot, houseCut };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

let _wagerDisabled = false;
async function autoLockExpired() {
  if (_wagerDisabled) return;
  const cfg = await getCfg();
  if (!cfg.autoLock) return;
  try {
    await pool.query(
      `UPDATE wager_pools SET status='locked' WHERE status='open' AND closes_at <= NOW()`
    );
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') {
      _wagerDisabled = true;
      console.log('[WAGER] disabled — schema not provisioned');
      return;
    }
    throw e;
  }
}

async function adminCancelPool(poolId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const poolRes = await client.query(`SELECT * FROM wager_pools WHERE id=$1 FOR UPDATE`, [poolId]);
    if (!poolRes.rows.length) throw new Error('Not found');
    if (poolRes.rows[0].status === 'settled') throw new Error('Already settled');
    // Refund all bets
    const bets = await client.query(`SELECT bettor_wallet, gp_amount FROM wager_bets WHERE pool_id=$1`, [poolId]);
    for (const b of bets.rows) {
      await client.query(`UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`, [b.gp_amount, b.bettor_wallet]);
      await client.query(`INSERT INTO gp_transactions (wallet, amount, transaction_type, description) VALUES ($1,$2,'wager_refund',$3)`,
        [b.bettor_wallet, b.gp_amount, `Refund: wager pool #${poolId} cancelled`]);
    }
    await client.query(`UPDATE wager_pools SET status='cancelled' WHERE id=$1`, [poolId]);
    await client.query('COMMIT');
    return { ok: true, refunded: bets.rows.length };
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function adminCreatePool(params) {
  const { title, description, icon, category, minBetGp, maxBetGp, houseCutPct, closesAt } = params;
  if (!title || !closesAt) throw new Error('title and closesAt required');
  const r = await pool.query(
    `INSERT INTO wager_pools (title, description, icon, category, min_bet_gp, max_bet_gp, house_cut_pct, closes_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, description||null, icon||'🎯', category||'weekly', minBetGp||10, maxBetGp||null, houseCutPct||10, closesAt]
  );
  return r.rows[0];
}

async function getAdminStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='open')     AS open_pools,
      COUNT(*) FILTER (WHERE status='locked')   AS locked_pools,
      COUNT(*) FILTER (WHERE status='settled')  AS settled_pools,
      COALESCE(SUM(total_pot_gp),0)             AS total_wagered,
      (SELECT COUNT(*) FROM wager_bets)         AS total_bets
    FROM wager_pools
  `);
  return r.rows[0];
}

module.exports = { getCfg, getOpenPools, getPool, getPoolBets, getMyBets, placeBet, settlePool, autoLockExpired, adminCancelPool, adminCreatePool, getAdminStats };

'use strict';
/**
 * GP Staking Service — Migration 107
 * Players lock GP for fixed periods (7/14/30 days) and earn APY-based yield.
 * Creates a GP sink, rewards long-term holders, reduces circulating supply.
 */

const { pool, getSetting } = require('../db');

let notifyPlayer;
try { notifyPlayer = require('../db').notifyPlayer; } catch (_) {}
let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let seasonService;
try { seasonService = require('./season'); } catch (_) {}

// ── Settings ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const keys = [
    'staking_enabled', 'staking_apy_pct', 'staking_min_amount', 'staking_max_amount',
    'staking_lock_days_options', 'staking_30d_bonus_mult', 'staking_14d_bonus_mult',
    'staking_max_active',
  ];
  const res = await pool.query(
    `SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]
  );
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });

  const lockDaysOptions = (map.staking_lock_days_options || '7,14,30')
    .split(',').map(n => parseInt(n.trim())).filter(Boolean);

  return {
    enabled:       String(map.staking_enabled ?? 'true') !== 'false',
    apyPct:        parseFloat(map.staking_apy_pct)     || 15.0,
    minAmount:     parseFloat(map.staking_min_amount)  || 100,
    maxAmount:     parseFloat(map.staking_max_amount)  || 10000,
    lockDaysOptions,
    bonus30d:      parseFloat(map.staking_30d_bonus_mult) || 1.5,
    bonus14d:      parseFloat(map.staking_14d_bonus_mult) || 1.2,
    maxActive:     parseInt(map.staking_max_active)    || 5,
  };
}

// ── Yield Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate expected yield for a stake.
 * Formula: principal * (apy / 100) * (lockDays / 365) * bonusMultiplier
 */
function calculateYield(amount, apyPct, lockDays, bonusMult) {
  return +(amount * (apyPct / 100) * (lockDays / 365) * bonusMult).toFixed(6);
}

function getBonusMult(lockDays, cfg) {
  if (lockDays >= 30) return cfg.bonus30d;
  if (lockDays >= 14) return cfg.bonus14d;
  return 1.0;
}

// ── Create Stake ──────────────────────────────────────────────────────────────

/**
 * Lock GP into a stake.
 * @param {object} client - pg client with BEGIN already called
 * @param {string} wallet
 * @param {number} amount
 * @param {number} lockDays
 */
async function createStake(client, wallet, amount, lockDays) {
  const w = wallet.toLowerCase();
  const cfg = await getSettings();

  if (!cfg.enabled) throw new Error('Staking is currently disabled');

  // Validate lock period
  if (!cfg.lockDaysOptions.includes(lockDays)) {
    throw new Error(`Invalid lock period. Choose from: ${cfg.lockDaysOptions.join(', ')} days`);
  }

  // Validate amount
  if (amount < cfg.minAmount) throw new Error(`Minimum stake is ${cfg.minAmount} GP`);
  if (amount > cfg.maxAmount) throw new Error(`Maximum stake is ${cfg.maxAmount} GP per stake`);

  // Check max active stakes
  const activeRes = await client.query(
    `SELECT COUNT(*) AS n FROM gp_stakes WHERE LOWER(wallet) = LOWER($1) AND status IN ('active', 'ready')`,
    [w]
  );
  const activeCount = parseInt(activeRes.rows[0]?.n) || 0;
  if (activeCount >= cfg.maxActive) {
    throw new Error(`Maximum ${cfg.maxActive} concurrent active stakes allowed`);
  }

  // Check GP balance
  const userRes = await client.query(
    `SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE`, [w]
  );
  if (!userRes.rows.length) throw new Error('User not found');
  const balance = parseFloat(userRes.rows[0].gp_balance) || 0;
  if (balance < amount) {
    throw new Error(`Insufficient GP: need ${amount}, have ${balance.toFixed(2)}`);
  }

  // Deduct GP
  const deductStaking = await client.query(
    `UPDATE users SET gp_balance = gp_balance - $2 WHERE LOWER(wallet_address) = LOWER($1) AND gp_balance >= $2`,
    [w, amount]
  );
  if (deductStaking.rowCount === 0) throw new Error('INSUFFICIENT_GP');

  // Calculate yield
  const bonusMult  = getBonusMult(lockDays, cfg);
  const yieldEarned = calculateYield(amount, cfg.apyPct, lockDays, bonusMult);
  const unlocksAt  = new Date(Date.now() + lockDays * 24 * 3600 * 1000);

  // Insert stake
  const ins = await client.query(
    `INSERT INTO gp_stakes
       (wallet, amount, apy_pct, lock_days, yield_earned, unlocks_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [w, amount, cfg.apyPct, lockDays, yieldEarned, unlocksAt]
  );
  const stake = ins.rows[0];

  return { stake, yieldEarned, unlocksAt, bonusMult };
}

// ── Mark Ready Stakes ─────────────────────────────────────────────────────────

/**
 * Mark stakes whose lock period has expired as 'ready'.
 * Called by the scheduler or on-demand before listing.
 */
async function markReadyStakes() {
  const res = await pool.query(
    `UPDATE gp_stakes SET status = 'ready'
      WHERE status = 'active' AND unlocks_at <= NOW()
     RETURNING id, wallet`
  );
  return res.rows;
}

// ── Withdraw Stake ────────────────────────────────────────────────────────────

/**
 * Withdraw a matured stake (status = 'ready').
 * Returns principal + yield to wallet.
 * @param {object} client - pg client with BEGIN already called
 * @param {string} wallet
 * @param {number} stakeId
 */
async function withdrawStake(client, wallet, stakeId) {
  const w = wallet.toLowerCase();

  // Lock the stake row
  const stakeRes = await client.query(
    `SELECT * FROM gp_stakes WHERE id = $1 AND LOWER(wallet) = LOWER($2) FOR UPDATE`,
    [stakeId, w]
  );
  if (!stakeRes.rows.length) throw new Error('Stake not found');
  const stake = stakeRes.rows[0];

  if (stake.status === 'withdrawn') throw new Error('Stake already withdrawn');

  // Allow withdrawal only if unlocked (mark ready first)
  if (new Date(stake.unlocks_at) > new Date()) {
    const remaining = Math.ceil((new Date(stake.unlocks_at) - Date.now()) / (3600 * 1000));
    throw new Error(`Stake is still locked for ~${remaining} more hour(s)`);
  }

  const totalReturn = +((parseFloat(stake.amount) + parseFloat(stake.yield_earned)).toFixed(6));

  // Return principal + yield
  await client.query(
    `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
    [w, totalReturn]
  );

  // Mark withdrawn
  await client.query(
    `UPDATE gp_stakes SET status = 'withdrawn', withdrawn_at = NOW() WHERE id = $1`,
    [stakeId]
  );

  return { amount: parseFloat(stake.amount), yieldEarned: parseFloat(stake.yield_earned), totalReturn };
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getMyStakes(wallet) {
  const w = wallet.toLowerCase();

  // Mark expired active stakes as ready first
  await pool.query(
    `UPDATE gp_stakes SET status = 'ready' WHERE LOWER(wallet) = LOWER($1) AND status = 'active' AND unlocks_at <= NOW()`,
    [w]
  );

  const res = await pool.query(
    `SELECT *,
            EXTRACT(EPOCH FROM (unlocks_at - NOW())) AS seconds_remaining
       FROM gp_stakes
      WHERE LOWER(wallet) = LOWER($1)
      ORDER BY created_at DESC
      LIMIT 50`,
    [w]
  );

  const cfg = await getSettings();

  return res.rows.map(s => ({
    ...s,
    amount:        parseFloat(s.amount),
    yield_earned:  parseFloat(s.yield_earned),
    apy_pct:       parseFloat(s.apy_pct),
    seconds_remaining: Math.max(0, parseFloat(s.seconds_remaining) || 0),
    total_on_return: +(parseFloat(s.amount) + parseFloat(s.yield_earned)).toFixed(2),
  }));
}

async function getStakingInfo(wallet) {
  const cfg = await getSettings();
  const bonusRates = {};
  cfg.lockDaysOptions.forEach(d => {
    bonusRates[d] = getBonusMult(d, cfg);
  });

  // Pre-calculate yield examples for each lock period
  const yieldExamples = {};
  cfg.lockDaysOptions.forEach(d => {
    yieldExamples[d] = calculateYield(1000, cfg.apyPct, d, getBonusMult(d, cfg));
  });

  let activeStakes = 0;
  if (wallet) {
    const res = await pool.query(
      `SELECT COUNT(*) AS n FROM gp_stakes WHERE LOWER(wallet) = LOWER($1) AND status IN ('active','ready')`,
      [wallet.toLowerCase()]
    );
    activeStakes = parseInt(res.rows[0]?.n) || 0;
  }

  return {
    enabled: cfg.enabled,
    apy_pct: cfg.apyPct,
    min_amount: cfg.minAmount,
    max_amount: cfg.maxAmount,
    lock_days_options: cfg.lockDaysOptions,
    bonus_multipliers: bonusRates,
    yield_per_1000: yieldExamples,
    max_active: cfg.maxActive,
    active_stakes: activeStakes,
  };
}

async function getAdminStats() {
  const [totalsRes, activeRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)                                            AS total_stakes,
        COALESCE(SUM(amount), 0)                           AS total_staked_ever,
        COALESCE(SUM(yield_earned), 0)                     AS total_yield_ever,
        COUNT(*) FILTER (WHERE status IN ('active','ready')) AS active_count,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('active','ready')), 0) AS currently_locked,
        COALESCE(SUM(yield_earned) FILTER (WHERE status IN ('active','ready')), 0) AS pending_yield,
        COUNT(*) FILTER (WHERE status='withdrawn')         AS withdrawn_count
      FROM gp_stakes
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT s.wallet, u.nickname,
             SUM(s.amount) AS total_amount,
             COUNT(*) AS stake_count,
             SUM(s.yield_earned) AS total_yield
        FROM gp_stakes s
        LEFT JOIN users u ON LOWER(u.wallet_address) = LOWER(s.wallet)
       WHERE s.status IN ('active','ready')
       GROUP BY s.wallet, u.nickname
       ORDER BY total_amount DESC
       LIMIT 20
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'staking_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });
  const t = totalsRes.rows[0] || {};

  return {
    total_stakes:    parseInt(t.total_stakes)    || 0,
    total_staked:    parseFloat(t.total_staked_ever) || 0,
    total_yield:     parseFloat(t.total_yield_ever)  || 0,
    active_count:    parseInt(t.active_count)    || 0,
    currently_locked: parseFloat(t.currently_locked) || 0,
    pending_yield:   parseFloat(t.pending_yield)  || 0,
    withdrawn_count: parseInt(t.withdrawn_count) || 0,
    top_stakers:     activeRes.rows,
    settings:        settingsMap,
  };
}

module.exports = {
  createStake,
  withdrawStake,
  getMyStakes,
  getStakingInfo,
  calculateYield,
  getBonusMult,
  markReadyStakes,
  getAdminStats,
};

'use strict';
/**
 * GP Dividends Service — Migration 110
 * Platform revenue (marketplace fees, lottery house cut, burn) → weekly dividend pool.
 * Distributed proportionally to active stakers each Monday.
 */

const { pool } = require('../db');

let logGPActivity;
try { logGPActivity = require('../db').logGPActivity; } catch (_) {}
let notifyPlayer;
try { notifyPlayer = require('./notifications').notifyPlayer; } catch (_) {}
let seasonService;
try { seasonService = require('./season'); } catch (_) {}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
    .toISOString().slice(0, 10);
}

async function getSettings() {
  const keys = [
    'dividends_enabled', 'dividends_marketplace_pct', 'dividends_lottery_pct',
    'dividends_burn_pct', 'dividends_min_stake_for_div', 'dividends_distribute_day',
  ];
  const res = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });
  return {
    enabled:          (map.dividends_enabled || 'true') !== 'false',
    marketplacePct:   parseFloat(map.dividends_marketplace_pct) || 20,
    lotteryPct:       parseFloat(map.dividends_lottery_pct)     || 30,
    burnPct:          parseFloat(map.dividends_burn_pct)         || 10,
    minStake:         parseFloat(map.dividends_min_stake_for_div) || 100,
    distributeDay:    parseInt(map.dividends_distribute_day)     || 1,
  };
}

// ── Ensure pool exists for current week ──────────────────────────────────────

let _divDisabled = false;
async function ensureCurrentPool() {
  if (_divDisabled) return null;
  const weekStart = getWeekStart();
  try {
    await pool.query(
      `INSERT INTO gp_dividend_pool (week_start) VALUES ($1) ON CONFLICT (week_start) DO NOTHING`,
      [weekStart]
    );
    const res = await pool.query(`SELECT * FROM gp_dividend_pool WHERE week_start = $1`, [weekStart]);
    return res.rows[0];
  } catch (e) {
    // Table not provisioned on this deployment (archived migration 110). Disable permanently.
    if (e.code === '42P01' || e.code === '42703') {
      _divDisabled = true;
      console.log('[DIV] dividend pool disabled — schema not provisioned');
      return null;
    }
    throw e;
  }
}

// ── Add to pool ───────────────────────────────────────────────────────────────

/**
 * Add GP to the current week's dividend pool.
 * @param {number} amount - GP to add
 * @param {string} source - 'marketplace' | 'lottery' | 'burn'
 * @param {object} client - optional pg client for transactional use
 */
async function addToPool(amount, source) {
  if (amount <= 0) return;
  const cfg = await getSettings();
  if (!cfg.enabled) return;

  let pct;
  if (source === 'marketplace') pct = cfg.marketplacePct;
  else if (source === 'lottery')    pct = cfg.lotteryPct;
  else if (source === 'burn')       pct = cfg.burnPct;
  else return;

  const dividendAmount = +(amount * pct / 100).toFixed(6);
  if (dividendAmount <= 0) return;

  const weekStart = getWeekStart();
  await pool.query(
    `INSERT INTO gp_dividend_pool (week_start, pool_gp)
     VALUES ($1, $2)
     ON CONFLICT (week_start) DO UPDATE
       SET pool_gp = gp_dividend_pool.pool_gp + EXCLUDED.pool_gp`,
    [weekStart, dividendAmount]
  );
}

// ── Distribute ────────────────────────────────────────────────────────────────

/**
 * Distribute last week's dividend pool to all qualifying stakers.
 * Called by the weekly scheduler (Monday).
 */
async function distributeLastWeek() {
  const cfg = await getSettings();
  if (!cfg.enabled) return 0;

  // Last week's Monday
  const now = new Date();
  const lastWeekStart = getWeekStart(new Date(now.getTime() - 7 * 24 * 3600 * 1000));

  const poolRes = await pool.query(
    `SELECT * FROM gp_dividend_pool WHERE week_start = $1 AND is_distributed = false`,
    [lastWeekStart]
  );
  if (!poolRes.rows.length) return 0;

  const poolRow = poolRes.rows[0];
  const totalPool = parseFloat(poolRow.pool_gp);
  if (totalPool <= 0) return 0;

  // Snapshot active stakers at the START of last week (use staked_at < this week)
  const stakersRes = await pool.query(
    `SELECT wallet, SUM(amount) AS total_staked
       FROM gp_stakes
      WHERE status IN ('active', 'ready')
        AND staked_at < $1
        AND amount >= $2
      GROUP BY wallet
      HAVING SUM(amount) >= $2`,
    [lastWeekStart + 'T00:00:00Z', cfg.minStake]
  );

  if (!stakersRes.rows.length) {
    // No qualifying stakers — mark distributed with 0
    await pool.query(
      `UPDATE gp_dividend_pool SET is_distributed = true, distributed_at = NOW() WHERE id = $1`,
      [poolRow.id]
    );
    return 0;
  }

  const totalWeight = stakersRes.rows.reduce((sum, r) => sum + parseFloat(r.total_staked), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock pool row
    await client.query(`SELECT id FROM gp_dividend_pool WHERE id = $1 AND is_distributed = false FOR UPDATE`, [poolRow.id]);

    let totalDistributed = 0;

    for (const staker of stakersRes.rows) {
      const weight = parseFloat(staker.total_staked);
      const share = +(totalPool * (weight / totalWeight)).toFixed(6);
      if (share <= 0) continue;

      // Create claim record
      await client.query(
        `INSERT INTO gp_dividend_claims (pool_id, wallet, stake_weight, dividend_gp)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (pool_id, wallet) DO NOTHING`,
        [poolRow.id, staker.wallet, weight, share]
      );

      // Auto-pay the dividend (no manual claim needed — simpler UX)
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
        [staker.wallet, share]
      );
      await client.query(
        `UPDATE gp_dividend_claims SET claimed = true, claimed_at = NOW()
          WHERE pool_id = $1 AND wallet = $2`,
        [poolRow.id, staker.wallet]
      );

      totalDistributed += share;

      // Fire-and-forget notifications
      if (logGPActivity) logGPActivity(staker.wallet, share, 'dividend', `Weekly dividend: +${share.toFixed(2)} GP`).catch(() => {});
      if (notifyPlayer) notifyPlayer(staker.wallet, `💰 Weekly dividend: +${share.toFixed(2)} GP!`, 'dividend').catch(() => {});
      if (seasonService) seasonService.addSeasonScore(staker.wallet, 'gp_earn', Math.round(share)).catch(() => {});
    }

    // Mark pool as distributed
    await client.query(
      `UPDATE gp_dividend_pool
          SET is_distributed = true, distributed_at = NOW(),
              distributed_gp = $2, total_stake_weight = $3
        WHERE id = $1`,
      [poolRow.id, totalDistributed, totalWeight]
    );

    await client.query('COMMIT');

    console.log(`[DIV] Distributed ${totalDistributed.toFixed(2)} GP to ${stakersRes.rows.length} stakers for week ${lastWeekStart}`);
    return stakersRes.rows.length;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[DIV] distribution error:', e.message);
    return 0;
  } finally {
    client.release();
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

async function getDividendInfo(wallet) {
  const pool2 = await ensureCurrentPool();
  const cfg = await getSettings();

  // Get past dividends for this wallet
  let myHistory = [];
  if (wallet) {
    const w = wallet.toLowerCase();
    const hRes = await pool.query(
      `SELECT c.dividend_gp, c.stake_weight, c.claimed_at, p.week_start
         FROM gp_dividend_claims c
         JOIN gp_dividend_pool p ON p.id = c.pool_id
        WHERE c.wallet = $1 AND c.claimed = true
        ORDER BY p.week_start DESC LIMIT 10`,
      [w]
    );
    myHistory = hRes.rows;
  }

  return {
    enabled:          cfg.enabled,
    current_pool:     parseFloat(pool2?.pool_gp || 0),
    current_week:     pool2?.week_start || getWeekStart(),
    min_stake:        cfg.minStake,
    marketplace_pct:  cfg.marketplacePct,
    lottery_pct:      cfg.lotteryPct,
    burn_pct:         cfg.burnPct,
    my_history:       myHistory,
  };
}

async function getAdminStats() {
  const [poolsRes, settingsRes] = await Promise.all([
    pool.query(`
      SELECT p.*,
             COUNT(c.id)                           AS recipient_count,
             COALESCE(SUM(c.dividend_gp), 0)       AS actual_distributed
        FROM gp_dividend_pool p
        LEFT JOIN gp_dividend_claims c ON c.pool_id = p.id AND c.claimed = true
       GROUP BY p.id
       ORDER BY p.week_start DESC LIMIT 12
    `).catch(() => ({ rows: [] })),
    pool.query(`SELECT key, value FROM settings WHERE key LIKE 'dividends_%' ORDER BY key`).catch(() => ({ rows: [] })),
  ]);

  const settingsMap = {};
  settingsRes.rows.forEach(r => { settingsMap[r.key] = r.value; });

  const currentWeek = getWeekStart();
  const currentPool = poolsRes.rows.find(r => r.week_start === currentWeek);

  return {
    pools:           poolsRes.rows,
    current_pool:    currentPool || null,
    total_distributed: poolsRes.rows.reduce((s, r) => s + parseFloat(r.actual_distributed || 0), 0),
    settings:        settingsMap,
  };
}

module.exports = {
  addToPool,
  distributeLastWeek,
  getDividendInfo,
  ensureCurrentPool,
  getAdminStats,
};

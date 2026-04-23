'use strict';
const { pool, getSetting } = require('../db');
let seasonService; try { seasonService = require('./season'); } catch(_) {}

async function getCfg() {
  const [enabled, costGP, ptsPerBuy, threshRaw, namesRaw, iconsRaw, colorsRaw] = await Promise.all([
    getSetting('prestige_enabled',         'true'),
    getSetting('prestige_cost_gp',         '50'),
    getSetting('prestige_points_per_buy',  '1'),
    getSetting('prestige_rank_thresholds', '0,10,30,75,175,400'),
    getSetting('prestige_rank_names',      'Colonist,Pioneer,Explorer,Commander,Governor,Admiral'),
    getSetting('prestige_rank_icons',      '🪨,⛺,🔭,🚀,🏛️,⭐'),
    getSetting('prestige_rank_colors',     '#9e9e9e,#66bb6a,#42a5f5,#ab47bc,#ffa726,#ef5350'),
  ]);
  const thresholds = threshRaw.split(',').map(Number);
  const names      = namesRaw.split(',');
  const icons      = iconsRaw.split(',');
  const colors     = colorsRaw.split(',');
  return {
    enabled: enabled === 'true',
    costGP:  parseInt(costGP, 10),
    ptsPerBuy: parseInt(ptsPerBuy, 10),
    thresholds, names, icons, colors,
    maxRank: thresholds.length - 1,
  };
}

function rankForPoints(pts, thresholds) {
  let rank = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (pts >= thresholds[i]) { rank = i; break; }
  }
  return rank;
}

async function getPrestige(wallet) {
  const cfg = await getCfg();
  const { rows } = await pool.query(
    `SELECT prestige_points, prestige_rank, total_gp_spent, last_upgrade
     FROM colony_prestige WHERE wallet = $1`, [wallet]
  );
  const row = rows[0] || { prestige_points: 0, prestige_rank: 0, total_gp_spent: 0, last_upgrade: null };
  const currentRank = row.prestige_rank;
  const nextRank    = Math.min(currentRank + 1, cfg.maxRank);
  const nextThresh  = cfg.thresholds[nextRank];
  return {
    ...row,
    rankName:  cfg.names[currentRank]  || cfg.names[cfg.maxRank],
    rankIcon:  cfg.icons[currentRank]  || cfg.icons[cfg.maxRank],
    rankColor: cfg.colors[currentRank] || cfg.colors[cfg.maxRank],
    isMaxRank: currentRank >= cfg.maxRank,
    nextRankName: cfg.names[nextRank],
    nextThresh,
    pointsToNext: Math.max(0, nextThresh - row.prestige_points),
    cfg,
  };
}

async function buyPrestige(wallet) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Prestige system disabled');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRow = await client.query('SELECT gp_balance FROM users WHERE wallet=$1 FOR UPDATE', [wallet]);
    if (!balRow.rows.length) throw new Error('User not found');
    const bal = balRow.rows[0].gp_balance;
    if (bal < cfg.costGP) throw new Error(`Need ${cfg.costGP} GP`);

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet=$2', [cfg.costGP, wallet]);

    // upsert prestige row
    const { rows } = await client.query(
      `INSERT INTO colony_prestige(wallet, prestige_points, prestige_rank, total_gp_spent, last_upgrade)
       VALUES($1, $2, 0, $2, NOW())
       ON CONFLICT(wallet) DO UPDATE
         SET prestige_points = colony_prestige.prestige_points + $2,
             total_gp_spent  = colony_prestige.total_gp_spent  + $3,
             last_upgrade    = NOW()
       RETURNING prestige_points, prestige_rank`,
      [wallet, cfg.ptsPerBuy, cfg.costGP]
    );
    const { prestige_points: newPts, prestige_rank: oldRank } = rows[0];
    const newRank = rankForPoints(newPts, cfg.thresholds);
    if (newRank !== oldRank) {
      await client.query('UPDATE colony_prestige SET prestige_rank=$1 WHERE wallet=$2', [newRank, wallet]);
    }

    await client.query(
      `INSERT INTO prestige_log(wallet, gp_spent, points_gained, old_rank, new_rank)
       VALUES($1,$2,$3,$4,$5)`,
      [wallet, cfg.costGP, cfg.ptsPerBuy, oldRank, newRank]
    );

    await client.query(
      `INSERT INTO gp_transactions(wallet, amount, type, ref_id, note)
       VALUES($1,$2,'prestige',NULL,'Colony Prestige purchase')`,
      [wallet, -cfg.costGP]
    );

    await client.query('COMMIT');
    try { const { logGPActivity } = require('./gpActivity'); await logGPActivity(wallet, -cfg.costGP, 'prestige_buy', 'Colony Prestige purchase'); } catch(_) {}
    seasonService?.trackGPSpend?.(wallet, cfg.costGP, 'prestige').catch(()=>{});

    return { newPts, oldRank, newRank, rankedUp: newRank > oldRank,
             rankName: cfg.names[newRank] || cfg.names[cfg.maxRank],
             rankIcon: cfg.icons[newRank] || cfg.icons[cfg.maxRank] };
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function getLeaderboard() {
  const cfg = await getCfg();
  const { rows } = await pool.query(
    `SELECT cp.wallet, cp.prestige_points, cp.prestige_rank, cp.total_gp_spent,
            COALESCE(u.nickname, cp.wallet) AS nickname
     FROM colony_prestige cp
     LEFT JOIN users u ON u.wallet = cp.wallet
     ORDER BY cp.prestige_points DESC LIMIT 50`
  );
  return rows.map(r => ({
    ...r,
    rankName:  cfg.names[r.prestige_rank]  || cfg.names[cfg.maxRank],
    rankIcon:  cfg.icons[r.prestige_rank]  || cfg.icons[cfg.maxRank],
    rankColor: cfg.colors[r.prestige_rank] || cfg.colors[cfg.maxRank],
  }));
}

async function getAdminStats() {
  const { rows: [stats] } = await pool.query(
    `SELECT COUNT(*)::int AS total_players,
            COALESCE(SUM(total_gp_spent),0)::int AS total_gp_sunk,
            COALESCE(SUM(prestige_points),0)::int AS total_points
     FROM colony_prestige`
  );
  const { rows: dist } = await pool.query(
    `SELECT prestige_rank, COUNT(*)::int AS cnt FROM colony_prestige GROUP BY prestige_rank ORDER BY prestige_rank`
  );
  return { stats, dist };
}

module.exports = { getCfg, getPrestige, buyPrestige, getLeaderboard, getAdminStats };

const express = require('express');
const { pool } = require('../db');
const { cfg } = require('../utils/settingsCache');

const router = express.Router();

// GET /api/user/:wallet/base — BASE tab unified data.
router.get('/user/:wallet/base', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();

    try {
      const { recalcUserRank } = require('../services/rank');
      await recalcUserRank(wallet);
    } catch (_) {
      // Rank refresh is best-effort; BASE data should still load.
    }

    const [userRes, pixelRes, miningRes, rankRes] = await Promise.all([
      pool.query(
        'SELECT wallet_address, nickname, usdt_balance, pp_balance, xp, rank_level, referral_code, created_at FROM users WHERE LOWER(wallet_address) = LOWER($1)',
        [wallet]
      ),
      pool.query(`
        SELECT s.id AS sector_id, COALESCE(s.name, 'Uncharted') AS sector_name, COALESCE(s.tier, 'frontier') AS tier, COUNT(*) AS pixel_count
        FROM pixels p
        LEFT JOIN sectors s ON s.id = p.sector_id
        WHERE LOWER(p.owner) = LOWER($1)
        GROUP BY s.id, s.name, s.tier
        ORDER BY pixel_count DESC
      `, [wallet]),
      pool.query('SELECT * FROM user_mining WHERE LOWER(wallet_address) = LOWER($1)', [wallet]),
      pool.query('SELECT * FROM rank_definitions ORDER BY level')
    ]);

    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const mining = miningRes.rows[0] || null;
    const totalPixels = pixelRes.rows.reduce((sum, row) => sum + parseInt(row.pixel_count), 0);
    const settings = await cfg();

    const tierCounts = { core: 0, mid: 0, frontier: 0 };
    for (const row of pixelRes.rows) {
      if (row.tier) tierCounts[row.tier] = (tierCounts[row.tier] || 0) + parseInt(row.pixel_count);
    }

    const intervalCore = parseInt(settings.mining_interval_core) || 24;
    const intervalMid = parseInt(settings.mining_interval_mid) || 48;
    const intervalFrontier = parseInt(settings.mining_interval_frontier) || 72;
    const miningMultByTier = {
      core: parseFloat(settings.mining_core_mult) || 1.5,
      mid: parseFloat(settings.mining_mid_mult) || 1.2,
      frontier: parseFloat(settings.mining_frontier_mult) || 1.0
    };
    const miningIntervalByTier = {
      core: intervalCore,
      mid: intervalMid,
      frontier: intervalFrontier
    };
    let bestInterval = intervalFrontier;
    if (tierCounts.core > 0) bestInterval = intervalCore;
    else if (tierCounts.mid > 0) bestInterval = intervalMid;

    let harvestAvailable = totalPixels > 0;
    let nextHarvestAt = null;
    if (mining && mining.last_harvest_at) {
      const elapsed = (Date.now() - new Date(mining.last_harvest_at).getTime()) / (1000 * 60 * 60);
      if (elapsed < bestInterval) {
        harvestAvailable = false;
        nextHarvestAt = new Date(new Date(mining.last_harvest_at).getTime() + bestInterval * 3600000);
      }
    }

    const rewardMin = parseFloat(settings.mining_reward_min) || 0.01;
    const rewardMax = parseFloat(settings.mining_reward_max) || 0.5;
    const instantCost = parseFloat(settings.instant_harvest_cost_pp) || 0.5;
    const estimateFactor = totalPixels > 0 ? Math.min(Math.sqrt(totalPixels) / 10, 3.0) : 0;

    res.json({
      user: {
        wallet: user.wallet_address,
        nickname: user.nickname,
        usdt: parseFloat(user.usdt_balance),
        pp: parseFloat(user.pp_balance),
        xp: user.xp || 0,
        rank: user.rank_level || 1,
        referralCode: user.referral_code,
        joinedAt: user.created_at
      },
      miningInterval: {
        core: intervalCore,
        mid: intervalMid,
        frontier: intervalFrontier,
        best: bestInterval
      },
      miningRates: {
        rewardMin,
        rewardMax,
        coreMult: miningMultByTier.core,
        midMult: miningMultByTier.mid,
        frontierMult: miningMultByTier.frontier
      },
      territory: {
        totalPixels,
        tierCounts,
        bySector: pixelRes.rows.map(row => ({
          sectorId: row.sector_id,
          sectorName: row.sector_name,
          tier: row.tier,
          pixels: parseInt(row.pixel_count),
          miningBonus: miningMultByTier[row.tier] || miningMultByTier.frontier,
          harvestIntervalH: miningIntervalByTier[row.tier] || intervalFrontier,
          role: row.tier === 'core' ? 'core_industry' : row.tier === 'mid' ? 'contested_growth' : 'frontier_foothold'
        }))
      },
      mining: mining ? {
        lastHarvest: mining.last_harvest_at,
        totalMined: parseFloat(mining.total_mined_pp),
        todayMined: parseFloat(mining.today_mined_pp),
        harvestAvailable,
        nextHarvestAt,
        estimatedMin: Math.round(rewardMin * estimateFactor * 10000) / 10000,
        estimatedMax: Math.round(rewardMax * estimateFactor * 10000) / 10000,
        instantCost
      } : {
        lastHarvest: null,
        totalMined: 0,
        todayMined: 0,
        harvestAvailable,
        nextHarvestAt: null,
        estimatedMin: 0,
        estimatedMax: 0,
        instantCost
      },
      ranks: rankRes.rows.map(row => {
        const rank = {
          level: row.level,
          name: row.name,
          requiredXp: row.required_xp,
          rewardPp: parseFloat(row.reward_pp)
        };
        if (row.breakthrough) {
          rank.breakthrough = true;
          rank.breakthroughLabel = row.breakthrough_condition?.label || '';
          rank.breakthroughDesc = row.breakthrough_condition?.desc || '';
        }
        return rank;
      })
    });
  } catch (err) {
    console.error('[API] user base error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;

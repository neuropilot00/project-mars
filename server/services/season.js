const { pool } = require('../db');

// ═══════════════════════════════════════
//  GET ACTIVE SEASON
// ═══════════════════════════════════════

async function getActiveSeason() {
  const res = await pool.query(
    `SELECT * FROM seasons WHERE active = true AND starts_at <= NOW() AND ends_at > NOW() ORDER BY starts_at DESC LIMIT 1`
  );
  if (!res.rows.length) return null;
  const s = res.rows[0];
  return {
    id: s.id, name: s.name, theme: s.theme,
    startsAt: s.starts_at, endsAt: s.ends_at,
    rewards: s.rewards_json || [],
    weatherWeights: s.weather_weights || {},
    visualTint: s.visual_tint,
    remainingMs: new Date(s.ends_at).getTime() - Date.now()
  };
}

// ═══════════════════════════════════════
//  SEASON SCORE TRACKING
// ═══════════════════════════════════════

async function addSeasonScore(wallet, category, amount) {
  if (!wallet || !category || !amount) return;

  const season = await getActiveSeason();
  if (!season) return;

  // Map category to column + score multiplier
  const colMap = {
    claim_pixels: { col: 'pixels_claimed', multiplier: 1 },
    harvest: { col: 'harvests', multiplier: 5 },
    hijack: { col: 'hijacks_won', multiplier: 10 },
    poi: { col: 'pois_discovered', multiplier: 15 }
  };
  const mapping = colMap[category];
  if (!mapping) return;

  const scoreAdd = amount * mapping.multiplier;

  await pool.query(
    `INSERT INTO season_scores (season_id, wallet, score, ${mapping.col}, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (season_id, wallet) DO UPDATE SET
       score = season_scores.score + $3,
       ${mapping.col} = season_scores.${mapping.col} + $4,
       updated_at = NOW()`,
    [season.id, wallet, scoreAdd, amount]
  );
}

// ═══════════════════════════════════════
//  SEASON LEADERBOARD
// ═══════════════════════════════════════

async function getSeasonLeaderboard(seasonId, limit = 20) {
  // If no seasonId, use active season
  if (!seasonId) {
    const active = await getActiveSeason();
    if (!active) return [];
    seasonId = active.id;
  }

  const res = await pool.query(
    `SELECT ss.wallet, ss.score, ss.pixels_claimed, ss.harvests, ss.hijacks_won, ss.pois_discovered,
            u.nickname
     FROM season_scores ss
     LEFT JOIN users u ON u.wallet_address = ss.wallet
     WHERE ss.season_id = $1
     ORDER BY ss.score DESC
     LIMIT $2`,
    [seasonId, Math.min(limit, 100)]
  );

  return res.rows.map((r, i) => ({
    rank: i + 1,
    wallet: r.wallet,
    nickname: r.nickname || r.wallet.slice(0, 8) + '...',
    score: r.score,
    pixelsClaimed: r.pixels_claimed,
    harvests: r.harvests,
    hijacksWon: r.hijacks_won,
    poisDiscovered: r.pois_discovered
  }));
}

// ═══════════════════════════════════════
//  FINALIZE SEASON & DISTRIBUTE REWARDS
// ═══════════════════════════════════════

async function finalizeSeasonRewards(seasonId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark season inactive
    await client.query('UPDATE seasons SET active = false WHERE id = $1', [seasonId]);

    // Get season rewards config
    const seasonRes = await client.query('SELECT rewards_json FROM seasons WHERE id = $1', [seasonId]);
    const rewardsConfig = seasonRes.rows[0]?.rewards_json || [];

    // Get leaderboard
    const lb = await client.query(
      'SELECT wallet, score FROM season_scores WHERE season_id = $1 ORDER BY score DESC',
      [seasonId]
    );

    // Distribute rewards based on rank thresholds
    for (const entry of lb.rows) {
      const rank = lb.rows.indexOf(entry) + 1;

      // Find applicable reward (highest rank threshold that player qualifies for)
      let reward = null;
      for (const r of rewardsConfig) {
        if (rank <= r.rank) {
          if (!reward || r.rank < reward.rank) reward = r;
        }
      }
      if (!reward) continue;

      await client.query(
        `INSERT INTO season_rewards (season_id, wallet, rank, reward_type, reward_amount, reward_meta)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [seasonId, entry.wallet, rank, reward.type || 'pp', reward.amount || 0,
         JSON.stringify({ title: reward.title || null })]
      );
    }

    await client.query('COMMIT');
    console.log(`[SEASON] Finalized season #${seasonId}, rewarded ${lb.rows.length} players`);
    return { success: true, rewarded: lb.rows.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
//  CLAIM SEASON REWARD
// ═══════════════════════════════════════

async function claimSeasonReward(wallet, rewardId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      'SELECT * FROM season_rewards WHERE id = $1 AND wallet = $2 AND claimed = false FOR UPDATE',
      [rewardId, wallet]
    );
    if (!res.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Reward not found or already claimed' };
    }

    const reward = res.rows[0];

    // Credit the reward
    if (reward.reward_type === 'pp') {
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
    } else if (reward.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = gp_balance + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
    } else if (reward.reward_type === 'usdt') {
      await client.query('UPDATE users SET usdt_balance = usdt_balance + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
    }

    await client.query('UPDATE season_rewards SET claimed = true WHERE id = $1', [rewardId]);

    await client.query('COMMIT');
    console.log(`[SEASON] ${wallet} claimed reward #${rewardId}: ${reward.reward_amount} ${reward.reward_type}`);
    return { success: true, type: reward.reward_type, amount: parseFloat(reward.reward_amount) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
//  GET MY REWARDS
// ═══════════════════════════════════════

async function getMyRewards(wallet) {
  const res = await pool.query(
    `SELECT sr.id, sr.season_id, sr.rank, sr.reward_type, sr.reward_amount, sr.reward_meta, sr.claimed,
            s.name AS season_name
     FROM season_rewards sr
     JOIN seasons s ON s.id = sr.season_id
     WHERE sr.wallet = $1
     ORDER BY sr.created_at DESC`,
    [wallet]
  );
  return res.rows.map(r => ({
    id: r.id, seasonId: r.season_id, seasonName: r.season_name,
    rank: r.rank, type: r.reward_type, amount: parseFloat(r.reward_amount),
    meta: r.reward_meta, claimed: r.claimed
  }));
}

module.exports = {
  getActiveSeason, addSeasonScore,
  getSeasonLeaderboard, finalizeSeasonRewards,
  claimSeasonReward, getMyRewards
};

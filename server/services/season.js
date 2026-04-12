const { pool, getSetting } = require('../db');

// All possible season ranking categories (18+)
// Each season picks 6 from this list via active_categories
const ALL_CATEGORIES = [
  { key: 'overall',      col: 'score',              label: 'Overall Champion',  icon: '🏆', desc: 'Earn the highest total score across all activities' },
  { key: 'territory',    col: 'pixels_claimed',     label: 'Territory King',    icon: '🏴', desc: 'Claim the most land pixels on Mars' },
  { key: 'mining',       col: 'harvests',           label: 'Mining Master',     icon: '⛏️', desc: 'Harvest resources from your territory the most' },
  { key: 'combat',       col: 'hijacks_won',        label: 'Combat Legend',     icon: '⚔️', desc: 'Win the most hijack battles against other players' },
  { key: 'defender',     col: 'battles_lost',       label: 'Resilient Fighter', icon: '🛡️', desc: 'Survive the most attacks on your territory' },
  { key: 'explorer',     col: 'pois_discovered',    label: 'Explorer Elite',    icon: '🔭', desc: 'Discover the most POI markers on the globe' },
  { key: 'active',       col: 'tap_count',          label: 'Most Active',       icon: '👆', desc: 'Click & tap the most — just play the game!' },
  { key: 'shopper',      col: 'items_used',         label: 'Item Master',       icon: '🎒', desc: 'Buy and use the most items from the shop' },
  { key: 'quester',      col: 'quests_done',        label: 'Quest Hero',        icon: '📋', desc: 'Complete the most daily missions' },
  { key: 'big_spender',  col: 'gp_spent',           label: 'Big Spender',       icon: '💰', desc: 'Spend the most GP on items, hijacks, and upgrades' },
  { key: 'investor',     col: 'pp_spent',           label: 'PP Investor',       icon: '💎', desc: 'Spend the most PP on premium features' },
  { key: 'fortifier',    col: 'shields_placed',     label: 'Fortress Builder',  icon: '🏰', desc: 'Place the most shields on your territories' },
  { key: 'wanderer',     col: 'sectors_entered',    label: 'Sector Wanderer',   icon: '🗺️', desc: 'Explore and visit the most different sectors' },
  { key: 'dedicated',    col: 'login_days',         label: 'Most Dedicated',    icon: '📅', desc: 'Log in every day — consistency is key!' },
  { key: 'fashionista',  col: 'cosmetics_equipped', label: 'Mars Fashionista',  icon: '👗', desc: 'Equip the most cosmetic items to your territory' },
  { key: 'gambler',      col: 'cantina_plays',      label: 'Cantina Regular',   icon: '🎰', desc: 'Play the most mini-games in the Cantina' },
  { key: 'team_player',  col: 'guild_contributions',label: 'Team Player',       icon: '🤝', desc: 'Contribute the most to your guild activities' },
  { key: 'recruiter',    col: 'referrals',          label: 'Top Recruiter',     icon: '📢', desc: 'Invite the most new players via referral' },
  { key: 'social',       col: 'chat_messages',      label: 'Social Butterfly',  icon: '💬', desc: 'Send the most chat messages to other players' },
  { key: 'earner',       col: 'total_gp_earned',    label: 'GP Tycoon',         icon: '🪙', desc: 'Earn the most GP from all sources combined' },
  { key: 'whale',        col: 'total_pp_earned',    label: 'PP Whale',          icon: '🐋', desc: 'Earn the most PP from mining and discoveries' },
  { key: 'loser',        col: 'pixels_lost',        label: 'Never Give Up',     icon: '💪', desc: 'Lost pixels to hijacks? Keep fighting back!' },
  { key: 'streaker',     col: 'longest_streak',     label: 'Streak Master',     icon: '🔥', desc: 'Maintain the longest daily login streak' },
  { key: 'astronaut',    col: 'rockets_joined',     label: 'Rocket Rider',      icon: '🚀', desc: 'Claim loot from the most rocket supply drops' },
  { key: 'weatherman',   col: 'weather_checks',     label: 'Storm Chaser',      icon: '🌪️', desc: 'Check the Mars weather forecast frequently' },
  { key: 'namer',        col: 'territory_renames',  label: 'Name Artist',       icon: '✏️', desc: 'Rename your territories the most times' },
  { key: 'influencer',   col: 'shares_count',       label: 'Mars Influencer',   icon: '📤', desc: 'Share your stats and territory the most' }
];

// ═══════════════════════════════════════
//  GET ACTIVE SEASON
// ═══════════════════════════════════════

async function getActiveSeason() {
  const res = await pool.query(
    `SELECT * FROM seasons WHERE active = true AND starts_at <= NOW() AND ends_at > NOW() ORDER BY starts_at DESC LIMIT 1`
  );
  if (!res.rows.length) return null;
  const s = res.rows[0];
  // Map active category keys to full definitions
  const activeCatKeys = s.active_categories || ['overall','territory','mining','combat','explorer','active'];
  const activeCategories = ALL_CATEGORIES.filter(c => activeCatKeys.includes(c.key));

  return {
    id: s.id, name: s.name, theme: s.theme,
    startsAt: s.starts_at, endsAt: s.ends_at,
    rewards: s.rewards_json || [],
    weatherWeights: s.weather_weights || {},
    visualTint: s.visual_tint,
    remainingMs: new Date(s.ends_at).getTime() - Date.now(),
    activeCategories: activeCategories,
    allCategories: ALL_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon, desc: c.desc }))
  };
}

// ═══════════════════════════════════════
//  SEASON SCORE TRACKING
// ═══════════════════════════════════════

async function addSeasonScore(wallet, category, amount) {
  if (!wallet || !category || !amount) return;

  const season = await getActiveSeason();
  if (!season) return;

  // All 18+ categories — always tracked, score multiplier 0 = track only (no overall score boost)
  const colMap = {
    claim_pixels:   { col: 'pixels_claimed',     settingKey: 'season_mult_pixels',    defaultMult: 1 },
    harvest:        { col: 'harvests',            settingKey: 'season_mult_harvest',   defaultMult: 5 },
    hijack:         { col: 'hijacks_won',         settingKey: 'season_mult_hijack',    defaultMult: 10 },
    hijack_loss:    { col: 'battles_lost',        settingKey: 'season_mult_loss',      defaultMult: 0 },
    poi:            { col: 'pois_discovered',     settingKey: 'season_mult_poi',       defaultMult: 15 },
    tap:            { col: 'tap_count',           settingKey: 'season_mult_tap',       defaultMult: 0 },
    item_use:       { col: 'items_used',          settingKey: 'season_mult_item',      defaultMult: 0 },
    quest:          { col: 'quests_done',         settingKey: 'season_mult_quest',     defaultMult: 0 },
    gp_spend:       { col: 'gp_spent',            settingKey: 'season_mult_gp_spend',  defaultMult: 0 },
    pp_spend:       { col: 'pp_spent',            settingKey: 'season_mult_pp_spend',  defaultMult: 0 },
    shield:         { col: 'shields_placed',      settingKey: 'season_mult_shield',    defaultMult: 0 },
    sector_enter:   { col: 'sectors_entered',     settingKey: 'season_mult_sector',    defaultMult: 0 },
    login:          { col: 'login_days',          settingKey: 'season_mult_login',     defaultMult: 0 },
    cosmetic:       { col: 'cosmetics_equipped',  settingKey: 'season_mult_cosmetic',  defaultMult: 0 },
    cantina:        { col: 'cantina_plays',       settingKey: 'season_mult_cantina',   defaultMult: 0 },
    guild_contrib:  { col: 'guild_contributions', settingKey: 'season_mult_guild',     defaultMult: 0 },
    referral:       { col: 'referrals',           settingKey: 'season_mult_referral',  defaultMult: 0 },
    chat:           { col: 'chat_messages',       settingKey: 'season_mult_chat',      defaultMult: 0 },
    gp_earn:        { col: 'total_gp_earned',     settingKey: 'season_mult_gp_earn',   defaultMult: 0 },
    pp_earn:        { col: 'total_pp_earned',     settingKey: 'season_mult_pp_earn',   defaultMult: 0 },
    pixel_loss:     { col: 'pixels_lost',         settingKey: 'season_mult_pixloss',   defaultMult: 0 },
    streak:         { col: 'longest_streak',      settingKey: 'season_mult_streak',    defaultMult: 0 },
    rocket:         { col: 'rockets_joined',      settingKey: 'season_mult_rocket',    defaultMult: 0 },
    weather:        { col: 'weather_checks',      settingKey: 'season_mult_weather',   defaultMult: 0 },
    rename:         { col: 'territory_renames',   settingKey: 'season_mult_rename',    defaultMult: 0 },
    share:          { col: 'shares_count',        settingKey: 'season_mult_share',     defaultMult: 0 }
  };
  const mapping = colMap[category];
  if (!mapping) return;

  const multiplier = await getSetting(mapping.settingKey, mapping.defaultMult);
  const scoreAdd = amount * multiplier;

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
            COALESCE(ss.tap_count, 0) AS tap_count, u.nickname
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
    poisDiscovered: r.pois_discovered,
    tapCount: parseInt(r.tap_count)
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

    // Category-based reward distribution
    // Each category has its own leaderboard — players can win multiple awards
    // Get season's active categories (admin selects 6 per season)
    const seasonFull = await client.query('SELECT active_categories FROM seasons WHERE id = $1', [seasonId]);
    const activeCatKeys = seasonFull.rows[0]?.active_categories || ['overall','territory','mining','combat','explorer','active'];

    // Filter ALL_CATEGORIES to only active ones for this season
    const categories = ALL_CATEGORIES.filter(c => activeCatKeys.includes(c.key));

    let totalRewarded = 0;

    for (const cat of categories) {
      // Get category leaderboard
      const lb = await client.query(
        `SELECT wallet, ${cat.col} AS val FROM season_scores
         WHERE season_id = $1 AND ${cat.col} > 0
         ORDER BY ${cat.col} DESC`,
        [seasonId]
      );

      // Find rewards for this category
      const catRewards = rewardsConfig.filter(r => r.category === cat.key);
      if (!catRewards.length) continue;

      for (let i = 0; i < lb.rows.length; i++) {
        const playerRank = i + 1;
        const entry = lb.rows[i];

        // Find the best tier this player qualifies for
        let bestTier = null;
        for (const r of catRewards) {
          if (playerRank <= r.rank) {
            if (!bestTier || r.rank < bestTier) bestTier = r.rank;
          }
        }
        if (bestTier === null) continue;

        // Give ALL rewards at that tier for this category
        const tierRewards = catRewards.filter(r => r.rank === bestTier);
        for (const reward of tierRewards) {
          await client.query(
            `INSERT INTO season_rewards (season_id, wallet, rank, reward_type, reward_amount, reward_meta)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [seasonId, entry.wallet, playerRank, reward.type || 'gp', reward.amount || 0,
             JSON.stringify({
               title: reward.title || null,
               item_code: reward.item_code || null,
               category: cat.key,
               categoryLabel: cat.label
             })]
          );
        }
        totalRewarded++;
      }
    }

    await client.query('COMMIT');
    console.log(`[SEASON] Finalized season #${seasonId}, rewarded ${totalRewarded} entries across ${categories.length} categories`);
    return { success: true, rewarded: totalRewarded };
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

    // Credit the reward based on type
    const meta = reward.reward_meta || {};
    let rewardLabel = '';

    if (reward.reward_type === 'pp') {
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' PP';
    } else if (reward.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' GP';
    } else if (reward.reward_type === 'xp') {
      await client.query('UPDATE users SET xp = xp + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' XP';
    } else if (reward.reward_type === 'item' && meta.item_code) {
      // Give item to user inventory
      const itemRes = await client.query('SELECT id FROM item_types WHERE code = $1 AND active = true', [meta.item_code]);
      if (itemRes.rows.length) {
        await client.query(
          `INSERT INTO user_items (wallet, item_type_id, quantity) VALUES ($1, $2, $3)
           ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
          [wallet, itemRes.rows[0].id, Math.max(1, reward.reward_amount)]
        );
        rewardLabel = reward.reward_amount + 'x ' + meta.item_code;
      }
    } else if (reward.reward_type === 'usdt') {
      await client.query('UPDATE users SET usdt_balance = usdt_balance + $1 WHERE wallet_address = $2',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' USDT';
    }

    await client.query('UPDATE season_rewards SET claimed = true WHERE id = $1', [rewardId]);

    await client.query('COMMIT');
    console.log(`[SEASON] ${wallet} claimed reward #${rewardId}: ${rewardLabel}`);
    return {
      success: true, type: reward.reward_type, amount: parseFloat(reward.reward_amount),
      title: meta.title || null, itemCode: meta.item_code || null
    };
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

// ═══════════════════════════════════════
//  SEASON PASS
// ═══════════════════════════════════════

async function getSeasonPass(wallet) {
  const season = await getActiveSeason();
  if (!season) return { error: 'No active season' };

  // Get or create progress
  await pool.query(
    `INSERT INTO season_pass_progress (season_id, wallet) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [season.id, wallet]
  );
  const prog = await pool.query(
    'SELECT * FROM season_pass_progress WHERE season_id = $1 AND wallet = $2',
    [season.id, wallet]
  );
  const p = prog.rows[0];

  // Get tiers
  const tiers = await getOrCreatePassTiers(season.id);

  // Get claimed tiers
  const claimed = await pool.query(
    'SELECT tier, is_premium FROM season_pass_claims WHERE season_id = $1 AND wallet = $2',
    [season.id, wallet]
  );
  const claimedSet = new Set(claimed.rows.map(r => `${r.tier}-${r.is_premium}`));

  return {
    seasonId: season.id,
    seasonName: season.name,
    xp: p.pass_xp,
    currentTier: p.current_tier,
    isPremium: p.is_premium,
    tiers: tiers.map(t => ({
      ...t,
      claimed: claimedSet.has(`${t.tier}-${t.is_premium}`),
      unlocked: p.pass_xp >= t.xp_required
    }))
  };
}

async function getOrCreatePassTiers(seasonId) {
  const existing = await pool.query(
    'SELECT * FROM season_pass_tiers WHERE season_id = $1 ORDER BY tier, is_premium',
    [seasonId]
  );
  if (existing.rows.length > 0) return existing.rows;

  // Auto-generate default tiers
  const maxTier = parseInt(await getSetting('season_pass_max_tier') || '30');
  const baseXp = parseInt(await getSetting('season_pass_xp_per_tier') || '100');

  const tiers = [];
  for (let t = 1; t <= maxTier; t++) {
    const xpReq = Math.floor(baseXp * Math.pow(1.15, t - 1) * t);

    // Free track rewards
    let freeType = 'gp', freeAmount = 10 * t;
    if (t % 5 === 0) { freeType = 'pp'; freeAmount = Math.floor(t / 5) * 0.5; }
    if (t === maxTier) { freeType = 'pp'; freeAmount = 5; }

    tiers.push({ season_id: seasonId, tier: t, is_premium: false,
      reward_type: freeType, reward_amount: freeAmount, xp_required: xpReq });

    // Premium track rewards (better)
    let premType = 'gp', premAmount = 25 * t;
    if (t % 3 === 0) { premType = 'pp'; premAmount = Math.floor(t / 3) * 0.3; }
    if (t % 10 === 0) { premType = 'item'; premAmount = 1; }
    if (t === maxTier) { premType = 'pp'; premAmount = 15; }

    tiers.push({ season_id: seasonId, tier: t, is_premium: true,
      reward_type: premType, reward_amount: premAmount, xp_required: xpReq });
  }

  // Batch insert
  for (const t of tiers) {
    await pool.query(
      `INSERT INTO season_pass_tiers (season_id, tier, is_premium, reward_type, reward_amount, xp_required)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [t.season_id, t.tier, t.is_premium, t.reward_type, t.reward_amount, t.xp_required]
    );
  }

  return tiers;
}

async function addPassXP(wallet, action) {
  const season = await getActiveSeason();
  if (!season) return;

  const xpMap = {
    harvest: 'season_pass_xp_per_harvest',
    claim: 'season_pass_xp_per_claim',
    invasion: 'season_pass_xp_per_invasion',
    exploration: 'season_pass_xp_per_exploration',
    quest: 'season_pass_xp_per_quest'
  };
  const settingKey = xpMap[action];
  if (!settingKey) return;

  const xp = parseInt(await getSetting(settingKey) || '5');

  await pool.query(
    `INSERT INTO season_pass_progress (season_id, wallet, pass_xp) VALUES ($1, $2, $3)
     ON CONFLICT (season_id, wallet) DO UPDATE SET pass_xp = season_pass_progress.pass_xp + $3`,
    [season.id, wallet, xp]
  );
}

async function purchasePremiumPass(wallet) {
  const season = await getActiveSeason();
  if (!season) return { error: 'No active season' };

  const cost = parseInt(await getSetting('season_pass_premium_cost_gp') || '500');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check already premium
    const prog = await client.query(
      'SELECT is_premium FROM season_pass_progress WHERE season_id = $1 AND wallet = $2',
      [season.id, wallet]
    );
    if (prog.rows[0]?.is_premium) {
      await client.query('ROLLBACK');
      return { error: 'Already have premium pass' };
    }

    // Check GP
    const gp = await client.query('SELECT gp_balance FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
    if (parseFloat(gp.rows[0]?.gp_balance || 0) < cost) {
      await client.query('ROLLBACK');
      return { error: `Need ${cost} GP for premium pass` };
    }

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2', [cost, wallet]);
    await client.query(
      `INSERT INTO season_pass_progress (season_id, wallet, is_premium, purchased_at)
       VALUES ($1, $2, true, NOW())
       ON CONFLICT (season_id, wallet) DO UPDATE SET is_premium = true, purchased_at = NOW()`,
      [season.id, wallet]
    );

    await client.query('COMMIT');
    return { success: true, cost };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

async function claimPassTier(wallet, tier, isPremium) {
  const season = await getActiveSeason();
  if (!season) return { error: 'No active season' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get progress
    const prog = await client.query(
      'SELECT * FROM season_pass_progress WHERE season_id = $1 AND wallet = $2 FOR UPDATE',
      [season.id, wallet]
    );
    if (!prog.rows.length) { await client.query('ROLLBACK'); return { error: 'No progress found' }; }
    const p = prog.rows[0];

    // Premium check
    if (isPremium && !p.is_premium) {
      await client.query('ROLLBACK');
      return { error: 'Need premium pass for premium rewards' };
    }

    // Get tier info
    const tierRes = await client.query(
      'SELECT * FROM season_pass_tiers WHERE season_id = $1 AND tier = $2 AND is_premium = $3',
      [season.id, tier, isPremium]
    );
    if (!tierRes.rows.length) { await client.query('ROLLBACK'); return { error: 'Tier not found' }; }
    const t = tierRes.rows[0];

    // XP check
    if (p.pass_xp < t.xp_required) {
      await client.query('ROLLBACK');
      return { error: `Need ${t.xp_required} XP (have ${p.pass_xp})` };
    }

    // Already claimed check
    const already = await client.query(
      'SELECT id FROM season_pass_claims WHERE season_id=$1 AND wallet=$2 AND tier=$3 AND is_premium=$4',
      [season.id, wallet, tier, isPremium]
    );
    if (already.rows.length) { await client.query('ROLLBACK'); return { error: 'Already claimed' }; }

    // Give reward
    let label = '';
    if (t.reward_type === 'pp') {
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [t.reward_amount, wallet]);
      label = t.reward_amount + ' PP';
    } else if (t.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE wallet_address = $2', [t.reward_amount, wallet]);
      label = t.reward_amount + ' GP';
    } else if (t.reward_type === 'xp') {
      await client.query('UPDATE users SET xp = xp + $1 WHERE wallet_address = $2', [t.reward_amount, wallet]);
      label = t.reward_amount + ' XP';
    } else if (t.reward_type === 'item') {
      const meta = t.reward_meta || {};
      if (meta.item_code) {
        const itemRes = await client.query('SELECT id FROM item_types WHERE code = $1', [meta.item_code]);
        if (itemRes.rows.length) {
          await client.query(
            `INSERT INTO user_items (wallet, item_type_id, quantity) VALUES ($1, $2, $3)
             ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + $3`,
            [wallet, itemRes.rows[0].id, Math.max(1, t.reward_amount)]
          );
        }
      }
      label = 'Item reward';
    }

    // Record claim
    await client.query(
      'INSERT INTO season_pass_claims (season_id, wallet, tier, is_premium) VALUES ($1,$2,$3,$4)',
      [season.id, wallet, tier, isPremium]
    );

    // Update current tier
    await client.query(
      'UPDATE season_pass_progress SET current_tier = GREATEST(current_tier, $1) WHERE season_id = $2 AND wallet = $3',
      [tier, season.id, wallet]
    );

    await client.query('COMMIT');
    return { success: true, tier, isPremium, rewardType: t.reward_type, rewardAmount: parseFloat(t.reward_amount), label };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

module.exports = {
  ALL_CATEGORIES,
  getActiveSeason, addSeasonScore,
  getSeasonLeaderboard, finalizeSeasonRewards,
  claimSeasonReward, getMyRewards,
  // Season Pass (migration 068)
  getSeasonPass, addPassXP, purchasePremiumPass, claimPassTier
};

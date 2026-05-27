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
  { key: 'influencer',   col: 'shares_count',       label: 'Mars Influencer',   icon: '📤', desc: 'Share your stats and territory the most' },
  { key: 'enhancer',    col: 'enhancements_done',  label: 'Master Crafter',    icon: '⚗️', desc: 'Attempt the most cosmetic item enhancements' },
  { key: 'trader',      col: 'trades_completed',   label: 'Market Mogul',      icon: '🛒', desc: 'Complete the most marketplace & auction trades' },
  { key: 'naval_champ', col: 'naval_wins',         label: 'Naval Champion',    icon: '⚓', desc: 'Win the most naval battles against other fleets' },
  { key: 'shipwright',  col: 'ships_built',        label: 'Grand Shipwright',  icon: '🚢', desc: 'Build the most ships in your fleet' }
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
    share:          { col: 'shares_count',        settingKey: 'season_mult_share',     defaultMult: 0 },
    enhance:        { col: 'enhancements_done',   settingKey: 'season_mult_enhance',   defaultMult: 1 },
    trade:          { col: 'trades_completed',    settingKey: 'season_mult_trade',     defaultMult: 5 },
    naval_win:      { col: 'naval_wins',          settingKey: 'season_mult_naval_win', defaultMult: 20 },
    ship_build:     { col: 'ships_built',         settingKey: 'season_mult_ship_build',defaultMult: 3 }
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
            COALESCE(ss.tap_count, 0) AS tap_count,
            COALESCE(ss.enhancements_done, 0) AS enhancements_done,
            COALESCE(ss.trades_completed, 0) AS trades_completed,
            COALESCE(ss.naval_wins, 0) AS naval_wins,
            COALESCE(ss.ships_built, 0) AS ships_built,
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
    poisDiscovered: r.pois_discovered,
    tapCount: parseInt(r.tap_count),
    enhancementsDone: parseInt(r.enhancements_done),
    tradesCompleted: parseInt(r.trades_completed),
    navalWins: parseInt(r.naval_wins),
    shipsBuilt: parseInt(r.ships_built)
  }));
}

// ═══════════════════════════════════════
//  CATEGORY LEADERBOARD
// ═══════════════════════════════════════

async function getCategoryLeaderboard(categoryKey, limit = 10) {
  const cat = ALL_CATEGORIES.find(c => c.key === categoryKey);
  if (!cat) return null;

  const season = await getActiveSeason();
  if (!season) return { category: cat, entries: [], seasonId: null };

  const res = await pool.query(
    `SELECT ss.wallet, ss.${cat.col} AS val, u.nickname
     FROM season_scores ss
     LEFT JOIN users u ON u.wallet_address = ss.wallet
     WHERE ss.season_id = $1 AND ss.${cat.col} > 0
     ORDER BY ss.${cat.col} DESC
     LIMIT $2`,
    [season.id, Math.min(limit, 50)]
  );

  return {
    category: { key: cat.key, label: cat.label, icon: cat.icon, desc: cat.desc },
    seasonId: season.id,
    entries: res.rows.map((r, i) => ({
      rank: i + 1,
      wallet: r.wallet,
      nickname: r.nickname || r.wallet.slice(0, 8) + '...',
      value: parseInt(r.val) || 0
    }))
  };
}

// ═══════════════════════════════════════
//  CAREER STATS
// ═══════════════════════════════════════

async function getCareerStats(wallet) {
  const w = wallet.toLowerCase();

  const [userRes, battleRes, enhRes, shipRes, tradeRes, seasonRes] = await Promise.all([
    pool.query('SELECT nickname, created_at, xp FROM users WHERE wallet_address = $1', [w]),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE attacker = $1 AND success = true) AS wins,
        COUNT(*) FILTER (WHERE (attacker = $1 OR defender = $1) AND NOT (attacker = $1 AND success = true)) AS losses,
        COALESCE(SUM(attack_cost) FILTER (WHERE attacker = $1 AND success = true), 0) AS gp_won
      FROM battles WHERE attacker = $1 OR defender = $1`, [w]),
    pool.query(`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE success = true) AS successes,
             COALESCE(SUM(gp_cost), 0) AS total_gp
      FROM enhancement_log WHERE wallet = $1`, [w]),
    pool.query(`
      SELECT COUNT(*) AS total, COALESCE(SUM(gp_cost), 0) AS total_gp
      FROM ship_build_log WHERE wallet_address = $1`, [w]),
    pool.query(`
      SELECT COUNT(*) AS total
      FROM marketplace_listings WHERE (seller = $1 OR buyer = $1) AND status = 'sold'`, [w]),
    pool.query(`
      SELECT SUM(ss.score) AS total_score, SUM(ss.pixels_claimed) AS pixels,
             SUM(ss.harvests) AS harvests, SUM(ss.enhancements_done) AS enhancements,
             SUM(ss.trades_completed) AS trades, SUM(ss.naval_wins) AS naval_wins,
             SUM(ss.ships_built) AS ships_built
      FROM season_scores ss WHERE ss.wallet = $1`, [w])
  ]);

  const user = userRes.rows[0] || {};
  const battle = battleRes.rows[0] || {};
  const enh = enhRes.rows[0] || {};
  const ship = shipRes.rows[0] || {};
  const trade = tradeRes.rows[0] || {};
  const season = seasonRes.rows[0] || {};

  return {
    wallet: w,
    nickname: user.nickname || w.slice(0, 8) + '...',
    memberSince: user.created_at,
    xp: parseInt(user.xp) || 0,
    battles: {
      wins: parseInt(battle.wins) || 0,
      losses: parseInt(battle.losses) || 0,
      gpWon: parseFloat(battle.gp_won) || 0
    },
    enhancements: {
      total: parseInt(enh.total) || 0,
      successes: parseInt(enh.successes) || 0,
      totalGP: parseFloat(enh.total_gp) || 0,
      successRate: enh.total > 0 ? ((enh.successes / enh.total) * 100).toFixed(1) : '0.0'
    },
    ships: {
      built: parseInt(ship.total) || 0,
      totalGP: parseFloat(ship.total_gp) || 0
    },
    trades: {
      total: parseInt(trade.total) || 0
    },
    allTime: {
      score: parseInt(season.total_score) || 0,
      pixelsClaimed: parseInt(season.pixels) || 0,
      harvests: parseInt(season.harvests) || 0,
      enhancements: parseInt(season.enhancements) || 0,
      trades: parseInt(season.trades) || 0,
      navalWins: parseInt(season.naval_wins) || 0,
      shipsBuilt: parseInt(season.ships_built) || 0
    }
  };
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
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' PP';
    } else if (reward.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
        [reward.reward_amount, wallet]);
      rewardLabel = reward.reward_amount + ' GP';
    } else if (reward.reward_type === 'xp') {
      await client.query('UPDATE users SET xp = xp + $1 WHERE LOWER(wallet_address) = LOWER($2)',
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
      // ✅ [솔벤시] USDT 보상도 미담보 발행이므로 담보 여유분(room) 이내만 지급 — 뱅크런 불변식 유지.
      // 운영자가 redemption 담보를 적립해야 USDT 보상이 지급 가능(부족 시 보상 청구 보류).
      const usdtReward = Number(reward.reward_amount) || 0;
      if (usdtReward > 0) {
        try {
          const _treasury = require('./treasury');
          if (await _treasury.guardEnabled(getSetting)) {
            const { room } = await _treasury.lockRoom(client);
            if (usdtReward > room + 1e-9) {
              await client.query('ROLLBACK');
              return { success: false, error: 'usdt_reward_collateral_insufficient', room, required: usdtReward };
            }
          }
        } catch (e) {
          if (!(e && e.code)) { await client.query('ROLLBACK'); return { success: false, error: 'treasury_guard_error' }; }
          /* treasury_ledger 미생성 환경 → 가드 미적용 */
        }
      }
      await client.query('UPDATE users SET usdt_balance = usdt_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)',
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
    const xpReq = Math.floor(baseXp * Math.pow(1.15, t - 1));

    // Free track rewards (GP only, no PP)
    let freeType = 'gp', freeAmount = 10 * t;
    if (t % 5 === 0) { freeAmount = 50 * t; } // bonus every 5th tier
    if (t === maxTier) { freeAmount = 500; }

    tiers.push({ season_id: seasonId, tier: t, is_premium: false,
      reward_type: freeType, reward_amount: freeAmount, xp_required: xpReq });

    // Premium track rewards (GP + items, no PP)
    let premType = 'gp', premAmount = 25 * t;
    if (t % 10 === 0) { premType = 'gp'; premAmount = 100 * t; }
    if (t === maxTier) { premType = 'gp'; premAmount = 1500; }

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

  const cost = parseInt(await getSetting('season_pass_premium_cost_gp') || '150');

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
    const gp = await client.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address) = LOWER($1) FOR UPDATE', [wallet]);
    if (parseFloat(gp.rows[0]?.gp_balance || 0) < cost) {
      await client.query('ROLLBACK');
      return { error: `Need ${cost} GP for premium pass` };
    }

    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address) = LOWER($2) AND gp_balance >= $1', [cost, wallet]);
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
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE LOWER(wallet_address) = LOWER($2)', [t.reward_amount, wallet]);
      label = t.reward_amount + ' PP';
    } else if (t.reward_type === 'gp') {
      await client.query('UPDATE users SET gp_balance = COALESCE(gp_balance,0) + $1 WHERE LOWER(wallet_address) = LOWER($2)', [t.reward_amount, wallet]);
      label = t.reward_amount + ' GP';
    } else if (t.reward_type === 'xp') {
      await client.query('UPDATE users SET xp = xp + $1 WHERE LOWER(wallet_address) = LOWER($2)', [t.reward_amount, wallet]);
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

    // Record claim (ON CONFLICT DO NOTHING as idempotency guard)
    const claimInsert = await client.query(
      'INSERT INTO season_pass_claims (season_id, wallet, tier, is_premium) VALUES ($1,$2,$3,$4) ON CONFLICT (season_id, wallet, tier, is_premium) DO NOTHING RETURNING id',
      [season.id, wallet, tier, isPremium]
    );
    if (claimInsert.rowCount === 0) {
      await client.query('ROLLBACK');
      return { error: 'Already claimed' };
    }

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

// ═══════════════════════════════════════
//  AUTO SEASON ROTATION
// ═══════════════════════════════════════

const THEME_CONFIG = {
  volcanic:     { tint: 'rgba(255,80,30,0.06)',  weather: { dust_storm:0.10, meteor_shower:0.15, solar_flare:0.10, cold_wave:0.05, clear:0.60 } },
  ice_age:      { tint: 'rgba(100,180,255,0.06)', weather: { dust_storm:0.05, meteor_shower:0.08, solar_flare:0.02, cold_wave:0.30, clear:0.55 } },
  solar_storm:  { tint: 'rgba(255,200,50,0.06)',  weather: { dust_storm:0.08, meteor_shower:0.10, solar_flare:0.30, cold_wave:0.02, clear:0.50 } },
  dust_epoch:   { tint: 'rgba(180,140,80,0.06)',   weather: { dust_storm:0.30, meteor_shower:0.10, solar_flare:0.05, cold_wave:0.05, clear:0.50 } }
};

const THEME_NAMES = {
  volcanic:    ['Volcanic Dawn','Molten Core','Magma Rising','Eruption','Lava Surge'],
  ice_age:     ['Frozen Frontier','Glacial Epoch','Permafrost','Cryo Storm','Ice Rift'],
  solar_storm: ['Solar Inferno','Plasma Blaze','Sunfire','Corona Burst','Stellar Flare'],
  dust_epoch:  ['Dust Epoch','Sandstorm','Rust Wind','Desert Fury','Dune Tide']
};

// Generate default rewards for a category
function _defaultRewards(catKey) {
  return [
    { category: catKey, rank: 1, type: 'gp', amount: catKey === 'overall' ? 3000 : 2000 },
    { category: catKey, rank: 1, type: 'xp', amount: catKey === 'overall' ? 500 : 400 },
    { category: catKey, rank: 3, type: 'gp', amount: catKey === 'overall' ? 1500 : 1000 },
    { category: catKey, rank: 3, type: 'xp', amount: 200 },
    { category: catKey, rank: 10, type: 'gp', amount: catKey === 'overall' ? 500 : 300 },
    { category: catKey, rank: 10, type: 'xp', amount: 100 }
  ];
}

async function autoRotateSeason() {
  try {
    const enabled = await getSetting('season_auto_rotation', true);
    if (enabled === false || enabled === 'false') return null;

    // Check if there's a currently active season
    const active = await pool.query(
      `SELECT * FROM seasons WHERE active = true AND starts_at <= NOW() ORDER BY starts_at DESC LIMIT 1`
    );

    if (active.rows.length) {
      const s = active.rows[0];
      // Still running?
      if (new Date(s.ends_at).getTime() > Date.now()) return null;

      // Season ended — finalize rewards and deactivate
      console.log(`[SEASON] Season #${s.id} "${s.name}" ended. Finalizing...`);
      try {
        await finalizeSeasonRewards(s.id);
      } catch (e) {
        console.error('[SEASON] Finalize error:', e.message);
      }
      // titleExtended: 시즌 종료 칭호 부여 (non-blocking)
      try {
        const titleExt = require('./titleExtended');
        titleExt.awardSeasonTitles(s.id, s.id).catch(() => {});
      } catch (_) {}
      await pool.query('UPDATE seasons SET active = false WHERE id = $1', [s.id]);
    }

    // Check if there's a pre-created future season waiting
    const queued = await pool.query(
      `SELECT * FROM seasons WHERE active = false AND starts_at <= NOW() AND ends_at > NOW() ORDER BY starts_at ASC LIMIT 1`
    );
    if (queued.rows.length) {
      // Activate the queued season
      await pool.query('UPDATE seasons SET active = true WHERE id = $1', [queued.rows[0].id]);
      console.log(`[SEASON] Activated queued season #${queued.rows[0].id} "${queued.rows[0].name}"`);
      return queued.rows[0].id;
    }

    // No queued season — auto-create a new one
    const durationDays = parseInt(await getSetting('season_duration_days', 30));

    // Pick theme: avoid repeating the last one
    const lastSeason = await pool.query('SELECT theme FROM seasons ORDER BY id DESC LIMIT 1');
    const lastTheme = lastSeason.rows.length ? lastSeason.rows[0].theme : null;
    const themes = Object.keys(THEME_CONFIG).filter(t => t !== lastTheme);
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const cfg = THEME_CONFIG[theme];

    // Pick random season name
    const names = THEME_NAMES[theme];
    const seasonNum = await pool.query('SELECT COUNT(*) AS cnt FROM seasons');
    const num = parseInt(seasonNum.rows[0].cnt) + 1;
    const nameBase = names[Math.floor(Math.random() * names.length)];
    const seasonName = 'Season ' + num + ': ' + nameBase;

    // Pick 5 random categories (excluding 'overall') + always include 'overall'
    const nonOverall = ALL_CATEGORIES.filter(c => c.key !== 'overall');
    const shuffled = nonOverall.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 5).map(c => c.key);
    const activeCats = ['overall'].concat(picked);

    // Build rewards for each active category
    let rewards = [];
    for (const catKey of activeCats) {
      rewards = rewards.concat(_defaultRewards(catKey));
    }
    // Bonus: overall rank 1 gets PP
    rewards.push({ category: 'overall', rank: 1, type: 'pp', amount: 0.5 });

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Conditional INSERT — only succeeds when no active season exists yet.
    // This makes the auto-create step idempotent: two concurrent scheduler runs
    // that both pass the "no active season" check above will race here, and only
    // one INSERT will win; the other returns rowCount=0 and is silently skipped.
    const res = await pool.query(
      `INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint, active_categories)
       SELECT $1, $2, $3, $4, true, $5, $6, $7, $8
       WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE active = true AND ends_at > NOW())
       RETURNING id`,
      [seasonName, theme, startsAt.toISOString(), endsAt.toISOString(),
       JSON.stringify(rewards), JSON.stringify(cfg.weather), cfg.tint,
       JSON.stringify(activeCats)]
    );

    if (res.rowCount === 0) {
      // Another concurrent auto-rotate already created an active season — skip
      console.log('[SEASON] Concurrent auto-rotate detected, skipping duplicate INSERT');
      return null;
    }

    console.log(`[SEASON] Auto-created "${seasonName}" (#${res.rows[0].id}), theme=${theme}, categories=[${activeCats.join(',')}], ends=${endsAt.toISOString()}`);
    return res.rows[0].id;
  } catch (e) {
    console.error('[SEASON] Auto-rotation error:', e.message);
    return null;
  }
}

// trackGPSpend(wallet, gpAmount) — routes (duel/rental/contest/crafting/vip/claimUpgrades) 가 호출하던 alias.
// 이전엔 export 되지 않아 truthy 가드(`if (seasonService.trackGPSpend)`)에서 silently skip → gp_spend 시즌 점수 미집계.
async function trackGPSpend(wallet, gpAmount) {
  try {
    const amt = Math.round(parseFloat(gpAmount) || 0);
    if (amt <= 0 || !wallet) return null;
    return await addSeasonScore(wallet, 'gp_spend', amt);
  } catch (_) { return null; }
}

module.exports = {
  ALL_CATEGORIES,
  getActiveSeason, addSeasonScore, trackGPSpend,
  getSeasonLeaderboard, finalizeSeasonRewards,
  claimSeasonReward, getMyRewards,
  // Category leaderboards + career stats (migration 098)
  getCategoryLeaderboard, getCareerStats,
  // Season Pass (migration 068)
  getSeasonPass, addPassXP, purchasePremiumPass, claimPassTier,
  // Auto rotation
  autoRotateSeason
};

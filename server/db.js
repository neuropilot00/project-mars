const { Pool } = require('pg');
const { runMigrations } = require('./migrate');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ── Schema initialization ──
async function initDB() {
  // Run file-based migrations first
  try {
    await runMigrations();
  } catch (err) {
    console.error('[DB] Migration failed, falling back to inline schema:', err.message);
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address VARCHAR(42) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        nickname VARCHAR(50),
        usdt_balance DECIMAL(20,6) DEFAULT 0,
        pp_balance DECIMAL(20,6) DEFAULT 0,
        referred_by VARCHAR(42),
        referral_code VARCHAR(20) UNIQUE,
        withdrawal_nonce INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) NOT NULL,
        amount DECIMAL(20,6) NOT NULL,
        pp_bonus DECIMAL(20,6) NOT NULL,
        chain VARCHAR(10) NOT NULL,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        block_number BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pixels (
        lat DECIMAL(8,2) NOT NULL,
        lng DECIMAL(8,2) NOT NULL,
        owner VARCHAR(42),
        price DECIMAL(20,6) DEFAULT 0.1,
        claim_id INT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (lat, lng)
      );

      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(42) NOT NULL,
        center_lat DECIMAL(8,2) NOT NULL,
        center_lng DECIMAL(8,2) NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        image_url TEXT,
        original_image_url TEXT,
        link_url TEXT,
        total_paid DECIMAL(20,6) NOT NULL,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all')),
        from_wallet VARCHAR(42),
        to_wallet VARCHAR(42),
        usdt_amount DECIMAL(20,6) DEFAULT 0,
        pp_amount DECIMAL(20,6) DEFAULT 0,
        fee DECIMAL(20,6) DEFAULT 0,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Game settings (key-value config)
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Events (time-limited promotions)
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Game items (future-proof)
      CREATE TABLE IF NOT EXISTS game_items (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price_usdt DECIMAL(20,6) DEFAULT 0,
        price_pp DECIMAL(20,6) DEFAULT 0,
        config JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Admin audit log
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        target VARCHAR(255),
        details JSONB,
        admin_auth VARCHAR(20),
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Referral rewards log
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id SERIAL PRIMARY KEY,
        from_wallet VARCHAR(42) NOT NULL,
        to_wallet VARCHAR(42) NOT NULL,
        tier INT NOT NULL,
        pp_amount DECIMAL(20,6) NOT NULL,
        trigger_type VARCHAR(20) NOT NULL,
        trigger_tx_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      -- Email auth columns (safe to re-run)
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_nonce INTEGER DEFAULT 0;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS original_image_url TEXT;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
      CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_to ON referral_rewards(to_wallet);
      CREATE INDEX IF NOT EXISTS idx_referral_rewards_from ON referral_rewards(from_wallet);
      CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON deposits(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels(owner);
      CREATE INDEX IF NOT EXISTS idx_claims_owner ON claims(owner);
      CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_wallet);
      CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_events_active ON events(active, starts_at, ends_at);
      CREATE INDEX IF NOT EXISTS idx_game_items_category ON game_items(category, active);
    `);

    // Seed default settings if empty
    await seedDefaults(client);

    console.log('[DB] Schema initialized');
  } finally {
    client.release();
  }
}

// ── Seed default game settings ──
async function seedDefaults(client) {
  const defaults = [
    // ── Economy: Pixel pricing ──
    { key: 'pixel_base_price', value: 0.10, desc: 'Default base price per unclaimed pixel (USDT)', cat: 'economy' },
    { key: 'price_pixel_core', value: 0.15, desc: 'Core sector pixel price (USDT)', cat: 'economy' },
    { key: 'price_pixel_mid', value: 0.05, desc: 'Mid sector pixel price (USDT)', cat: 'economy' },
    { key: 'price_pixel_frontier', value: 0.02, desc: 'Frontier sector pixel price (USDT)', cat: 'economy' },
    { key: 'dynamic_price_enabled', value: true, desc: 'Enable dynamic pricing based on sector occupancy', cat: 'economy' },
    { key: 'dynamic_price_core_mult', value: 3, desc: 'Dynamic price tier multiplier for Core sectors', cat: 'economy' },
    { key: 'dynamic_price_mid_mult', value: 2, desc: 'Dynamic price tier multiplier for Mid sectors', cat: 'economy' },
    { key: 'dynamic_price_frontier_mult', value: 1, desc: 'Dynamic price tier multiplier for Frontier sectors', cat: 'economy' },

    // ── Economy: Hijack ──
    { key: 'hijack_multiplier', value: 1.2, desc: 'Price multiplier for hijacking owned pixels', cat: 'economy' },
    { key: 'hijack_owner_refund', value: 100, desc: 'Refund % of original price to hijacked owner', cat: 'economy' },
    { key: 'hijack_owner_bonus', value: 50, desc: 'Bonus % of premium to hijacked owner (rest → treasury)', cat: 'economy' },

    // ── Economy: Deposit / Swap / Withdraw ──
    { key: 'deposit_pp_bonus', value: 10, desc: 'PP bonus % on USDT deposit', cat: 'economy' },
    { key: 'swap_fee_percent', value: 5, desc: 'Fee % on PP→USDT swap', cat: 'economy' },
    { key: 'withdraw_fee_percent', value: 0, desc: 'Fee % on USDT withdrawal', cat: 'economy' },
    { key: 'signup_pp_bonus', value: 100, desc: 'PP gifted to new users on registration (0=disabled)', cat: 'economy' },

    // ── Sector tax & distribution ──
    { key: 'sector_tax_rate', value: 2, desc: 'Sector transaction tax % on claim/hijack', cat: 'sector' },
    { key: 'tax_platform_share', value: 60, desc: '% of sector tax → platform treasury', cat: 'sector' },
    { key: 'tax_governor_share', value: 20, desc: '% of sector tax → sector governor', cat: 'sector' },
    { key: 'tax_citizen_share', value: 20, desc: '% of sector tax → active citizens pool (proportional)', cat: 'sector' },
    { key: 'governor_in_citizen_pool', value: false, desc: 'Include governor in citizen distribution pool', cat: 'sector' },
    { key: 'governor_min_pixels', value: 10, desc: 'Min pixels to qualify as governor candidate', cat: 'sector' },
    { key: 'governor_election_cycle_hours', value: 168, desc: 'Governor re-election cycle (hours, 168=weekly)', cat: 'sector' },
    { key: 'governor_tax_payout_cycle_hours', value: 168, desc: 'Tax payout cycle (hours)', cat: 'sector' },

    // ── Citizen conditions ──
    { key: 'citizen_min_pixels', value: 1, desc: 'Min pixels in sector to qualify as citizen', cat: 'sector' },
    { key: 'citizen_activity_window_days', value: 7, desc: 'Days of recent activity required for citizen status', cat: 'sector' },
    { key: 'citizen_min_actions_per_week', value: 3, desc: 'Min weekly actions for citizen status', cat: 'sector' },
    { key: 'citizen_snapshot_mode', value: 'average', desc: 'Distribution snapshot mode: average / random / fixed', cat: 'sector' },

    // ── Mining ──
    { key: 'mining_enabled', value: true, desc: 'Enable/disable mining system', cat: 'mining' },
    { key: 'mining_base_rate', value: 0.001, desc: 'Base PP per pixel per harvest cycle', cat: 'mining' },
    { key: 'mining_interval_hours', value: 4, desc: 'Hours between harvest cycles', cat: 'mining' },
    { key: 'mining_bonus_core', value: 1.5, desc: 'Mining multiplier for Core sectors', cat: 'mining' },
    { key: 'mining_bonus_mid', value: 1.2, desc: 'Mining multiplier for Mid sectors', cat: 'mining' },
    { key: 'mining_bonus_frontier', value: 1.0, desc: 'Mining multiplier for Frontier sectors', cat: 'mining' },
    { key: 'mining_governor_bonus', value: 1.2, desc: 'Extra mining multiplier for governor', cat: 'mining' },
    { key: 'mining_global_cap', value: 0, desc: 'Global daily PP mining cap (0=unlimited)', cat: 'mining' },
    { key: 'pp_daily_earn_cap_per_user', value: 0, desc: 'Per-user daily PP earn cap (0=unlimited)', cat: 'mining' },

    // ── Maintenance fee ──
    { key: 'maintenance_fee_enabled', value: true, desc: 'Enable weekly maintenance fee for large holders', cat: 'mining' },
    { key: 'maintenance_fee_threshold', value: 100, desc: 'Pixel count above which maintenance fee applies', cat: 'mining' },
    { key: 'maintenance_fee_rate', value: 0.5, desc: 'Weekly PP fee per pixel above threshold', cat: 'mining' },

    // ── Rank / XP ──
    { key: 'xp_per_claim', value: 2, desc: 'XP per pixel on new claim', cat: 'rank' },
    { key: 'xp_per_hijack', value: 3, desc: 'XP per pixel on hijack', cat: 'rank' },
    { key: 'xp_per_login', value: 5, desc: 'XP for daily login', cat: 'rank' },
    { key: 'xp_first_deposit', value: 50, desc: 'XP bonus for first deposit', cat: 'rank' },
    { key: 'xp_per_survival_day', value: 1, desc: 'XP per pixel per 7-day survival (unhijacked)', cat: 'rank' },
    { key: 'rank_max_level', value: 20, desc: 'Maximum rank level', cat: 'rank' },

    // ── Quest ──
    { key: 'quest_enabled', value: true, desc: 'Enable/disable quest system', cat: 'quest' },
    { key: 'quest_daily_reward_pp', value: 15, desc: 'Average PP reward for daily quests', cat: 'quest' },
    { key: 'quest_weekly_reward_pp', value: 75, desc: 'Average PP reward for weekly quests', cat: 'quest' },
    { key: 'quest_daily_reward_xp', value: 5, desc: 'XP reward for daily quests', cat: 'quest' },
    { key: 'quest_weekly_reward_xp', value: 30, desc: 'XP reward for weekly quests', cat: 'quest' },

    // ── Referral ──
    { key: 'referral_enabled', value: true, desc: 'Enable/disable referral system', cat: 'referral' },
    { key: 'referral_tier1_percent', value: 15, desc: 'Tier 1 referral PP reward % on hijack', cat: 'referral' },
    { key: 'referral_tier2_percent', value: 10, desc: 'Tier 2 referral PP reward % on hijack', cat: 'referral' },
    { key: 'referral_tier3_percent', value: 5, desc: 'Tier 3 referral PP reward % on hijack', cat: 'referral' },

    // ── Arena ──
    { key: 'arena_enabled', value: true, desc: 'Enable/disable arena', cat: 'arena' },
    { key: 'arena_house_edge', value: 5, desc: 'Arena betting house edge %', cat: 'arena' },
    { key: 'arena_sector_mode', value: false, desc: 'Sector-based arena races (future)', cat: 'arena' },

    // ── Limits ──
    { key: 'min_deposit', value: 1, desc: 'Minimum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_deposit', value: 100000, desc: 'Maximum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_claim_width', value: 500, desc: 'Maximum claim width in pixels', cat: 'limits' },
    { key: 'max_claim_height', value: 500, desc: 'Maximum claim height in pixels', cat: 'limits' },
    { key: 'min_withdraw', value: 10, desc: 'Minimum withdrawal amount (USDT)', cat: 'limits' },
    { key: 'max_image_size_mb', value: 5, desc: 'Maximum image upload size (MB)', cat: 'limits' },
    { key: 'max_search_results', value: 50, desc: 'Max search results returned', cat: 'limits' },
    { key: 'claims_load_limit', value: 5000, desc: 'Max claims loaded on frontend init', cat: 'limits' },

    // ── PP economy controls ──
    { key: 'pp_withdrawal_min', value: 100, desc: 'Minimum PP for withdrawal conversion', cat: 'economy' },
    { key: 'pp_withdrawal_fee_rate', value: 5, desc: 'PP withdrawal conversion fee %', cat: 'economy' },

    // ── Display / System ──
    { key: 'announcement', value: '', desc: 'Global announcement banner text (empty=hidden)', cat: 'display' },
    { key: 'maintenance_mode', value: false, desc: 'Disable all transactions when true', cat: 'system' },
    { key: 'settings_cache_ttl_ms', value: 30000, desc: 'Settings cache refresh interval (ms)', cat: 'system' },
  ];

  for (const d of defaults) {
    await client.query(
      `INSERT INTO settings (key, value, description, category)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [d.key, JSON.stringify(d.value), d.desc, d.cat]
    );
  }
}

// ── Helper: ensure user exists ──
async function ensureUser(client, wallet) {
  await client.query(
    `INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING`,
    [wallet.toLowerCase()]
  );
}

// ── Helper: get all settings as flat object ──
async function getSettings() {
  const res = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  for (const row of res.rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ── Helper: get single setting ──
async function getSetting(key, fallback) {
  const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return res.rows.length ? res.rows[0].value : fallback;
}

// ── Helper: get active events ──
async function getActiveEvents() {
  const res = await pool.query(
    `SELECT * FROM events WHERE active = true AND starts_at <= NOW() AND ends_at > NOW() ORDER BY starts_at`
  );
  return res.rows;
}

// ── Helper: get referral chain (up to 3 tiers) ──
async function getReferralChain(client, wallet) {
  const chain = [];
  let current = wallet.toLowerCase();
  for (let tier = 1; tier <= 3; tier++) {
    const res = await client.query(
      'SELECT referred_by FROM users WHERE wallet_address = $1',
      [current]
    );
    if (!res.rows.length || !res.rows[0].referred_by) break;
    const referrer = res.rows[0].referred_by;
    // Prevent circular references
    if (chain.some(c => c.wallet === referrer) || referrer === wallet.toLowerCase()) break;
    chain.push({ wallet: referrer, tier });
    current = referrer;
  }
  return chain;
}

// ── Helper: generate referral code ──
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Check breakthrough conditions ──
async function checkBreakthroughCondition(client, wallet, condition) {
  if (!condition) return true;
  const type = condition.type;

  if (type === 'pixels') {
    const r = await client.query('SELECT COUNT(*) AS cnt FROM pixels WHERE owner = $1', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'sectors') {
    const r = await client.query('SELECT COUNT(DISTINCT sector_id) AS cnt FROM pixels WHERE owner = $1', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'quests') {
    const r = await client.query("SELECT COUNT(*) AS cnt FROM user_quests WHERE wallet = $1 AND status = 'claimed'", [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'deposit') {
    const r = await client.query('SELECT COALESCE(SUM(amount),0) AS total FROM deposits WHERE wallet_address = $1', [wallet]);
    return parseFloat(r.rows[0].total) >= condition.min;
  }
  if (type === 'play_days') {
    const r = await client.query('SELECT created_at FROM users WHERE wallet_address = $1', [wallet]);
    if (!r.rows.length) return false;
    const days = (Date.now() - new Date(r.rows[0].created_at).getTime()) / (1000 * 60 * 60 * 24);
    return days >= condition.min;
  }
  if (type === 'hijacks') {
    const r = await client.query("SELECT COUNT(*) AS cnt FROM transactions WHERE from_wallet = $1 AND type = 'hijack'", [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'games_played') {
    const r = await client.query(
      "SELECT (SELECT COUNT(*) FROM crash_bets WHERE wallet = $1) + (SELECT COUNT(*) FROM mines_games WHERE wallet = $1) AS cnt",
      [wallet]
    );
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'referrals') {
    const r = await client.query('SELECT COUNT(*) AS cnt FROM users WHERE referred_by = (SELECT referral_code FROM users WHERE wallet_address = $1)', [wallet]);
    return parseInt(r.rows[0].cnt) >= condition.min;
  }
  if (type === 'multi') {
    for (const sub of (condition.conditions || [])) {
      const ok = await checkBreakthroughCondition(client, wallet, sub);
      if (!ok) return false;
    }
    return true;
  }
  return true;
}

// ── Award XP and check rank-up (shared across routes) ──
async function awardXP(client, wallet, xpAmount) {
  if (!xpAmount || xpAmount <= 0) return null;
  const res = await client.query(
    'UPDATE users SET xp = xp + $1, total_actions = total_actions + 1 WHERE wallet_address = $2 RETURNING xp, rank_level',
    [xpAmount, wallet]
  );
  if (!res.rows.length) return null;
  const { xp, rank_level } = res.rows[0];

  // Find highest achievable rank (considering breakthrough gates)
  const rankRes = await client.query(
    'SELECT level, name, reward_pp, breakthrough, breakthrough_condition FROM rank_definitions WHERE level > $1 AND required_xp <= $2 ORDER BY level ASC',
    [rank_level, xp]
  );

  let newLevel = rank_level;
  let newRankName = null;
  let totalRewardPp = 0;
  let blockedAt = null;

  for (const rank of rankRes.rows) {
    if (rank.breakthrough) {
      // Check if already unlocked
      const unlocked = await client.query(
        'SELECT 1 FROM user_breakthroughs WHERE wallet_address = $1 AND level = $2',
        [wallet, rank.level]
      );
      if (!unlocked.rows.length) {
        // Check if condition is met
        const cond = rank.breakthrough_condition;
        const met = await checkBreakthroughCondition(client, wallet, cond);
        if (met) {
          // Auto-unlock
          await client.query(
            'INSERT INTO user_breakthroughs (wallet_address, level) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [wallet, rank.level]
          );
        } else {
          // Blocked! Can't pass this gate
          blockedAt = { level: rank.level, condition: cond };
          break;
        }
      }
    }
    // This rank is reachable
    newLevel = rank.level;
    newRankName = rank.name;
    totalRewardPp += parseFloat(rank.reward_pp) || 0;
  }

  if (newLevel > rank_level) {
    await client.query('UPDATE users SET rank_level = $1 WHERE wallet_address = $2', [newLevel, wallet]);
    if (totalRewardPp > 0) {
      await client.query('UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2', [totalRewardPp, wallet]);
    }
    return { newLevel, name: newRankName, rewardPp: totalRewardPp, blockedAt };
  }
  return blockedAt ? { blockedAt } : null;
}

module.exports = { pool, initDB, ensureUser, getSettings, getSetting, getActiveEvents, getReferralChain, generateReferralCode, awardXP };

const { Pool } = require('pg');
const { runMigrations } = require('./migrate');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
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
    // Economy
    { key: 'pixel_base_price', value: 0.10, desc: 'Base price per unclaimed pixel (USDT)', cat: 'economy' },
    { key: 'hijack_multiplier', value: 1.2, desc: 'Price multiplier for hijacking owned pixels', cat: 'economy' },
    { key: 'deposit_pp_bonus', value: 10, desc: 'PP bonus % on USDT deposit', cat: 'economy' },
    { key: 'swap_fee_percent', value: 5, desc: 'Fee % on PP→USDT swap', cat: 'economy' },
    { key: 'withdraw_fee_percent', value: 0, desc: 'Fee % on USDT withdrawal', cat: 'economy' },
    { key: 'hijack_owner_refund', value: 100, desc: 'Refund % of original price to hijacked owner', cat: 'economy' },
    { key: 'hijack_owner_bonus', value: 50, desc: 'Bonus % of premium to hijacked owner (rest → treasury)', cat: 'economy' },
    // Referral
    { key: 'referral_tier1_percent', value: 15, desc: 'Tier 1 referral PP reward % on hijack', cat: 'referral' },
    { key: 'referral_tier2_percent', value: 10, desc: 'Tier 2 referral PP reward % on hijack', cat: 'referral' },
    { key: 'referral_tier3_percent', value: 5, desc: 'Tier 3 referral PP reward % on hijack', cat: 'referral' },
    { key: 'referral_enabled', value: true, desc: 'Enable/disable referral system', cat: 'referral' },
    // Signup
    { key: 'signup_pp_bonus', value: 100, desc: 'PP gifted to new users on registration (0=disabled)', cat: 'economy' },
    // Limits
    { key: 'min_deposit', value: 1, desc: 'Minimum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_deposit', value: 100000, desc: 'Maximum deposit amount (USDT)', cat: 'limits' },
    { key: 'max_claim_width', value: 500, desc: 'Maximum claim width in pixels', cat: 'limits' },
    { key: 'max_claim_height', value: 500, desc: 'Maximum claim height in pixels', cat: 'limits' },
    { key: 'min_withdraw', value: 10, desc: 'Minimum withdrawal amount (USDT)', cat: 'limits' },
    // Display
    { key: 'announcement', value: '', desc: 'Global announcement banner text (empty=hidden)', cat: 'display' },
    { key: 'maintenance_mode', value: false, desc: 'Disable all transactions when true', cat: 'system' },
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

module.exports = { pool, initDB, ensureUser, getSettings, getSetting, getActiveEvents, getReferralChain, generateReferralCode };

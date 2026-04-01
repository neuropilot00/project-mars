-- 001_initial_schema.sql
-- Initial schema extracted from db.js initDB()

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

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

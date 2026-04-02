-- ═══════════════════════════════════════════
--  019: Arena Games — Crash & Mines
-- ═══════════════════════════════════════════

-- Crash game rounds
CREATE TABLE IF NOT EXISTS crash_rounds (
  id SERIAL PRIMARY KEY,
  crash_point NUMERIC(10,2) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','running','crashed')),
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crash bets
CREATE TABLE IF NOT EXISTS crash_bets (
  id SERIAL PRIMARY KEY,
  round_id INT REFERENCES crash_rounds(id),
  wallet VARCHAR(255) NOT NULL,
  bet_amount NUMERIC(12,4) NOT NULL,
  currency VARCHAR(4) NOT NULL DEFAULT 'PP' CHECK (currency IN ('PP','USDT')),
  cashout_at NUMERIC(10,2),
  payout NUMERIC(12,4) DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cashed','busted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crash_bets_round ON crash_bets(round_id);
CREATE INDEX IF NOT EXISTS idx_crash_bets_wallet ON crash_bets(wallet);

-- Mines games
CREATE TABLE IF NOT EXISTS mines_games (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(255) NOT NULL,
  bet_amount NUMERIC(12,4) NOT NULL,
  currency VARCHAR(4) NOT NULL DEFAULT 'PP' CHECK (currency IN ('PP','USDT')),
  mine_count INT NOT NULL DEFAULT 5,
  grid TEXT NOT NULL,
  revealed TEXT NOT NULL DEFAULT '[]',
  current_multiplier NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cashed','busted')),
  payout NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mines_wallet ON mines_games(wallet);

-- Arena settings
INSERT INTO settings (key, value) VALUES
  ('crash_min_bet', '0.1'),
  ('crash_max_bet', '50'),
  ('crash_house_edge', '0.04'),
  ('mines_min_bet', '0.1'),
  ('mines_max_bet', '20'),
  ('mines_house_edge', '0.03')
ON CONFLICT (key) DO NOTHING;

-- Add arena transaction types
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit','claim','hijack','swap','withdraw','withdraw_all','mining','rank_reward','referral','quest','crash_bet','crash_win','mines_bet','mines_win'));

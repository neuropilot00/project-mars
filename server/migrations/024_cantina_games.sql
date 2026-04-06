-- 024_cantina_games.sql
-- New Cantina mini-games: Coinflip (Sandstorm Survival), Dice (Meteorite Prediction), Hi-Lo (Terrain Survey)

CREATE TABLE IF NOT EXISTS coinflip_games (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  bet_amount DECIMAL(20,6) NOT NULL,
  currency VARCHAR(4) DEFAULT 'PP',
  choice VARCHAR(10) NOT NULL,
  result VARCHAR(10) NOT NULL,
  payout DECIMAL(20,6) DEFAULT 0,
  seed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dice_games (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  bet_amount DECIMAL(20,6) NOT NULL,
  currency VARCHAR(4) DEFAULT 'PP',
  target INT NOT NULL,
  direction VARCHAR(5) NOT NULL,
  roll INT NOT NULL,
  multiplier DECIMAL(10,4),
  payout DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hilo_games (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  bet_amount DECIMAL(20,6) NOT NULL,
  currency VARCHAR(4) DEFAULT 'PP',
  status VARCHAR(10) DEFAULT 'active',
  cards JSONB DEFAULT '[]',
  current_multiplier DECIMAL(10,4) DEFAULT 1,
  payout DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coinflip_wallet ON coinflip_games (wallet);
CREATE INDEX IF NOT EXISTS idx_dice_wallet ON dice_games (wallet);
CREATE INDEX IF NOT EXISTS idx_hilo_wallet_status ON hilo_games (wallet, status);

-- Add new transaction types for cantina games
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit','claim','hijack','swap','withdraw','withdraw_all',
    'mining','rank_reward','referral','quest',
    'crash_bet','crash_win','mines_bet','mines_win',
    'coinflip_bet','coinflip_win',
    'dice_bet','dice_win',
    'hilo_bet','hilo_win'
  ));

-- Seed default bet limit settings for new games
INSERT INTO settings (key, value, description, category)
VALUES
  ('coinflip_min_bet', '0.1', 'Min bet for Coinflip game', 'arena'),
  ('coinflip_max_bet', '500', 'Max bet for Coinflip game', 'arena'),
  ('dice_min_bet', '0.1', 'Min bet for Dice game', 'arena'),
  ('dice_max_bet', '500', 'Max bet for Dice game', 'arena'),
  ('hilo_min_bet', '0.1', 'Min bet for Hi-Lo game', 'arena'),
  ('hilo_max_bet', '500', 'Max bet for Hi-Lo game', 'arena')
ON CONFLICT (key) DO NOTHING;

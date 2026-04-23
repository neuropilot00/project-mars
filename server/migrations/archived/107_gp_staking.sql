-- Migration 107: GP Staking System
-- Players lock GP for fixed periods (7/14/30 days) and earn a configurable yield.
-- Creates a GP sink, rewards long-term players, reduces sell pressure.

CREATE TABLE IF NOT EXISTS gp_stakes (
  id            SERIAL PRIMARY KEY,
  wallet        VARCHAR(100)   NOT NULL,
  amount        DECIMAL(20,6)  NOT NULL,
  apy_pct       DECIMAL(8,4)   NOT NULL DEFAULT 15.0,   -- APY snapshot at staking time
  lock_days     INT            NOT NULL DEFAULT 7,
  yield_earned  DECIMAL(20,6)  NOT NULL DEFAULT 0,      -- yield at time of withdrawal
  staked_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  unlocks_at    TIMESTAMPTZ    NOT NULL,
  status        VARCHAR(20)    NOT NULL DEFAULT 'active', -- active | ready | withdrawn
  withdrawn_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gp_stakes_wallet ON gp_stakes(wallet, status);
CREATE INDEX IF NOT EXISTS idx_gp_stakes_unlock ON gp_stakes(unlocks_at, status) WHERE status = 'active';

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('staking_enabled',           'true',   'Enable GP staking system',                          'staking'),
  ('staking_apy_pct',           '15.0',   'Annual percentage yield for staking (%)',            'staking'),
  ('staking_min_amount',        '100',    'Minimum GP per stake',                               'staking'),
  ('staking_max_amount',        '10000',  'Maximum GP per stake',                               'staking'),
  ('staking_lock_days_options', '7,14,30','Comma-separated available lock periods (days)',      'staking'),
  ('staking_30d_bonus_mult',    '1.5',    'Yield multiplier for 30-day lock vs 7-day',          'staking'),
  ('staking_14d_bonus_mult',    '1.2',    'Yield multiplier for 14-day lock vs 7-day',          'staking'),
  ('staking_max_active',        '5',      'Max concurrent active stakes per wallet',            'staking')
ON CONFLICT (key) DO NOTHING;

-- Migration 110: GP Dividends
-- A portion of platform revenue (marketplace fees, lottery house cut, burn GP)
-- flows into a weekly dividend pool, distributed proportionally to active stakers.
-- Creates a flywheel: stake GP → earn staking yield + dividends.

CREATE TABLE IF NOT EXISTS gp_dividend_pool (
  id             SERIAL PRIMARY KEY,
  week_start     DATE         NOT NULL UNIQUE,   -- ISO Monday
  pool_gp        DECIMAL(20,6) NOT NULL DEFAULT 0,  -- accumulated this week
  distributed_gp DECIMAL(20,6) NOT NULL DEFAULT 0,
  is_distributed BOOLEAN       NOT NULL DEFAULT false,
  total_stake_weight DECIMAL(20,6) NOT NULL DEFAULT 0,  -- sum of stake amounts at snapshot
  distributed_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gp_dividend_claims (
  id             SERIAL PRIMARY KEY,
  pool_id        INT          NOT NULL REFERENCES gp_dividend_pool(id),
  wallet         VARCHAR(100) NOT NULL,
  stake_weight   DECIMAL(20,6) NOT NULL DEFAULT 0,
  dividend_gp    DECIMAL(20,6) NOT NULL DEFAULT 0,
  claimed        BOOLEAN      NOT NULL DEFAULT false,
  claimed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_div_claims_wallet ON gp_dividend_claims(wallet, claimed);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('dividends_enabled',            'true',  'Enable GP dividend system',                        'dividends'),
  ('dividends_marketplace_pct',    '20',    '% of marketplace fees that go to dividend pool',   'dividends'),
  ('dividends_lottery_pct',        '30',    '% of lottery house GP that goes to dividend pool', 'dividends'),
  ('dividends_burn_pct',           '10',    '% of GP burned that goes to dividend pool',        'dividends'),
  ('dividends_min_stake_for_div',  '100',   'Minimum active stake (GP) to qualify for dividends','dividends'),
  ('dividends_distribute_day',     '1',     'Day of week to auto-distribute (1=Monday)',        'dividends')
ON CONFLICT (key) DO NOTHING;

-- Migration 102: GP Transfer System
-- Allows players to send GP directly to other players (gifting / tipping / guild rewards).
-- All transfers are logged. Daily send limit prevents abuse.

CREATE TABLE IF NOT EXISTS gp_transfers (
  id           SERIAL PRIMARY KEY,
  from_wallet  VARCHAR(100) NOT NULL,
  to_wallet    VARCHAR(100) NOT NULL,
  amount       DECIMAL(20,6) NOT NULL CHECK (amount > 0),
  note         VARCHAR(200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_transfers_from
  ON gp_transfers(from_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gp_transfers_to
  ON gp_transfers(to_wallet, created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('gp_transfer_enabled',     'true',  'Allow player-to-player GP transfers',                 'gp'),
  ('gp_transfer_min_amount',  '1',     'Minimum GP amount per transfer',                      'gp'),
  ('gp_transfer_max_amount',  '10000', 'Maximum GP amount per single transfer',               'gp'),
  ('gp_transfer_daily_limit', '50000', 'Maximum GP a single wallet may send per day',         'gp'),
  ('gp_transfer_fee_pct',     '0',     'Fee % deducted from transfer (0 = no fee)',           'gp')
ON CONFLICT (key) DO NOTHING;

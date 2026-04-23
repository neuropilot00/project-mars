-- Migration 097: GP Activity Log
-- Records significant GP transactions for player transparency.
-- Positive delta = earned, Negative delta = spent.

CREATE TABLE IF NOT EXISTS gp_activity_log (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42)  NOT NULL,
  delta       DECIMAL(20,6) NOT NULL,
  source      VARCHAR(50)  NOT NULL,  -- e.g. 'daily_login','mission_reward','enhance','ship_build','battle_win','battle_stake','marketplace_sell','marketplace_buy'
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_activity_wallet ON gp_activity_log(wallet, created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('gp_log_enabled',  'true', 'Enable GP activity logging for players', 'system'),
  ('gp_log_ttl_days', '30',   'Delete GP log entries older than N days', 'system')
ON CONFLICT (key) DO NOTHING;

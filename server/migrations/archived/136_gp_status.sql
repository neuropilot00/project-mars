-- Migration 136: GP Status Messages
-- Players pay GP to display a time-limited status message next to their name
-- across leaderboards, territory info, and combat logs.
-- Ongoing GP sink: renewal every X hours.

CREATE TABLE IF NOT EXISTS player_status (
  wallet      TEXT PRIMARY KEY,
  status      VARCHAR(60) NOT NULL,
  gp_paid     INTEGER NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_log (
  id          SERIAL PRIMARY KEY,
  wallet      TEXT NOT NULL,
  status      VARCHAR(60) NOT NULL,
  gp_paid     INTEGER NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_status_active ON player_status(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_log_wallet    ON status_log(wallet, created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('status_enabled',       'true',  'status'),
  ('status_cost_gp',       '20',    'status'),
  ('status_duration_h',    '24',    'status'),
  ('status_max_length',    '60',    'status'),
  ('status_max_duration_h','168',   'status'),
  ('status_renewal_disc',  '0',     'status')
ON CONFLICT (key) DO NOTHING;

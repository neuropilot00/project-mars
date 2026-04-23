-- Migration 134: GP Donation Wall
-- Players donate GP to the Colony Fund (burned from circulation).
-- Their name and message appear on a public donation wall.
-- Pure GP burn sink: social status + visible generosity.

CREATE TABLE IF NOT EXISTS donation_wall (
  id          SERIAL PRIMARY KEY,
  wallet      TEXT NOT NULL,
  amount_gp   INTEGER NOT NULL,
  message     VARCHAR(80) DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_wall_wallet  ON donation_wall(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_wall_recent  ON donation_wall(created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('donation_enabled',         'true',   'donation'),
  ('donation_min_gp',          '10',     'donation'),
  ('donation_max_gp',          '0',      'donation'),
  ('donation_max_msg_length',  '80',     'donation'),
  ('donation_wall_size',       '50',     'donation'),
  ('donation_top_donors',      '10',     'donation')
ON CONFLICT (key) DO NOTHING;

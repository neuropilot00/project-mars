-- Migration 126: GP Broadcast System
-- Players pay GP to display featured messages to all players for a time window.
-- Pure GP sink: buy attention / social reach on the Mars colony.

CREATE TABLE IF NOT EXISTS gp_broadcasts (
  id           SERIAL PRIMARY KEY,
  wallet       TEXT NOT NULL,
  message      TEXT NOT NULL,
  gp_paid      INTEGER NOT NULL,
  duration_h   INTEGER NOT NULL DEFAULT 1,
  show_until   TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gp_broadcasts_active ON gp_broadcasts(is_active, show_until);
CREATE INDEX IF NOT EXISTS idx_gp_broadcasts_wallet ON gp_broadcasts(wallet, created_at DESC);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('broadcast_enabled',         'true',  'broadcast'),
  ('broadcast_min_gp',          '50',    'broadcast'),
  ('broadcast_cost_per_h_gp',   '25',    'broadcast'),
  ('broadcast_max_duration_h',  '24',    'broadcast'),
  ('broadcast_max_length',      '120',   'broadcast'),
  ('broadcast_max_active',      '5',     'broadcast'),
  ('broadcast_cooldown_h',      '1',     'broadcast')
ON CONFLICT (key) DO NOTHING;

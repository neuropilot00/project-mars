-- Migration 133: GP Map Beacons
-- Players pay GP to place a visible beacon marker on the colony map for other players.
-- Pure GP sink: broadcast your presence / mark territory / social visibility.

CREATE TABLE IF NOT EXISTS map_beacons (
  id          SERIAL PRIMARY KEY,
  wallet      TEXT NOT NULL,
  x           INTEGER NOT NULL,
  y           INTEGER NOT NULL,
  message     VARCHAR(60) DEFAULT NULL,
  icon        VARCHAR(4)  NOT NULL DEFAULT '📡',
  gp_paid     INTEGER NOT NULL,
  duration_h  INTEGER NOT NULL DEFAULT 2,
  expires_at  TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_beacons_active  ON map_beacons(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_map_beacons_wallet  ON map_beacons(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_beacons_coords  ON map_beacons(x, y);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('beacon_enabled',         'true',              'beacon'),
  ('beacon_cost_gp',         '30',                'beacon'),
  ('beacon_duration_h',      '4',                 'beacon'),
  ('beacon_max_length',      '60',                'beacon'),
  ('beacon_max_active_map',  '20',                'beacon'),
  ('beacon_max_per_wallet',  '2',                 'beacon'),
  ('beacon_cooldown_h',      '1',                 'beacon'),
  ('beacon_icons',           '📡,🔥,⭐,🚀,💎,🌟,⚡,🏴,🎯,🛰️', 'beacon')
ON CONFLICT (key) DO NOTHING;

-- Migration 132: GP Colony Prestige
-- Players spend GP to accumulate Prestige Points that unlock Colony Ranks.
-- Pure GP sink with long-term progression and visible bragging rights.

CREATE TABLE IF NOT EXISTS colony_prestige (
  wallet           TEXT PRIMARY KEY,
  prestige_points  INTEGER NOT NULL DEFAULT 0,
  prestige_rank    INTEGER NOT NULL DEFAULT 0,
  total_gp_spent   INTEGER NOT NULL DEFAULT 0,
  last_upgrade     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS prestige_log (
  id            SERIAL PRIMARY KEY,
  wallet        TEXT NOT NULL,
  gp_spent      INTEGER NOT NULL,
  points_gained INTEGER NOT NULL,
  old_rank      INTEGER NOT NULL,
  new_rank      INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prestige_log_wallet ON prestige_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_colony_prestige_pts ON colony_prestige(prestige_points DESC);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('prestige_enabled',          'true',                                              'prestige'),
  ('prestige_cost_gp',          '50',                                                'prestige'),
  ('prestige_points_per_buy',   '1',                                                 'prestige'),
  ('prestige_rank_thresholds',  '0,10,30,75,175,400',                               'prestige'),
  ('prestige_rank_names',       'Colonist,Pioneer,Explorer,Commander,Governor,Admiral','prestige'),
  ('prestige_rank_icons',       '🪨,⛺,🔭,🚀,🏛️,⭐',                               'prestige'),
  ('prestige_rank_colors',      '#9e9e9e,#66bb6a,#42a5f5,#ab47bc,#ffa726,#ef5350', 'prestige')
ON CONFLICT (key) DO NOTHING;

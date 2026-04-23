-- Migration 123: Territory Branding
-- Players pay GP to give their territory a custom name, tagline, and theme color.

CREATE TABLE IF NOT EXISTS territory_branding (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL UNIQUE,
  wallet       TEXT    NOT NULL,
  territory_name TEXT,
  tagline      TEXT,
  theme_color  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_branding_wallet ON territory_branding(wallet);

CREATE TABLE IF NOT EXISTS territory_branding_log (
  id         SERIAL PRIMARY KEY,
  claim_id   INTEGER NOT NULL,
  wallet     TEXT    NOT NULL,
  field      TEXT    NOT NULL,   -- 'name' | 'tagline' | 'color'
  old_value  TEXT,
  new_value  TEXT,
  gp_spent   INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('branding_enabled',           'true',  'branding'),
  ('branding_name_cost_gp',      '50',    'branding'),
  ('branding_tagline_cost_gp',   '25',    'branding'),
  ('branding_color_cost_gp',     '100',   'branding'),
  ('branding_update_cost_gp',    '15',    'branding'),
  ('branding_max_name_length',   '24',    'branding'),
  ('branding_max_tagline_length','60',    'branding')
ON CONFLICT (key) DO NOTHING;

-- Migration 131: GP Territory Events
-- Players pay GP to activate temporary special events on their territory.
-- Repeatable, engaging GP sink with visible social effects.

CREATE TABLE IF NOT EXISTS territory_events (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL,
  wallet       TEXT NOT NULL,
  event_type   TEXT NOT NULL,   -- 'mining_rush' | 'harvest_festival' | 'beacon_pulse' | 'fortify_surge' | 'tax_holiday'
  gp_cost      INTEGER NOT NULL,
  duration_h   INTEGER NOT NULL DEFAULT 2,
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_events_claim  ON territory_events(claim_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_territory_events_wallet ON territory_events(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_territory_events_active ON territory_events(is_active, expires_at);

-- Settings: cost and duration per event type
INSERT INTO game_settings (key, value, category) VALUES
  ('tevt_enabled',                'true',  'tevt'),
  ('tevt_mining_rush_gp',         '80',    'tevt'),
  ('tevt_mining_rush_h',          '2',     'tevt'),
  ('tevt_mining_rush_bonus_pct',  '75',    'tevt'),
  ('tevt_harvest_festival_gp',    '60',    'tevt'),
  ('tevt_harvest_festival_h',     '3',     'tevt'),
  ('tevt_beacon_pulse_gp',        '40',    'tevt'),
  ('tevt_beacon_pulse_h',         '4',     'tevt'),
  ('tevt_fortify_surge_gp',       '100',   'tevt'),
  ('tevt_fortify_surge_h',        '2',     'tevt'),
  ('tevt_tax_holiday_gp',         '50',    'tevt'),
  ('tevt_tax_holiday_h',          '6',     'tevt'),
  ('tevt_max_concurrent',         '1',     'tevt'),  -- max simultaneous events per claim
  ('tevt_cooldown_h',             '1',     'tevt')   -- cooldown between same event type on same claim
ON CONFLICT (key) DO NOTHING;

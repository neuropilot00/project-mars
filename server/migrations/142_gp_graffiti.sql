-- Migration 142: GP Territory Graffiti
-- Players pay GP to spray a short text/emoji graffiti on any territory.
-- Graffiti expires after N hours. Multiple graffiti can stack per territory.

CREATE TABLE IF NOT EXISTS territory_graffiti (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  from_wallet TEXT         NOT NULL,
  text        VARCHAR(30)  NOT NULL,
  gp_paid     INTEGER      NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_graffiti_claim  ON territory_graffiti(claim_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_graffiti_wallet ON territory_graffiti(from_wallet);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('graffiti_enabled',          'true', 'graffiti', 'Enable Territory Graffiti'),
  ('graffiti_cost_gp',          '20',   'graffiti', 'GP cost per graffiti'),
  ('graffiti_max_length',       '30',   'graffiti', 'Max graffiti text length'),
  ('graffiti_duration_h',       '48',   'graffiti', 'Graffiti duration (hours)'),
  ('graffiti_max_per_territory','5',    'graffiti', 'Max active graffiti per territory'),
  ('graffiti_allow_own',        'true', 'graffiti', 'Allow graffiti on own territory')
ON CONFLICT (key) DO NOTHING;

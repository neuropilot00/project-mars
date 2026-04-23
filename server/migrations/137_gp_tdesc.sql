-- Migration 137: GP Territory Description
-- Players pay GP to add/update a custom description on their claimed territory.
-- The description is displayed when other players click on that territory.

CREATE TABLE IF NOT EXISTS territory_descriptions (
  claim_id    INTEGER      PRIMARY KEY,
  wallet      TEXT         NOT NULL,
  description TEXT         NOT NULL,
  gp_paid     INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tdesc_log (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  wallet      TEXT         NOT NULL,
  description TEXT         NOT NULL,
  gp_paid     INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_descriptions_wallet ON territory_descriptions(wallet);
CREATE INDEX IF NOT EXISTS idx_tdesc_log_wallet ON tdesc_log(wallet);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('tdesc_enabled',   'true',  'Enable territory description system',          'tdesc'),
  ('tdesc_first_gp',  '0',     'GP cost for first description (0 = free)',     'tdesc'),
  ('tdesc_change_gp', '30',    'GP cost to update an existing description',    'tdesc'),
  ('tdesc_max_length','200',   'Maximum description length (characters)',      'tdesc'),
  ('tdesc_cooldown_h','12',    'Hours players must wait between description changes', 'tdesc')
ON CONFLICT (key) DO NOTHING;

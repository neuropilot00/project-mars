-- Migration 138: GP Territory Sponsor
-- Players pay GP to place a temporary sponsor slot on another player's territory.
-- The sponsor name + message is shown in the territory info panel for all visitors.
-- GP is burned (pure sink). Territory owner gets social prestige from having sponsors.

CREATE TABLE IF NOT EXISTS territory_sponsors (
  id             SERIAL       PRIMARY KEY,
  claim_id       INTEGER      NOT NULL,
  sponsor_wallet TEXT         NOT NULL,
  message        VARCHAR(60)  DEFAULT NULL,
  gp_paid        INTEGER      NOT NULL,
  expires_at     TIMESTAMPTZ  NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_sponsors_claim    ON territory_sponsors(claim_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_territory_sponsors_wallet   ON territory_sponsors(sponsor_wallet);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('sponsor_enabled',          'true',  'Enable territory sponsor system',                        'sponsor'),
  ('sponsor_cost_gp',          '50',    'GP cost per sponsor slot',                               'sponsor'),
  ('sponsor_duration_h',       '24',    'Sponsor slot duration in hours',                         'sponsor'),
  ('sponsor_max_msg_length',   '60',    'Max sponsor message length (characters)',                'sponsor'),
  ('sponsor_max_per_territory','3',     'Max concurrent active sponsors per territory',           'sponsor'),
  ('sponsor_cooldown_h',       '0',     'Hours a wallet must wait before re-sponsoring same territory (0=no cooldown)', 'sponsor')
ON CONFLICT (key) DO NOTHING;

-- Migration 138: GP Time Capsule
-- Players pay GP to bury a sealed message that is revealed to all players
-- after a chosen number of days. Creates community anticipation and history.

CREATE TABLE IF NOT EXISTS time_capsules (
  id                SERIAL       PRIMARY KEY,
  wallet            TEXT         NOT NULL,
  nickname_snapshot TEXT,
  message           VARCHAR(280) NOT NULL,
  reveal_at         TIMESTAMPTZ  NOT NULL,
  is_revealed       BOOLEAN      NOT NULL DEFAULT false,
  revealed_at       TIMESTAMPTZ,
  gp_paid           INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_capsules_wallet      ON time_capsules(wallet);
CREATE INDEX IF NOT EXISTS idx_time_capsules_reveal_at   ON time_capsules(reveal_at) WHERE is_revealed = false;

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('capsule_enabled',       'true', 'Enable time capsule system',                   'capsule'),
  ('capsule_cost_gp',       '35',   'GP cost per capsule',                          'capsule'),
  ('capsule_max_length',    '280',  'Max message length (characters)',              'capsule'),
  ('capsule_min_days',      '1',    'Minimum days before reveal',                   'capsule'),
  ('capsule_max_days',      '365',  'Maximum days before reveal',                   'capsule'),
  ('capsule_max_per_wallet','5',    'Max active (unrevealed) capsules per wallet',  'capsule'),
  ('capsule_visible_count', '20',   'How many revealed capsules to show publicly',  'capsule')
ON CONFLICT (key) DO NOTHING;

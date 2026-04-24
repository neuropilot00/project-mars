-- Migration 141: GP Territory Tribute
-- Players send a GP tribute to a territory owner with an optional message.
-- The GP is burned (not transferred) to create a pure GP sink.
-- Recent tributes show in the territory info panel.

CREATE TABLE IF NOT EXISTS territory_tributes (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  from_wallet TEXT         NOT NULL,
  to_wallet   TEXT         NOT NULL,
  amount_gp   INTEGER      NOT NULL,
  message     VARCHAR(80),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tributes_claim   ON territory_tributes(claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tributes_to      ON territory_tributes(to_wallet);
CREATE INDEX IF NOT EXISTS idx_tributes_from    ON territory_tributes(from_wallet);

-- Settings
INSERT INTO settings (key, value, category, description) VALUES
  ('tribute_enabled',      'true', 'tribute', 'Enable Territory Tribute'),
  ('tribute_min_gp',       '10',   'tribute', 'Minimum tribute GP'),
  ('tribute_max_gp',       '500',  'tribute', 'Maximum tribute GP'),
  ('tribute_max_msg_len',  '80',   'tribute', 'Max tribute message length'),
  ('tribute_cooldown_min', '60',   'tribute', 'Cooldown between tributes to same territory (minutes, 0=off)')
ON CONFLICT (key) DO NOTHING;

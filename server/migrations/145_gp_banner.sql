-- Migration 145: GP Victory Banner
-- Players pay GP to plant a victory banner on any territory they own.
-- Banners persist for N days, visible in territory info.
-- Can be set after capturing a territory to mark your conquest.

CREATE TABLE IF NOT EXISTS territory_banners (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  wallet      TEXT         NOT NULL,
  message     VARCHAR(50)  DEFAULT NULL,
  emoji       VARCHAR(8)   NOT NULL DEFAULT '🚩',
  gp_paid     INTEGER      NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_banners_claim  ON territory_banners(claim_id, is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_banners_wallet ON territory_banners(wallet);

-- Settings
INSERT INTO settings (key, value, category, description) VALUES
  ('banner_enabled',     'true', 'banner', 'Enable Victory Banners'),
  ('banner_cost_gp',     '30',   'banner', 'GP cost per banner'),
  ('banner_duration_d',  '7',    'banner', 'Banner duration (days)'),
  ('banner_max_length',  '50',   'banner', 'Max banner message length'),
  ('banner_max_per_claim','3',   'banner', 'Max active banners per territory')
ON CONFLICT (key) DO NOTHING;

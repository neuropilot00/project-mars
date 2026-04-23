-- Migration 147: GP Territory Prestige Frame
-- Territory owners pay GP to permanently upgrade their territory's prestige tier.
-- Tiers: 0=None, 1=Bronze, 2=Silver, 3=Gold, 4=Platinum, 5=Diamond.
-- Each tier is a one-way permanent upgrade. Shown in territory info panel.

CREATE TABLE IF NOT EXISTS territory_prestige (
  claim_id   INTEGER      PRIMARY KEY,
  wallet     TEXT         NOT NULL,
  tier       SMALLINT     NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  gp_paid    INTEGER      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS territory_prestige_log (
  id          SERIAL       PRIMARY KEY,
  claim_id    INTEGER      NOT NULL,
  wallet      TEXT         NOT NULL,
  from_tier   SMALLINT     NOT NULL DEFAULT 0,
  to_tier     SMALLINT     NOT NULL,
  gp_cost     INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tprestige_log_claim ON territory_prestige_log(claim_id);
CREATE INDEX IF NOT EXISTS idx_tprestige_wallet ON territory_prestige(wallet);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('tprestige_enabled',       'true',  'tprestige', 'Enable Territory Prestige Frames'),
  ('tprestige_tier1_gp',      '50',    'tprestige', 'GP cost for Bronze (Tier 1)'),
  ('tprestige_tier2_gp',      '150',   'tprestige', 'GP cost for Silver (Tier 2)'),
  ('tprestige_tier3_gp',      '400',   'tprestige', 'GP cost for Gold (Tier 3)'),
  ('tprestige_tier4_gp',      '1000',  'tprestige', 'GP cost for Platinum (Tier 4)'),
  ('tprestige_tier5_gp',      '2500',  'tprestige', 'GP cost for Diamond (Tier 5)')
ON CONFLICT (key) DO NOTHING;

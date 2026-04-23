-- Migration 128: GP Territory Tiers
-- Players upgrade their claim to higher tiers for permanent passive bonuses.
-- Escalating GP cost = strong long-term GP sink.

CREATE TABLE IF NOT EXISTS territory_tiers (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL UNIQUE,
  wallet       TEXT NOT NULL,
  tier         INTEGER NOT NULL DEFAULT 1,  -- 1=Bronze 2=Silver 3=Gold 4=Platinum 5=Diamond
  upgraded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS territory_tier_log (
  id           SERIAL PRIMARY KEY,
  claim_id     INTEGER NOT NULL,
  wallet       TEXT NOT NULL,
  from_tier    INTEGER NOT NULL,
  to_tier      INTEGER NOT NULL,
  gp_spent     INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_tiers_wallet  ON territory_tiers(wallet);
CREATE INDEX IF NOT EXISTS idx_territory_tier_log_claim ON territory_tier_log(claim_id, created_at DESC);

-- Settings: costs per tier upgrade (tier1→2, tier2→3, etc.) and bonuses
INSERT INTO game_settings (key, value, category) VALUES
  ('tier_enabled',          'true',           'tier'),
  ('tier_names',            'Bronze,Silver,Gold,Platinum,Diamond', 'tier'),
  ('tier_icons',            '🥉,🥈,🥇,💠,💎',  'tier'),
  ('tier_costs_gp',         '100,300,800,2000,5000', 'tier'),  -- cost to reach each tier (cumulative levels cost)
  ('tier_mining_bonus_pct', '0,10,25,50,100', 'tier'),         -- mining bonus % per tier
  ('tier_pixel_bonus_pct',  '0,5,15,30,60',  'tier'),          -- pixel capacity bonus % per tier
  ('tier_max',              '5',              'tier'),
  ('tier_per_wallet_max',   '0',              'tier')           -- 0 = unlimited
ON CONFLICT (key) DO NOTHING;

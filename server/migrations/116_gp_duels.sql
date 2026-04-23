-- Migration 116: GP Duel System
-- Players challenge each other to 1v1 GP-wagered duels.
-- Challenger puts up wager; defender accepts/declines within timeout.
-- Battle is resolved using existing battle engine stat weights + RNG.
-- Winner takes (wager * 2) minus house fee. Fee goes to GP burn pool.

CREATE TABLE IF NOT EXISTS gp_duels (
  id              SERIAL PRIMARY KEY,
  challenger      VARCHAR(100)  NOT NULL,
  defender        VARCHAR(100)  NOT NULL,
  wager_gp        DECIMAL(20,6) NOT NULL,          -- each side's stake
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
                                                    -- pending|accepted|declined|expired|resolved|cancelled
  challenger_score INT,
  defender_score   INT,
  winner          VARCHAR(100),                     -- NULL = draw
  fee_gp          DECIMAL(20,6) NOT NULL DEFAULT 0,
  payout_gp       DECIMAL(20,6) NOT NULL DEFAULT 0, -- amount winner received
  battle_seed     INT,                              -- RNG seed for replay
  expires_at      TIMESTAMPTZ   NOT NULL,           -- challenger must accept by this time
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger ON gp_duels(challenger, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_defender   ON gp_duels(defender,   created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duels_status     ON gp_duels(status);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('duel_enabled',         'true',  'Enable GP duel system',                         'duel'),
  ('duel_min_wager',       '10',    'Minimum GP wager per side',                     'duel'),
  ('duel_max_wager',       '5000',  'Maximum GP wager per side',                     'duel'),
  ('duel_fee_pct',         '5',     'House fee % deducted from the pot',             'duel'),
  ('duel_expire_minutes',  '30',    'Minutes challenger has to accept before expiry','duel'),
  ('duel_max_pending',     '3',     'Max pending duels a wallet can have at once',   'duel'),
  ('duel_cooldown_minutes','5',     'Cooldown between duel challenges to same target','duel')
ON CONFLICT (key) DO NOTHING;

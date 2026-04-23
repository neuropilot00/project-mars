-- Migration 113: GP Bounty Board
-- Players post GP bounties on other players' territories.
-- First attacker to successfully hijack ANY pixel from a bounty target claims the GP.
-- Bounties expire after configurable days. Poster's GP is held in escrow.

CREATE TABLE IF NOT EXISTS gp_bounties (
  id             SERIAL PRIMARY KEY,
  poster         VARCHAR(100)   NOT NULL,              -- who posted the bounty
  target_wallet  VARCHAR(100)   NOT NULL,              -- target (the defender)
  target_claim_id INT,                                  -- optional: specific claim
  gp_amount      DECIMAL(20,6)  NOT NULL,
  message        VARCHAR(200),                          -- optional taunting message
  status         VARCHAR(20)    NOT NULL DEFAULT 'active', -- active | claimed | expired | cancelled
  expires_at     TIMESTAMPTZ    NOT NULL,
  claimed_by     VARCHAR(100),                          -- attacker who collected
  claimed_at     TIMESTAMPTZ,
  claim_battle_id INT,                                  -- references battles.id
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounty_target ON gp_bounties(target_wallet) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bounty_poster ON gp_bounties(poster) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bounty_status ON gp_bounties(status, expires_at);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('bounty_enabled',          'true',  'Enable the GP bounty board',                               'bounty'),
  ('bounty_min_gp',           '50',    'Minimum GP for a bounty posting',                          'bounty'),
  ('bounty_max_gp',           '5000',  'Maximum GP for a single bounty',                           'bounty'),
  ('bounty_max_active_poster','3',     'Max active bounties per poster',                           'bounty'),
  ('bounty_max_active_target','5',     'Max concurrent bounties on one target',                    'bounty'),
  ('bounty_expiry_days',      '7',     'Days until bounty auto-expires',                           'bounty'),
  ('bounty_cancel_fee_pct',   '10',    'GP% burned as fee when cancelling a bounty early',         'bounty'),
  ('bounty_msg_max_len',      '150',   'Max bounty message length',                                'bounty'),
  ('bounty_self_allowed',     'false', 'Allow posting bounty on your own territory (false=block)', 'bounty')
ON CONFLICT (key) DO NOTHING;

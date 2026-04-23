-- Migration 114: Territory Shield
-- Players spend GP to activate a temporary shield on their territory.
-- While a shield is active, the territory CANNOT be hijacked.
-- Shields expire automatically after their configured duration.
-- Attacking a shielded territory returns an error — attacker is informed.

CREATE TABLE IF NOT EXISTS territory_shields (
  id           SERIAL PRIMARY KEY,
  claim_id     INT            NOT NULL UNIQUE,         -- one active shield per claim
  owner        VARCHAR(100)   NOT NULL,
  duration_h   INT            NOT NULL,                 -- hours of protection
  gp_spent     DECIMAL(20,6)  NOT NULL,
  activated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ    NOT NULL,
  is_active    BOOLEAN        NOT NULL DEFAULT true,
  broken_by    VARCHAR(100),                            -- wallet that broke it (future mechanic)
  broken_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shield_claim ON territory_shields(claim_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shield_owner ON territory_shields(owner) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_shield_expiry ON territory_shields(expires_at) WHERE is_active = true;

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('shield_enabled',          'true',   'Enable territory shield system',                          'shield'),
  ('shield_options',          '6,12,24,48,72', 'Available shield durations in hours (comma-separated)', 'shield'),
  ('shield_cost_6h',          '80',     'GP cost for 6-hour shield',                              'shield'),
  ('shield_cost_12h',         '140',    'GP cost for 12-hour shield',                             'shield'),
  ('shield_cost_24h',         '250',    'GP cost for 24-hour shield',                             'shield'),
  ('shield_cost_48h',         '450',    'GP cost for 48-hour shield',                             'shield'),
  ('shield_cost_72h',         '600',    'GP cost for 72-hour shield',                             'shield'),
  ('shield_max_per_wallet',   '5',      'Maximum active shields per wallet',                      'shield'),
  ('shield_stack_allowed',    'false',  'Allow extending an existing shield (false=replace only)', 'shield')
ON CONFLICT (key) DO NOTHING;

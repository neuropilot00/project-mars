-- Migration 124: Territory Spell System
-- Players spend GP to cast temporary spells on territories (hexes or boons).
-- Spells are cosmetic + influence-based; no core hijack logic modified.

CREATE TABLE IF NOT EXISTS territory_spells (
  id           SERIAL PRIMARY KEY,
  caster_wallet TEXT NOT NULL,
  target_claim_id INTEGER NOT NULL,
  spell_type   TEXT NOT NULL,          -- 'flood' | 'blaze' | 'bless' | 'storm' | 'shield_break' | 'goldmine'
  gp_cost      INTEGER NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_spells_claim   ON territory_spells(target_claim_id, is_active);
CREATE INDEX IF NOT EXISTS idx_territory_spells_caster  ON territory_spells(caster_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_territory_spells_expires ON territory_spells(expires_at) WHERE is_active = true;

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('spell_enabled',          'true',  'spells'),
  ('spell_flood_gp',         '50',    'spells'),
  ('spell_blaze_gp',         '75',    'spells'),
  ('spell_bless_gp',         '30',    'spells'),
  ('spell_storm_gp',         '100',   'spells'),
  ('spell_shield_break_gp',  '120',   'spells'),
  ('spell_goldmine_gp',      '60',    'spells'),
  ('spell_duration_h',       '2',     'spells'),
  ('spell_max_per_target',   '1',     'spells'),
  ('spell_self_cast_allowed','true',  'spells'),
  ('spell_own_territory_hex','false', 'spells')
ON CONFLICT (key) DO NOTHING;

-- Migration 100: Ship Upgrade System
-- Allows players to permanently upgrade individual ships (ATK/DEF/HP) by spending GP.
-- Escalating cost per upgrade level (base × multiplier^level) creates a meaningful GP sink.
-- Max level is configurable. Upgraded ships have higher battle power.

-- ── Schema changes ───────────────────────────────────────────────────────────
ALTER TABLE user_ships ADD COLUMN IF NOT EXISTS upgrade_level  INT NOT NULL DEFAULT 0;
ALTER TABLE user_ships ADD COLUMN IF NOT EXISTS upgrade_bonus_atk INT NOT NULL DEFAULT 0;
ALTER TABLE user_ships ADD COLUMN IF NOT EXISTS upgrade_bonus_def INT NOT NULL DEFAULT 0;
ALTER TABLE user_ships ADD COLUMN IF NOT EXISTS upgrade_bonus_hp  INT NOT NULL DEFAULT 0;

-- ── Upgrade log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ship_upgrade_log (
  id          SERIAL PRIMARY KEY,
  ship_id     INT NOT NULL REFERENCES user_ships(id) ON DELETE CASCADE,
  wallet      VARCHAR(100) NOT NULL,
  from_level  INT NOT NULL DEFAULT 0,
  to_level    INT NOT NULL DEFAULT 1,
  gp_cost     DECIMAL(20,6) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_upgrade_log_wallet
  ON ship_upgrade_log(wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ship_upgrade_log_ship
  ON ship_upgrade_log(ship_id, created_at DESC);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('ship_upgrade_enabled',      'true', 'Enable ship upgrade system',                  'ships'),
  ('ship_upgrade_max_level',    '5',    'Maximum upgrade level per ship',              'ships'),
  ('ship_upgrade_base_cost_gp', '100',  'GP cost for first upgrade (level 0 → 1)',     'ships'),
  ('ship_upgrade_cost_mult',    '2.0',  'Cost multiplier per upgrade level',           'ships'),
  ('ship_upgrade_atk_per_lvl',  '5',    'ATK bonus added per upgrade level',           'ships'),
  ('ship_upgrade_def_per_lvl',  '5',    'DEF bonus added per upgrade level',           'ships'),
  ('ship_upgrade_hp_per_lvl',   '30',   'HP bonus added per upgrade level',            'ships')
ON CONFLICT (key) DO NOTHING;

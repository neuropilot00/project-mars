-- ═══════════════════════════════════════════════════
-- 049: POI item rewards — drop items from exploration
-- Adds GP to reward_type constraint, configures drop table
-- ═══════════════════════════════════════════════════

-- Add 'gp' to reward_type CHECK constraint on exploration_pois
ALTER TABLE exploration_pois DROP CONSTRAINT IF EXISTS exploration_pois_reward_type_check;
ALTER TABLE exploration_pois ADD CONSTRAINT exploration_pois_reward_type_check
  CHECK (reward_type IN ('pp','gp','item','xp'));

-- Also update poi_discoveries to accept gp
ALTER TABLE poi_discoveries DROP CONSTRAINT IF EXISTS poi_discoveries_reward_type_check;

-- ── POI Drop Table (configurable from admin) ──
-- Each row = one possible item drop with weight
CREATE TABLE IF NOT EXISTS poi_drop_table (
  id SERIAL PRIMARY KEY,
  item_code VARCHAR(30) NOT NULL,
  item_name VARCHAR(60) NOT NULL,
  icon VARCHAR(10) DEFAULT '📦',
  weight INT NOT NULL DEFAULT 10,
  min_qty INT NOT NULL DEFAULT 1,
  max_qty INT NOT NULL DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default POI item drops
-- These are items that can drop from POI discovery
INSERT INTO poi_drop_table (item_code, item_name, icon, weight, min_qty, max_qty) VALUES
  ('shield_basic',   'Energy Shield',      '🛡️', 25, 1, 2),
  ('attack_boost',   'Mars Rage',          '🔥', 20, 1, 1),
  ('mining_boost',   'Mining Accelerator', '⛏️', 20, 1, 1),
  ('radar_scan',     'Radar Scan',         '📡', 15, 1, 2),
  ('stealth_cloak',  'Stealth Cloak',      '👻', 10, 1, 1),
  ('pixel_doubler',  'Pixel Doubler',      '✨',  5, 1, 1),
  ('emp_strike',     'EMP Strike',         '⚡',  5, 1, 1)
ON CONFLICT DO NOTHING;

-- ── POI reward distribution settings ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('poi_drop_gp_weight',   '70', 'exploration', 'Weight for GP reward from POI (higher = more common)'),
  ('poi_drop_item_weight', '20', 'exploration', 'Weight for Item reward from POI'),
  ('poi_drop_pp_weight',   '10', 'exploration', 'Weight for PP reward from POI (rare)')
ON CONFLICT (key) DO NOTHING;

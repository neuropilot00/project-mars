-- 054_rocket_reward_rebalance.sql
-- Rebalance rocket supply drop rewards so PP is rare and items/GP/XP are primary.
-- Before: 98% of loot was PP (0.1~1.0 each × 15 = 1.5~15 PP per event).
-- After: weighted distribution → GP 50%, Item 25%, XP 17%, PP 6%, Cosmetic 2%.
--
-- Also fixes existing rocket settings category (was 'general') → 'rocket' so they
-- show up in the admin panel under a dedicated tab.

-- ── Fix categories + descriptions on existing rocket settings ──
UPDATE settings SET category = 'rocket', description = 'Enable/disable rocket supply drops' WHERE key = 'rocket_enabled';
UPDATE settings SET category = 'rocket', description = 'Auto-schedule interval (hours)' WHERE key = 'rocket_interval_hours';
UPDATE settings SET category = 'rocket', description = 'Advance notice before landing (hours)' WHERE key = 'rocket_advance_notice_hours';
UPDATE settings SET category = 'rocket', description = 'Looting window after landing (hours)' WHERE key = 'rocket_looting_hours';
UPDATE settings SET category = 'rocket', description = 'RUD explosion chance (% per event)' WHERE key = 'rocket_rud_chance';
UPDATE settings SET category = 'rocket', description = 'Loot crate count for normal supply drop' WHERE key = 'rocket_loot_count_normal';
UPDATE settings SET category = 'rocket', description = 'Loot crate count for RUD explosion' WHERE key = 'rocket_loot_count_rud';
UPDATE settings SET category = 'rocket', description = 'Normal drop radius (degrees)' WHERE key = 'rocket_loot_radius';
UPDATE settings SET category = 'rocket', description = 'RUD drop radius (degrees)' WHERE key = 'rocket_rud_radius';

-- ── Nerf PP range drastically (was 0.1~1.0, now 0.02~0.1) ──
UPDATE settings SET value = '0.02', category = 'rocket', description = 'Min PP reward per loot crate (rare)' WHERE key = 'rocket_loot_min_pp';
UPDATE settings SET value = '0.1',  category = 'rocket', description = 'Max PP reward per loot crate (rare)' WHERE key = 'rocket_loot_max_pp';

-- ── Add new reward type settings (weighted drop distribution) ──
INSERT INTO settings (key, value, category, description) VALUES
  ('rocket_drop_gp_weight',       '50', 'rocket', 'Weight: GP drop (50 = ~50%)'),
  ('rocket_drop_item_weight',     '25', 'rocket', 'Weight: battle item drop (25 = ~25%)'),
  ('rocket_drop_xp_weight',       '17', 'rocket', 'Weight: XP drop (17 = ~17%)'),
  ('rocket_drop_pp_weight',        '6', 'rocket', 'Weight: PP drop (6 = ~6%, rare)'),
  ('rocket_drop_cosmetic_weight',  '2', 'rocket', 'Weight: cosmetic drop (2 = ~2%, very rare)'),
  ('rocket_loot_min_gp',          '10', 'rocket', 'Min GP reward per loot crate'),
  ('rocket_loot_max_gp',          '40', 'rocket', 'Max GP reward per loot crate'),
  ('rocket_loot_min_xp',           '5', 'rocket', 'Min XP reward per loot crate'),
  ('rocket_loot_max_xp',          '25', 'rocket', 'Max XP reward per loot crate')
ON CONFLICT (key) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

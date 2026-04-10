-- ═══════════════════════════════════════════════════
-- 051: Fix setting categories + add missing arena settings
-- - 019 crash/mines settings had no category (defaulted to 'general')
-- - Add arena_enabled, arena_house_edge
-- ═══════════════════════════════════════════════════

-- Fix POI settings stuck in 'general' → move to 'exploration'
UPDATE settings SET category = 'exploration', description = 'POI count spawned per cycle' WHERE key = 'poi_count_per_cycle';
UPDATE settings SET category = 'exploration', description = 'POI spawn interval (hours)' WHERE key = 'poi_spawn_interval_hours';
UPDATE settings SET category = 'exploration', description = 'POI expiry time (hours)' WHERE key = 'poi_expire_hours';
UPDATE settings SET category = 'exploration', description = 'Enable/disable POI system' WHERE key = 'poi_enabled';
UPDATE settings SET category = 'exploration', description = 'POI cosmetic drop chance' WHERE key = 'poi_cosmetic_chance';

-- Fix crash/mines settings → category 'arena'
UPDATE settings SET category = 'arena', description = 'Crash min bet (PP)' WHERE key = 'crash_min_bet';
UPDATE settings SET category = 'arena', description = 'Crash max bet (PP)' WHERE key = 'crash_max_bet';
UPDATE settings SET category = 'arena', description = 'Crash house edge (0.04 = 4%)' WHERE key = 'crash_house_edge';
UPDATE settings SET category = 'arena', description = 'Mines min bet (PP)' WHERE key = 'mines_min_bet';
UPDATE settings SET category = 'arena', description = 'Mines max bet (PP)' WHERE key = 'mines_max_bet';
UPDATE settings SET category = 'arena', description = 'Mines house edge (0.03 = 3%)' WHERE key = 'mines_house_edge';

-- Add missing arena settings
INSERT INTO settings (key, value, category, description) VALUES
  ('arena_enabled', 'true', 'arena', 'Enable/disable all cantina games'),
  ('arena_house_edge', '0.05', 'arena', 'Global cantina house edge fallback (%)')
ON CONFLICT (key) DO UPDATE SET category = 'arena';

-- Ensure 048 settings exist (they may have failed due to wrong table name)
INSERT INTO settings (key, value, category, description) VALUES
  ('season_mult_pixels', '1', 'season', 'Score multiplier per pixel claimed'),
  ('season_mult_harvest', '5', 'season', 'Score multiplier per harvest'),
  ('season_mult_hijack', '10', 'season', 'Score multiplier per hijack won'),
  ('season_mult_poi', '15', 'season', 'Score multiplier per POI discovered'),
  ('guild_create_cost_gp', '50', 'guild', 'GP cost to create a guild'),
  ('guild_max_members', '20', 'guild', 'Maximum members per guild'),
  ('daily_mission_reward_claim', '15', 'daily', 'GP reward for claim_pixels mission'),
  ('daily_mission_reward_harvest', '10', 'daily', 'GP reward for harvest mission'),
  ('daily_mission_reward_poi', '20', 'daily', 'GP reward for explore_poi mission'),
  ('daily_mission_reward_hijack', '25', 'daily', 'GP reward for hijack mission'),
  ('daily_mission_reward_cantina', '10', 'daily', 'GP reward for play_cantina mission'),
  ('daily_mission_reward_cosmetic', '10', 'daily', 'GP reward for equip_cosmetic mission'),
  ('daily_mission_reward_weather', '10', 'daily', 'GP reward for view_weather mission'),
  ('daily_mission_bonus_gp', '50', 'daily', 'Bonus GP for completing all daily missions'),
  ('daily_streak_cycle', '7', 'daily', 'Days before streak resets to day 1'),
  ('hijack_multiplier', '1.2', 'battle', 'Cost multiplier for hijack'),
  ('hijack_owner_bonus', '50', 'battle', 'Percent of hijack cost refunded to land owner'),
  ('attack_success_rate', '50', 'battle', 'Base attack success rate (%)'),
  ('attack_min_success', '10', 'battle', 'Minimum attack success rate (%)'),
  ('attack_max_success', '90', 'battle', 'Maximum attack success rate (%)'),
  ('hijack_fail_refund', '0.9', 'battle', 'Refund ratio on failed hijack (0.9 = 90%)'),
  ('hijack_fail_fee', '0.1', 'battle', 'Fee ratio on failed hijack (0.1 = 10%)'),
  ('war_discount_mult', '0.8', 'battle', 'Claim cost multiplier during war'),
  ('pixel_doubler_mult', '0.5', 'battle', 'Claim cost multiplier with pixel doubler'),
  ('harvest_pixel_factor_cap', '3.0', 'mining', 'Max pixel factor multiplier for harvest reward'),
  ('harvest_governor_bonus', '1.2', 'mining', 'Governor harvest bonus multiplier'),
  ('quest_slots_free', '3', 'quest', 'Number of free quest slots per refresh'),
  ('quest_slots_activity', '2', 'quest', 'Number of activity quest slots'),
  ('quest_slots_spending', '1', 'quest', 'Number of spending quest slots'),
  ('quest_expiry_free', '24', 'quest', 'Free quest expiry (hours)'),
  ('quest_expiry_activity', '48', 'quest', 'Activity quest expiry (hours)'),
  ('quest_expiry_spending', '72', 'quest', 'Spending quest expiry (hours)'),
  ('weather_dust_mining', '50', 'weather', 'Dust storm mining modifier (%)'),
  ('weather_dust_defense', '-30', 'weather', 'Dust storm defense modifier (%)'),
  ('weather_solar_mining', '100', 'weather', 'Solar flare mining modifier (%)'),
  ('weather_solar_shield', '-50', 'weather', 'Solar flare shield modifier (%)'),
  ('weather_cold_mining', '30', 'weather', 'Cold wave mining modifier (%)'),
  ('weather_meteor_attack', '15', 'weather', 'Meteor shower attack modifier (%)'),
  ('weather_meteor_claimcost', '-20', 'weather', 'Meteor shower claim cost modifier (%)'),
  ('instant_harvest_cost_pp', '0.5', 'micro', 'PP cost for instant harvest'),
  ('rename_cost_pp', '0.3', 'micro', 'PP cost to rename territory'),
  ('poi_hint_cost_pp', '0.2', 'micro', 'PP cost for POI hint'),
  ('loot_priority_cost_pp', '0.3', 'micro', 'PP cost for rocket loot priority'),
  ('cosmetic_equip_fee_pp', '0', 'micro', 'PP fee for equipping cosmetics'),
  ('poi_reward_min_gp', '10', 'exploration', 'Min GP reward for POI discovery'),
  ('poi_reward_max_gp', '50', 'exploration', 'Max GP reward for POI discovery'),
  ('poi_reward_min_pp', '0.05', 'exploration', 'Min PP reward for POI discovery (rare)'),
  ('poi_reward_max_pp', '0.3', 'exploration', 'Max PP reward for POI discovery (rare)'),
  ('poi_drop_gp_weight', '70', 'exploration', 'Weight for GP drop from POI (~70%)'),
  ('poi_drop_item_weight', '20', 'exploration', 'Weight for Item drop from POI (~20%)'),
  ('poi_drop_pp_weight', '10', 'exploration', 'Weight for PP drop from POI (~10% rare)'),
  ('poi_discovery_xp', '5', 'exploration', 'XP awarded per POI discovery')
ON CONFLICT (key) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

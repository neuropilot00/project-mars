-- ═══════════════════════════════════════════════════
-- 048: Seed all game balance settings into game_settings
-- Makes every balance value adjustable from admin panel
-- ═══════════════════════════════════════════════════

-- ── Season Score Multipliers ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('season_mult_pixels', '1', 'season', 'Score multiplier per pixel claimed'),
  ('season_mult_harvest', '5', 'season', 'Score multiplier per harvest'),
  ('season_mult_hijack', '10', 'season', 'Score multiplier per hijack won'),
  ('season_mult_poi', '15', 'season', 'Score multiplier per POI discovered')
ON CONFLICT (key) DO NOTHING;

-- ── Guild Settings ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('guild_create_cost_gp', '50', 'guild', 'GP cost to create a guild'),
  ('guild_max_members', '20', 'guild', 'Maximum members per guild')
ON CONFLICT (key) DO NOTHING;

-- ── Daily Mission Rewards ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('daily_mission_reward_claim', '15', 'daily', 'GP reward for claim_pixels mission'),
  ('daily_mission_reward_harvest', '10', 'daily', 'GP reward for harvest mission'),
  ('daily_mission_reward_poi', '20', 'daily', 'GP reward for explore_poi mission'),
  ('daily_mission_reward_hijack', '25', 'daily', 'GP reward for hijack mission'),
  ('daily_mission_reward_cantina', '10', 'daily', 'GP reward for play_cantina mission'),
  ('daily_mission_reward_cosmetic', '10', 'daily', 'GP reward for equip_cosmetic mission'),
  ('daily_mission_reward_weather', '10', 'daily', 'GP reward for view_weather mission'),
  ('daily_mission_bonus_gp', '50', 'daily', 'Bonus GP for completing all daily missions'),
  ('daily_streak_cycle', '7', 'daily', 'Days before streak resets to day 1')
ON CONFLICT (key) DO NOTHING;

-- ── Hijack / Battle Balance ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('hijack_multiplier', '1.2', 'battle', 'Cost multiplier for hijack (1.2 = 120% of pixel cost)'),
  ('hijack_owner_bonus', '50', 'battle', 'Percent of hijack cost refunded to land owner'),
  ('attack_success_rate', '50', 'battle', 'Base attack success rate (%)'),
  ('attack_min_success', '10', 'battle', 'Minimum attack success rate (%)'),
  ('attack_max_success', '90', 'battle', 'Maximum attack success rate (%)'),
  ('hijack_fail_refund', '0.9', 'battle', 'Refund ratio on failed hijack (0.9 = 90%)'),
  ('hijack_fail_fee', '0.1', 'battle', 'Fee ratio on failed hijack (0.1 = 10%)'),
  ('war_discount_mult', '0.8', 'battle', 'Claim cost multiplier during war (0.8 = 20% discount)'),
  ('pixel_doubler_mult', '0.5', 'battle', 'Claim cost multiplier with pixel doubler (0.5 = 50% off)')
ON CONFLICT (key) DO NOTHING;

-- ── Harvest / Mining Balance ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('harvest_pixel_factor_cap', '3.0', 'mining', 'Max pixel factor multiplier for harvest reward'),
  ('harvest_governor_bonus', '1.2', 'mining', 'Governor harvest bonus multiplier (1.2 = 20% more)')
ON CONFLICT (key) DO NOTHING;

-- ── Quest Balance ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('quest_slots_free', '3', 'quest', 'Number of free quest slots per refresh'),
  ('quest_slots_activity', '2', 'quest', 'Number of activity quest slots'),
  ('quest_slots_spending', '1', 'quest', 'Number of spending quest slots'),
  ('quest_expiry_free', '24', 'quest', 'Free quest expiry (hours)'),
  ('quest_expiry_activity', '48', 'quest', 'Activity quest expiry (hours)'),
  ('quest_expiry_spending', '72', 'quest', 'Spending quest expiry (hours)')
ON CONFLICT (key) DO NOTHING;

-- ── Weather Effects ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('weather_dust_mining', '50', 'weather', 'Dust storm mining modifier (%)'),
  ('weather_dust_defense', '-30', 'weather', 'Dust storm defense modifier (%)'),
  ('weather_solar_mining', '100', 'weather', 'Solar flare mining modifier (%)'),
  ('weather_solar_shield', '-50', 'weather', 'Solar flare shield modifier (%)'),
  ('weather_cold_mining', '30', 'weather', 'Cold wave mining modifier (%)'),
  ('weather_meteor_attack', '15', 'weather', 'Meteor shower attack modifier (%)'),
  ('weather_meteor_claimcost', '-20', 'weather', 'Meteor shower claim cost modifier (%)')
ON CONFLICT (key) DO NOTHING;

-- ── Micro-transaction Costs ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('instant_harvest_cost_pp', '0.5', 'micro', 'PP cost for instant harvest (skip cooldown)'),
  ('rename_cost_pp', '0.3', 'micro', 'PP cost to rename territory'),
  ('poi_hint_cost_pp', '0.2', 'micro', 'PP cost for POI hint'),
  ('loot_priority_cost_pp', '0.3', 'micro', 'PP cost for rocket loot priority'),
  ('cosmetic_equip_fee_pp', '0', 'micro', 'PP fee for equipping cosmetics')
ON CONFLICT (key) DO NOTHING;

-- ── POI Reward Scaling ──
INSERT INTO game_settings (key, value, category, description) VALUES
  ('poi_reward_min_gp', '10', 'exploration', 'Min GP reward for POI discovery'),
  ('poi_reward_max_gp', '50', 'exploration', 'Max GP reward for POI discovery'),
  ('poi_reward_min_pp', '0.05', 'exploration', 'Min PP reward for POI discovery (rare)'),
  ('poi_reward_max_pp', '0.3', 'exploration', 'Max PP reward for POI discovery (rare)'),
  ('poi_drop_gp_weight', '70', 'exploration', 'Weight for GP drop from POI (70 = ~70%)'),
  ('poi_drop_item_weight', '20', 'exploration', 'Weight for Item drop from POI (20 = ~20%)'),
  ('poi_drop_pp_weight', '10', 'exploration', 'Weight for PP drop from POI (10 = ~10% rare)'),
  ('poi_discovery_xp', '5', 'exploration', 'XP awarded per POI discovery')
ON CONFLICT (key) DO NOTHING;

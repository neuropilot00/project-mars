-- Migration 095: New Daily Mission Types
-- Adds GP reward settings for all mission types (admin-configurable)
-- and introduces 4 new mission types covering the new game systems.

-- ── Mission reward overrides (per-type, 0 = use pool default) ────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('daily_mission_claim_pixels_reward_gp',    '15', 'Daily mission reward GP: Expand Territory',     'daily'),
  ('daily_mission_harvest_reward_gp',         '10', 'Daily mission reward GP: Collect Resources',    'daily'),
  ('daily_mission_explore_poi_reward_gp',     '20', 'Daily mission reward GP: Recon Mission',        'daily'),
  ('daily_mission_hijack_reward_gp',          '25', 'Daily mission reward GP: Hostile Takeover',     'daily'),
  ('daily_mission_play_cantina_reward_gp',    '10', 'Daily mission reward GP: Cantina Night',        'daily'),
  ('daily_mission_equip_cosmetic_reward_gp',  '10', 'Daily mission reward GP: Mars Fashion',         'daily'),
  ('daily_mission_view_weather_reward_gp',    '10', 'Daily mission reward GP: Storm Chaser',         'daily'),
  -- New mission types (Migration 095)
  ('daily_mission_enhance_item_reward_gp',    '20', 'Daily mission reward GP: Cosmetic Enhancement', 'daily'),
  ('daily_mission_marketplace_trade_reward_gp','15','Daily mission reward GP: Market Day',            'daily'),
  ('daily_mission_win_naval_battle_reward_gp','40', 'Daily mission reward GP: Naval Victory',        'daily'),
  ('daily_mission_build_ship_reward_gp',      '25', 'Daily mission reward GP: Shipyard Rush',        'daily')
ON CONFLICT (key) DO NOTHING;

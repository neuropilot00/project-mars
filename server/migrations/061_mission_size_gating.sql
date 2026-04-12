-- 061: Mission size gating + invasion no-steal rebalance
--
-- Player feedback drove three changes:
--   (1) Invasion must NEVER take territory — territory is money. Reward
--       is now PP/GP/XP only (no item drops, no pixel transfers).
--   (2) Both attacker pad size AND defender territory size should affect
--       invasion duration + reward intensity. Small/small = quick + tiny,
--       big/big = long + huge.
--   (3) Exploration is loot-flavored: pays in PP/XP/items, no GP.
--   (4) Missions with a small "size factor" only roll ONE of their
--       reward channels (random pick) — keeps small operations from
--       feeling like jackpots.

-- Threshold below which only one reward type is rolled
INSERT INTO settings (key, value, category, description) VALUES
  ('mission_full_reward_size_threshold', '1.0',  'missions',
   'Combined size factor below this gates mission rewards to a single channel'),
  ('mission_invade_item_drop_pct',       '0',    'missions',
   'Invasion item drop chance (0 = combat is paid in currency, no items)')
ON CONFLICT (key) DO NOTHING;

-- Bump invasion GP rewards a bit since it no longer steals pixels
UPDATE settings SET value = '"10,30"'  WHERE key = 'mission_invade_reward_near_gp';
UPDATE settings SET value = '"25,70"'  WHERE key = 'mission_invade_reward_mid_gp';
UPDATE settings SET value = '"60,160"' WHERE key = 'mission_invade_reward_far_gp';

-- Zero out any leftover steal-pct settings so admin pages don't expose dead knobs
UPDATE settings SET value = '0' WHERE key IN (
  'mission_invade_steal_pct_min',
  'mission_invade_steal_pct_max'
);

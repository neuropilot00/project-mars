-- 064: Mission cost rebalance
--
-- Problem: FAR invasion costs 3 PP ($3) but with 50% success rate,
-- expected PP return is only ~3.6 PP → barely profitable.
-- Small pads (×0.5~1.0) are guaranteed losses.
--
-- Fix: cut launch costs ~50%, slightly boost reward floors so that
-- even ×1.0 multiplier missions are worth launching.

-- ── Invasion costs (halved) ──
UPDATE settings SET value = '0.2'  WHERE key = 'mission_invade_cost_near';
UPDATE settings SET value = '0.8'  WHERE key = 'mission_invade_cost_mid';
UPDATE settings SET value = '1.5'  WHERE key = 'mission_invade_cost_far';

-- ── Invasion PP rewards (floors raised) ──
UPDATE settings SET value = '"0.2,1.0"'  WHERE key = 'mission_invade_reward_near_pp';
UPDATE settings SET value = '"0.5,2.5"'  WHERE key = 'mission_invade_reward_mid_pp';
UPDATE settings SET value = '"1.2,5.0"'  WHERE key = 'mission_invade_reward_far_pp';

-- ── Exploration costs (halved) ──
UPDATE settings SET value = '0.1'  WHERE key = 'mission_explore_cost_near';
UPDATE settings SET value = '0.4'  WHERE key = 'mission_explore_cost_mid';
UPDATE settings SET value = '1.0'  WHERE key = 'mission_explore_cost_far';

-- ── Exploration PP rewards (floors raised slightly) ──
UPDATE settings SET value = '"0.1,0.6"'  WHERE key = 'mission_explore_reward_near_pp';
UPDATE settings SET value = '"0.3,1.5"'  WHERE key = 'mission_explore_reward_mid_pp';
UPDATE settings SET value = '"0.6,3.5"'  WHERE key = 'mission_explore_reward_far_pp';

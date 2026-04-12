-- ══════════════════════════════════════════════════════
--  069: PP Economy Rebalance — missions must be PP SINKS
--  PP = real money. Missions cost PP to launch and reward
--  mostly GP. Small PP trickle-back keeps it feeling worth it
--  but net result is always PP negative.
-- ══════════════════════════════════════════════════════

-- ── Invasion PP rewards: slashed to 1/5 (net PP negative) ──
UPDATE settings SET value = '"0.02,0.15"' WHERE key = 'mission_invade_reward_near_pp';
UPDATE settings SET value = '"0.05,0.30"' WHERE key = 'mission_invade_reward_mid_pp';
UPDATE settings SET value = '"0.10,0.50"' WHERE key = 'mission_invade_reward_far_pp';

-- ── Exploration PP rewards: slashed to 1/5 ──
UPDATE settings SET value = '"0.01,0.08"' WHERE key = 'mission_explore_reward_near_pp';
UPDATE settings SET value = '"0.03,0.15"' WHERE key = 'mission_explore_reward_mid_pp';
UPDATE settings SET value = '"0.05,0.30"' WHERE key = 'mission_explore_reward_far_pp';

-- ── Compensate with higher GP rewards ──
UPDATE settings SET value = '"15,50"'  WHERE key = 'mission_invade_reward_near_gp';
UPDATE settings SET value = '"40,120"' WHERE key = 'mission_invade_reward_mid_gp';
UPDATE settings SET value = '"100,300"' WHERE key = 'mission_invade_reward_far_gp';

-- ── Invasion fail refund: reduce from 30% to 10% ──
UPDATE settings SET value = '10' WHERE key = 'mission_invade_fail_refund_pct';

-- ══ After this migration ══
-- NEAR invasion: cost 0.2 PP, reward avg 0.08 PP → net -0.12 PP (SINK!)
-- MID invasion:  cost 0.8 PP, reward avg 0.17 PP → net -0.63 PP (SINK!)
-- FAR invasion:  cost 1.5 PP, reward avg 0.30 PP → net -1.20 PP (SINK!)
-- NEAR explore:  cost 0.1 PP, reward avg 0.04 PP → net -0.06 PP (SINK!)
-- MID explore:   cost 0.4 PP, reward avg 0.09 PP → net -0.31 PP (SINK!)
-- FAR explore:   cost 1.0 PP, reward avg 0.17 PP → net -0.83 PP (SINK!)
-- Players spend PP, get GP/XP/items back. PP slowly drains.

-- 057: Mission System (single-player OPS: INVASION + EXPLORATION)
--
-- Two kinds of long-running missions launched from a player's territory:
--   INVASION    — attack another player's territory.  Ballistic arc route.
--   EXPLORATION — scan a random Mars coord.            Straight-line route.
--
-- Routes are private: only the launching player sees them on their client.
-- Server stores everything so the reward can be paid out when duration elapses.

CREATE TABLE IF NOT EXISTS missions (
  id               SERIAL PRIMARY KEY,
  wallet           VARCHAR(42) NOT NULL,
  type             VARCHAR(16) NOT NULL CHECK (type IN ('invasion','exploration')),
  -- Start position: closest pixel the player owned at launch time
  origin_lat       FLOAT NOT NULL,
  origin_lng       FLOAT NOT NULL,
  -- Target position
  target_lat       FLOAT NOT NULL,
  target_lng       FLOAT NOT NULL,
  target_wallet    VARCHAR(42) DEFAULT NULL,   -- only for invasion
  -- Travel info
  distance_deg     FLOAT NOT NULL,              -- great circle degrees
  start_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_sec     INT NOT NULL,
  -- Economy
  launch_cost_pp   NUMERIC(18,6) NOT NULL DEFAULT 0,
  -- State machine
  status           VARCHAR(16) NOT NULL DEFAULT 'traveling'
    CHECK (status IN ('traveling','complete','claimed','failed','cancelled')),
  success          BOOLEAN DEFAULT NULL,        -- null until resolved
  -- Rewards (jsonb): { pp, gp, xp, items:[...], cosmetic?, stolen_pixels? }
  reward_json      JSONB DEFAULT '{}'::jsonb,
  claimed_at       TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_wallet_status
  ON missions(wallet, status);

CREATE INDEX IF NOT EXISTS idx_missions_unclaimed
  ON missions(status, start_time)
  WHERE status IN ('traveling','complete');

CREATE INDEX IF NOT EXISTS idx_missions_target_wallet
  ON missions(target_wallet, status)
  WHERE target_wallet IS NOT NULL;

-- Settings: every tunable value is admin-configurable (no hardcoding)
INSERT INTO settings (key, value, category, description) VALUES
  -- Slots & daily caps
  ('mission_base_slots',              '2',    'missions', 'Concurrent mission slots at Lv.1'),
  ('mission_slot_level_step',         '10',   'missions', 'Levels per extra slot (+1 slot per step)'),
  ('mission_daily_cap',               '12',   'missions', 'Max missions launched per wallet per day'),

  -- Invasion durations (seconds) — NEAR / MID / FAR tiers (minimum 30min)
  ('mission_invade_near_sec',         '1800', 'missions', 'NEAR (<30°) invasion duration seconds'),
  ('mission_invade_mid_sec',          '5400', 'missions', 'MID (30-90°) invasion duration seconds'),
  ('mission_invade_far_sec',          '14400','missions', 'FAR (90°+) invasion duration seconds'),

  -- Exploration durations (minimum 30min)
  ('mission_explore_near_sec',        '1800', 'missions', 'NEAR exploration seconds'),
  ('mission_explore_mid_sec',         '5400', 'missions', 'MID exploration seconds'),
  ('mission_explore_far_sec',         '14400','missions', 'FAR exploration seconds'),

  -- Invasion launch costs (PP)
  ('mission_invade_cost_near',        '0.5',  'missions', 'NEAR invasion launch cost PP'),
  ('mission_invade_cost_mid',         '1.5',  'missions', 'MID invasion launch cost PP'),
  ('mission_invade_cost_far',         '3.0',  'missions', 'FAR invasion launch cost PP'),

  -- Exploration fuel costs (PP)
  ('mission_explore_cost_near',       '0.2',  'missions', 'NEAR exploration fuel PP'),
  ('mission_explore_cost_mid',        '0.8',  'missions', 'MID exploration fuel PP'),
  ('mission_explore_cost_far',        '2.0',  'missions', 'FAR exploration fuel PP'),

  -- Invasion success & reward parameters
  ('mission_invade_base_success',     '0.50', 'missions', 'Base invasion success rate'),
  ('mission_invade_pixel_ratio_bonus','0.20', 'missions', 'Max bonus from pixel ratio'),
  ('mission_invade_shield_penalty',   '0.30', 'missions', 'Max penalty from target shield'),
  ('mission_invade_min_success',      '0.10', 'missions', 'Clamp floor success rate'),
  ('mission_invade_max_success',      '0.90', 'missions', 'Clamp ceiling success rate'),
  ('mission_invade_steal_pct_min',    '3',    'missions', 'Min % pixels stolen on success'),
  ('mission_invade_steal_pct_max',    '8',    'missions', 'Max % pixels stolen on success'),
  ('mission_invade_fail_refund_pct',  '30',   'missions', 'Launch cost refund % on fail'),

  -- Reward ranges (admin-tunable). Stored as JSON strings "min,max".
  ('mission_invade_reward_near_pp',   '"0.1,0.8"',   'missions', 'NEAR invasion PP reward range'),
  ('mission_invade_reward_mid_pp',    '"0.3,1.8"',   'missions', 'MID invasion PP reward range'),
  ('mission_invade_reward_far_pp',    '"0.8,4.0"',   'missions', 'FAR invasion PP reward range'),
  ('mission_invade_reward_near_gp',   '"5,15"',      'missions', 'NEAR invasion GP reward range'),
  ('mission_invade_reward_mid_gp',    '"10,35"',     'missions', 'MID invasion GP reward range'),
  ('mission_invade_reward_far_gp',    '"25,80"',     'missions', 'FAR invasion GP reward range'),
  ('mission_invade_reward_near_xp',   '"10,30"',     'missions', 'NEAR invasion XP reward range'),
  ('mission_invade_reward_mid_xp',    '"25,60"',     'missions', 'MID invasion XP reward range'),
  ('mission_invade_reward_far_xp',    '"60,150"',    'missions', 'FAR invasion XP reward range'),
  ('mission_invade_item_drop_near',   '5',           'missions', 'NEAR invasion item drop %'),
  ('mission_invade_item_drop_mid',    '12',          'missions', 'MID invasion item drop %'),
  ('mission_invade_item_drop_far',    '25',          'missions', 'FAR invasion item drop %'),

  -- Exploration rewards (always pays out — 100% deliver)
  ('mission_explore_reward_near_pp',  '"0.05,0.5"',  'missions', 'NEAR exploration PP range'),
  ('mission_explore_reward_mid_pp',   '"0.15,1.2"',  'missions', 'MID exploration PP range'),
  ('mission_explore_reward_far_pp',   '"0.4,3.0"',   'missions', 'FAR exploration PP range'),
  ('mission_explore_reward_near_gp',  '"5,40"',      'missions', 'NEAR exploration GP range'),
  ('mission_explore_reward_mid_gp',   '"15,80"',     'missions', 'MID exploration GP range'),
  ('mission_explore_reward_far_gp',   '"35,180"',    'missions', 'FAR exploration GP range'),
  ('mission_explore_reward_near_xp',  '"10,30"',     'missions', 'NEAR exploration XP range'),
  ('mission_explore_reward_mid_xp',   '"30,80"',     'missions', 'MID exploration XP range'),
  ('mission_explore_reward_far_xp',   '"80,200"',    'missions', 'FAR exploration XP range'),
  ('mission_explore_rare_drop_near',  '5',         'missions', 'NEAR exploration rare item %'),
  ('mission_explore_rare_drop_mid',   '8',         'missions', 'MID exploration rare item %'),
  ('mission_explore_rare_drop_far',   '12',        'missions', 'FAR exploration rare item %'),
  ('mission_explore_poi_spawn_near',  '2',         'missions', 'NEAR exploration chance of spawning a POI %'),
  ('mission_explore_poi_spawn_far',   '2',         'missions', 'FAR exploration chance of spawning a POI %'),

  -- Exploration outcome variance — % chance of each tier (sum should be ~100)
  -- empty   = only minor XP, scan finds nothing
  -- partial = 60% of normal range, no item
  -- full    = full range + normal item drop chance
  -- jackpot = 1.6x range + guaranteed item
  ('mission_explore_outcome_empty_pct',   '25', 'missions', 'Exploration empty-result chance %'),
  ('mission_explore_outcome_partial_pct', '40', 'missions', 'Exploration partial-result chance %'),
  ('mission_explore_outcome_jackpot_pct', '10', 'missions', 'Exploration jackpot chance %'),

  -- Distance tier thresholds (degrees)
  ('mission_dist_near_max_deg',       '30',   'missions', 'NEAR tier max great-circle distance'),
  ('mission_dist_mid_max_deg',        '90',   'missions', 'MID tier max great-circle distance')
ON CONFLICT (key) DO NOTHING;

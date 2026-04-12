-- 059: Mission balance pass — bump min duration to 30min, add exploration variance
--
-- Player feedback: 15min missions felt too short, and exploration always paying
-- the full reward range felt monotonous. Bumping NEAR tier from 15→30min and
-- adding outcome-tier variance to exploration (empty / partial / full / jackpot).

-- ── Bump existing duration rows (won't reinsert via 057 ON CONFLICT DO NOTHING)
UPDATE settings SET value = '1800'  WHERE key = 'mission_invade_near_sec';
UPDATE settings SET value = '5400'  WHERE key = 'mission_invade_mid_sec';
UPDATE settings SET value = '14400' WHERE key = 'mission_invade_far_sec';
UPDATE settings SET value = '1800'  WHERE key = 'mission_explore_near_sec';
UPDATE settings SET value = '5400'  WHERE key = 'mission_explore_mid_sec';
UPDATE settings SET value = '14400' WHERE key = 'mission_explore_far_sec';

-- ── Add exploration outcome variance settings (idempotent)
INSERT INTO settings (key, value, category, description) VALUES
  ('mission_explore_outcome_empty_pct',   '25', 'missions', 'Exploration empty-result chance %'),
  ('mission_explore_outcome_partial_pct', '40', 'missions', 'Exploration partial-result chance %'),
  ('mission_explore_outcome_jackpot_pct', '10', 'missions', 'Exploration jackpot chance %')
ON CONFLICT (key) DO NOTHING;

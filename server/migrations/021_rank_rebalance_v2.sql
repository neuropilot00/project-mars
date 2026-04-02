-- ═══════════════════════════════════════════
--  021: Rank Rebalance v2 — $60k spend = max rank
-- ═══════════════════════════════════════════
-- Total map: ~5,040,000 pixels
-- XP per claim=2, per hijack=3 (avg ~2.5)
-- Avg pixel price ~$0.05 → $60,000 = ~1.2M pixels = ~3M XP
-- Lv.30 target: ~3,000,000 XP
--
-- Progression:
--   $20 (1000px)    → Lv.3
--   $100 (5000px)   → Lv.6
--   $500 (25kpx)    → Lv.10
--   $2000 (100kpx)  → Lv.15
--   $10000 (500kpx) → Lv.21
--   $30000 (750kpx) → Lv.26
--   $60000 (1.2Mpx) → Lv.30

DELETE FROM rank_definitions;

INSERT INTO rank_definitions (level, name, required_xp, reward_pp) VALUES
  (1,  'Dust Walker',         0,         0),
  (2,  'Sand Drifter',        500,       5),
  (3,  'Crater Scout',        2000,      8),
  (4,  'Ridge Runner',        5000,      12),
  (5,  'Storm Chaser',        10000,     18),
  (6,  'Canyon Ranger',       18000,     25),
  (7,  'Mesa Guardian',       30000,     35),
  (8,  'Dust Devil',          50000,     45),
  (9,  'Iron Prospector',     75000,     60),
  (10, 'Lava Walker',         110000,    80),
  (11, 'Dome Builder',        155000,    100),
  (12, 'Terrain Marshal',     210000,    130),
  (13, 'Sector Warden',       280000,    160),
  (14, 'Colony Architect',    370000,    200),
  (15, 'Storm Commander',     480000,    250),
  (16, 'Rift Master',         620000,    310),
  (17, 'Olympus Elite',       790000,    380),
  (18, 'Mars Sovereign',      980000,    460),
  (19, 'Red Emperor',         1200000,   550),
  (20, 'God of Mars',         1450000,   700),
  (21, 'Phobos Warlord',      1700000,   880),
  (22, 'Deimos Overlord',     1950000,   1050),
  (23, 'Valles Conqueror',    2150000,   1250),
  (24, 'Olympus Titan',       2350000,   1500),
  (25, 'Crimson Archon',      2500000,   1800),
  (26, 'Solar Vanguard',      2650000,   2100),
  (27, 'Void Marshal',        2800000,   2500),
  (28, 'Galactic Warden',     2900000,   3000),
  (29, 'Eternal Sovereign',   2950000,   3800),
  (30, 'Architect of Worlds', 3000000,   5000)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  required_xp = EXCLUDED.required_xp,
  reward_pp = EXCLUDED.reward_pp;

-- Recalculate all users' rank_level based on new XP thresholds
UPDATE users SET rank_level = (
  SELECT COALESCE(MAX(level), 1)
  FROM rank_definitions
  WHERE required_xp <= users.xp
);

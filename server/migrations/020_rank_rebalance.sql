-- ═══════════════════════════════════════════
--  020: Rank Rebalance — 30 levels, realistic progression
-- ═══════════════════════════════════════════
-- Total map: ~5,040,000 pixels
-- XP per claim=2, per hijack=3 (avg ~2.5)
-- Target: Lv.30 = top 10-15% of map (500k-750k pixels)
-- 2만 pixels ≈ Lv.7-8, 10만 pixels ≈ Lv.15-16, 50만 pixels ≈ Lv.28-30

DELETE FROM rank_definitions;

INSERT INTO rank_definitions (level, name, required_xp, reward_pp) VALUES
  (1,  'Dust Walker',         0,         0),
  (2,  'Sand Drifter',        200,       5),
  (3,  'Crater Scout',        600,       8),
  (4,  'Ridge Runner',        1500,      12),
  (5,  'Storm Chaser',        3000,      18),
  (6,  'Canyon Ranger',       6000,      25),
  (7,  'Mesa Guardian',       10000,     35),
  (8,  'Dust Devil',          18000,     45),
  (9,  'Iron Prospector',     30000,     60),
  (10, 'Lava Walker',         45000,     80),
  (11, 'Dome Builder',        65000,     100),
  (12, 'Terrain Marshal',     90000,     130),
  (13, 'Sector Warden',       120000,    160),
  (14, 'Colony Architect',    160000,    200),
  (15, 'Storm Commander',     210000,    250),
  (16, 'Rift Master',         270000,    310),
  (17, 'Olympus Elite',       340000,    380),
  (18, 'Mars Sovereign',      420000,    460),
  (19, 'Red Emperor',         520000,    550),
  (20, 'God of Mars',         640000,    700),
  (21, 'Phobos Warlord',      780000,    880),
  (22, 'Deimos Overlord',     920000,    1050),
  (23, 'Valles Conqueror',    1060000,   1250),
  (24, 'Olympus Titan',       1200000,   1500),
  (25, 'Crimson Archon',      1350000,   1800),
  (26, 'Solar Vanguard',      1500000,   2100),
  (27, 'Void Marshal',        1700000,   2500),
  (28, 'Galactic Warden',     1950000,   3000),
  (29, 'Eternal Sovereign',   2250000,   3800),
  (30, 'Architect of Worlds', 2600000,   5000)
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

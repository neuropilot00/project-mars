-- ═══════════════════════════════════════════
--  022: Rank Rebalance v3 — final balanced progression
-- ═══════════════════════════════════════════
-- Design targets:
--   - $3000 + 4 months active play → Lv.23 (~155,000 XP)
--   - $10,000 heavy player → Lv.27
--   - $60,000 whale → Lv.30
--   - F2P 4 months (game only) → Lv.8-10
--   - 2만 pixels ($40) → Lv.11
--
-- $3000 spend + 4mo active:
--   Pixels: 60k × 2.5avg = 150,000 XP
--   Daily activity (120 days × 30): 3,600 XP
--   Deposit XP: 3,000 XP
--   Total: ~156,600 XP → Lv.23 ✓
--
-- $60,000 whale:
--   1.2M px × 2.5 = 3,000,000 XP → Lv.30 ✓

DELETE FROM rank_definitions;

INSERT INTO rank_definitions (level, name, required_xp, reward_pp) VALUES
  (1,  'Dust Walker',         0,         0),
  (2,  'Sand Drifter',        50,        5),
  (3,  'Crater Scout',        150,       8),
  (4,  'Ridge Runner',        400,       12),
  (5,  'Storm Chaser',        1000,      18),
  (6,  'Canyon Ranger',       2000,      25),
  (7,  'Mesa Guardian',       4000,      35),
  (8,  'Dust Devil',          7000,      45),
  (9,  'Iron Prospector',     11000,     60),
  (10, 'Lava Walker',         17000,     80),
  (11, 'Dome Builder',        25000,     100),
  (12, 'Terrain Marshal',     35000,     130),
  (13, 'Sector Warden',       48000,     160),
  (14, 'Colony Architect',    63000,     200),
  (15, 'Storm Commander',     80000,     250),
  (16, 'Rift Master',         100000,    310),
  (17, 'Olympus Elite',       115000,    380),
  (18, 'Mars Sovereign',      130000,    460),
  (19, 'Red Emperor',         140000,    550),
  (20, 'God of Mars',         150000,    700),
  (21, 'Phobos Warlord',      165000,    880),
  (22, 'Deimos Overlord',     185000,    1050),
  (23, 'Valles Conqueror',    210000,    1250),
  (24, 'Olympus Titan',       300000,    1500),
  (25, 'Crimson Archon',      500000,    1800),
  (26, 'Solar Vanguard',      800000,    2100),
  (27, 'Void Marshal',        1200000,   2500),
  (28, 'Galactic Warden',     1800000,   3000),
  (29, 'Eternal Sovereign',   2400000,   3800),
  (30, 'Architect of Worlds', 3000000,   5000)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  required_xp = EXCLUDED.required_xp,
  reward_pp = EXCLUDED.reward_pp;

-- Recalculate all users' rank_level
UPDATE users SET rank_level = (
  SELECT COALESCE(MAX(level), 1)
  FROM rank_definitions
  WHERE required_xp <= users.xp
);

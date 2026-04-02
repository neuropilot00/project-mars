-- ═══════════════════════════════════════════
--  023: Smooth rank curve (n³ formula + 30% growth tail)
-- ═══════════════════════════════════════════
-- Formula: Lv.2~23 = 12.5 × level³ (smooth cubic curve)
--          Lv.24~30 = ×1.3 per level (exponential tail)
--
-- Result:
--   F2P 4 months (~4,000 XP) → Lv.7
--   $500 (~35,000 XP) → Lv.14
--   $3,000 + 4mo (~155,000 XP) → Lv.23 ✓
--   $8,000 (~420,000 XP) → Lv.27
--   $20,000 (~1,000,000 XP) → Lv.30

DELETE FROM rank_definitions;

INSERT INTO rank_definitions (level, name, required_xp, reward_pp) VALUES
  (1,  'Dust Walker',         0,         0),
  (2,  'Sand Drifter',        100,       5),
  (3,  'Crater Scout',        350,       8),
  (4,  'Ridge Runner',        800,       12),
  (5,  'Storm Chaser',        1600,      18),
  (6,  'Canyon Ranger',       2700,      25),
  (7,  'Mesa Guardian',       4300,      35),
  (8,  'Dust Devil',          6400,      50),
  (9,  'Iron Prospector',     9100,      65),
  (10, 'Lava Walker',         12500,     85),
  (11, 'Dome Builder',        17000,     110),
  (12, 'Terrain Marshal',     22000,     140),
  (13, 'Sector Warden',       28000,     175),
  (14, 'Colony Architect',    35000,     215),
  (15, 'Storm Commander',     42000,     260),
  (16, 'Rift Master',         51000,     320),
  (17, 'Olympus Elite',       62000,     390),
  (18, 'Mars Sovereign',      73000,     470),
  (19, 'Red Emperor',         86000,     560),
  (20, 'God of Mars',         100000,    700),
  (21, 'Phobos Warlord',      116000,    850),
  (22, 'Deimos Overlord',     133000,    1050),
  (23, 'Valles Conqueror',    155000,    1300),
  (24, 'Olympus Titan',       200000,    1600),
  (25, 'Crimson Archon',      260000,    2000),
  (26, 'Solar Vanguard',      340000,    2500),
  (27, 'Void Marshal',        440000,    3100),
  (28, 'Galactic Warden',     570000,    3800),
  (29, 'Eternal Sovereign',   740000,    4500),
  (30, 'Architect of Worlds', 1000000,   6000)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  required_xp = EXCLUDED.required_xp,
  reward_pp = EXCLUDED.reward_pp;

-- Remove any levels > 30
DELETE FROM rank_definitions WHERE level > 30;

-- ── Breakthrough system: level gates at 5, 10, 15, 20, 25 ──
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS breakthrough BOOLEAN DEFAULT false;
ALTER TABLE rank_definitions ADD COLUMN IF NOT EXISTS breakthrough_condition JSONB DEFAULT NULL;

-- ── BREAKTHROUGH GATES ──
-- Each gate requires: time + pixels + activity milestone

-- Lv.5 「First Step」: Basic territory + time
UPDATE rank_definitions SET breakthrough = true,
  breakthrough_condition = '{"type":"multi","conditions":[
    {"type":"pixels","min":10},
    {"type":"play_days","min":3}
  ],"label":"FIRST STEP","desc":"Own 10+ pixels · 3 days played"}'::jsonb
WHERE level = 5;

-- Lv.10 「Explorer」: Multi-sector + games + time
UPDATE rank_definitions SET breakthrough = true,
  breakthrough_condition = '{"type":"multi","conditions":[
    {"type":"pixels","min":100},
    {"type":"sectors","min":2},
    {"type":"games_played","min":5},
    {"type":"play_days","min":14}
  ],"label":"EXPLORER","desc":"100+ pixels · 2+ sectors · 5 games · 14 days"}'::jsonb
WHERE level = 10;

-- Lv.15 「Warrior」: PvP activity + quests + time
UPDATE rank_definitions SET breakthrough = true,
  breakthrough_condition = '{"type":"multi","conditions":[
    {"type":"pixels","min":500},
    {"type":"hijacks","min":10},
    {"type":"quests","min":10},
    {"type":"play_days","min":30}
  ],"label":"WARRIOR","desc":"500+ pixels · 10 hijacks · 10 quests · 30 days"}'::jsonb
WHERE level = 15;

-- Lv.20 「Commander」: Investment + community + time
UPDATE rank_definitions SET breakthrough = true,
  breakthrough_condition = '{"type":"multi","conditions":[
    {"type":"pixels","min":2000},
    {"type":"deposit","min":50},
    {"type":"quests","min":30},
    {"type":"games_played","min":50},
    {"type":"play_days","min":60}
  ],"label":"COMMANDER","desc":"2000+ pixels · $50 deposited · 30 quests · 50 games · 60 days"}'::jsonb
WHERE level = 20;

-- Lv.25 「Legend」: All-round mastery
UPDATE rank_definitions SET breakthrough = true,
  breakthrough_condition = '{"type":"multi","conditions":[
    {"type":"pixels","min":5000},
    {"type":"sectors","min":4},
    {"type":"deposit","min":200},
    {"type":"hijacks","min":50},
    {"type":"quests","min":50},
    {"type":"referrals","min":3},
    {"type":"play_days","min":90}
  ],"label":"LEGEND","desc":"5000+ pixels · 4+ sectors · $200 deposited · 50 hijacks · 50 quests · 3 referrals · 90 days"}'::jsonb
WHERE level = 25;

-- Track breakthrough status per user
CREATE TABLE IF NOT EXISTS user_breakthroughs (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) NOT NULL,
  level INT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, level)
);

-- Recalculate all users
UPDATE users SET rank_level = (
  SELECT COALESCE(MAX(level), 1)
  FROM rank_definitions
  WHERE required_xp <= users.xp
);

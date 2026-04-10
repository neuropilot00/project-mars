-- ═══════════════════════════════════════════════════
-- 050: Redesign seasons with balanced rewards
-- Main rewards: GP + XP + Items. PP is extremely rare (top 1 only, tiny amount)
-- Multiple reward entries per tier → player gets ALL rewards at their tier
-- ═══════════════════════════════════════════════════

-- Allow 'item' and 'xp' in season_rewards
ALTER TABLE season_rewards DROP CONSTRAINT IF EXISTS season_rewards_reward_type_check;
ALTER TABLE season_rewards ADD CONSTRAINT season_rewards_reward_type_check
  CHECK (reward_type IN ('pp','gp','usdt','xp','item','cosmetic','title'));

-- Add tracking columns to season_scores (18+ categories, all tracked always)
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS tap_count INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS battles_lost INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS items_used INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS quests_done INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS gp_spent INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS pp_spent DECIMAL(20,6) DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS shields_placed INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS sectors_entered INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS login_days INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS cosmetics_equipped INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS cantina_plays INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS guild_contributions INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS referrals INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS chat_messages INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS total_gp_earned INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS total_pp_earned DECIMAL(20,6) DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS pixels_lost INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS rockets_joined INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS weather_checks INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS territory_renames INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS shares_count INT DEFAULT 0;

-- Seasons: which categories are active this season (6 out of 18+)
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS active_categories JSONB DEFAULT '["overall","territory","mining","combat","explorer","active"]';

-- ═══════════════════════════════════════
--  SEASON 1: VOLCANIC DAWN 🌋
--  Rewards per CATEGORY (overall, territory, mining, combat, explorer)
--  Each category has its own leaderboard!
-- ═══════════════════════════════════════
UPDATE seasons SET
  name = 'Season 1: Volcanic Dawn',
  theme = 'volcanic',
  ends_at = GREATEST(ends_at, NOW() + INTERVAL '25 days'),
  rewards_json = '[
    {"category":"overall",   "rank":1, "type":"gp",   "amount":3000, "title":"Mars Conqueror"},
    {"category":"overall",   "rank":1, "type":"pp",   "amount":0.5},
    {"category":"overall",   "rank":1, "type":"xp",   "amount":500},
    {"category":"overall",   "rank":1, "type":"item", "amount":2, "item_code":"pixel_doubler"},
    {"category":"overall",   "rank":3, "type":"gp",   "amount":1500},
    {"category":"overall",   "rank":3, "type":"xp",   "amount":300},
    {"category":"overall",   "rank":3, "type":"item", "amount":1, "item_code":"pixel_doubler"},
    {"category":"overall",   "rank":10,"type":"gp",   "amount":500},
    {"category":"overall",   "rank":10,"type":"xp",   "amount":100},

    {"category":"territory", "rank":1, "type":"gp",   "amount":2000, "title":"Territory King"},
    {"category":"territory", "rank":1, "type":"xp",   "amount":400},
    {"category":"territory", "rank":1, "type":"item", "amount":3, "item_code":"shield_advanced"},
    {"category":"territory", "rank":3, "type":"gp",   "amount":1000},
    {"category":"territory", "rank":3, "type":"item", "amount":2, "item_code":"shield_basic"},
    {"category":"territory", "rank":10,"type":"gp",   "amount":300},

    {"category":"mining",    "rank":1, "type":"gp",   "amount":2000, "title":"Mining Master"},
    {"category":"mining",    "rank":1, "type":"xp",   "amount":400},
    {"category":"mining",    "rank":1, "type":"item", "amount":3, "item_code":"mining_boost"},
    {"category":"mining",    "rank":3, "type":"gp",   "amount":1000},
    {"category":"mining",    "rank":3, "type":"item", "amount":2, "item_code":"mining_boost"},
    {"category":"mining",    "rank":10,"type":"gp",   "amount":300},

    {"category":"combat",    "rank":1, "type":"gp",   "amount":2500, "title":"Combat Legend"},
    {"category":"combat",    "rank":1, "type":"pp",   "amount":0.3},
    {"category":"combat",    "rank":1, "type":"xp",   "amount":400},
    {"category":"combat",    "rank":1, "type":"item", "amount":3, "item_code":"attack_boost"},
    {"category":"combat",    "rank":1, "type":"item", "amount":2, "item_code":"emp_strike"},
    {"category":"combat",    "rank":3, "type":"gp",   "amount":1200},
    {"category":"combat",    "rank":3, "type":"item", "amount":2, "item_code":"attack_boost"},
    {"category":"combat",    "rank":10,"type":"gp",   "amount":400},

    {"category":"explorer",  "rank":1, "type":"gp",   "amount":2000, "title":"Explorer Elite"},
    {"category":"explorer",  "rank":1, "type":"xp",   "amount":400},
    {"category":"explorer",  "rank":1, "type":"item", "amount":2, "item_code":"radar_scan"},
    {"category":"explorer",  "rank":1, "type":"item", "amount":2, "item_code":"stealth_cloak"},
    {"category":"explorer",  "rank":3, "type":"gp",   "amount":1000},
    {"category":"explorer",  "rank":3, "type":"item", "amount":1, "item_code":"radar_scan"},
    {"category":"explorer",  "rank":10,"type":"gp",   "amount":300},

    {"category":"active",    "rank":1, "type":"gp",   "amount":1500, "title":"Most Active"},
    {"category":"active",    "rank":1, "type":"xp",   "amount":300},
    {"category":"active",    "rank":1, "type":"item", "amount":2, "item_code":"mining_boost"},
    {"category":"active",    "rank":3, "type":"gp",   "amount":800},
    {"category":"active",    "rank":10,"type":"gp",   "amount":200}
  ]'::jsonb,
  active_categories = '["overall","territory","mining","combat","explorer","active"]'::jsonb,
  weather_weights = '{"dust_storm":0.10,"meteor_shower":0.15,"solar_flare":0.10,"cold_wave":0.05,"clear":0.60}'::jsonb,
  visual_tint = 'rgba(255,80,30,0.06)'
WHERE id = (SELECT id FROM seasons ORDER BY id LIMIT 1);

-- ═══════════════════════════════════════
--  SEASON 2: FROZEN FRONTIER ❄️
-- ═══════════════════════════════════════
INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint)
SELECT
  'Season 2: Frozen Frontier', 'ice_age',
  s1.ends_at, s1.ends_at + INTERVAL '30 days', false,
  '[
    {"category":"overall",   "rank":1, "type":"gp",   "amount":4000, "title":"Ice Emperor"},
    {"category":"overall",   "rank":1, "type":"pp",   "amount":0.8},
    {"category":"overall",   "rank":1, "type":"xp",   "amount":600},
    {"category":"overall",   "rank":1, "type":"item", "amount":3, "item_code":"pixel_doubler"},
    {"category":"overall",   "rank":3, "type":"gp",   "amount":2000},
    {"category":"overall",   "rank":3, "type":"xp",   "amount":350},
    {"category":"overall",   "rank":10,"type":"gp",   "amount":600},

    {"category":"territory", "rank":1, "type":"gp",   "amount":2500, "title":"Frozen Conqueror"},
    {"category":"territory", "rank":1, "type":"item", "amount":3, "item_code":"shield_advanced"},
    {"category":"territory", "rank":3, "type":"gp",   "amount":1200},
    {"category":"territory", "rank":10,"type":"gp",   "amount":400},

    {"category":"mining",    "rank":1, "type":"gp",   "amount":2500, "title":"Frostminer"},
    {"category":"mining",    "rank":1, "type":"item", "amount":4, "item_code":"mining_boost"},
    {"category":"mining",    "rank":3, "type":"gp",   "amount":1200},
    {"category":"mining",    "rank":10,"type":"gp",   "amount":400},

    {"category":"combat",    "rank":1, "type":"gp",   "amount":3000, "title":"Blizzard Warrior"},
    {"category":"combat",    "rank":1, "type":"pp",   "amount":0.5},
    {"category":"combat",    "rank":1, "type":"item", "amount":3, "item_code":"emp_strike"},
    {"category":"combat",    "rank":3, "type":"gp",   "amount":1500},
    {"category":"combat",    "rank":10,"type":"gp",   "amount":500},

    {"category":"defender",  "rank":1, "type":"gp",   "amount":2000, "title":"Resilient Fighter"},
    {"category":"defender",  "rank":1, "type":"item", "amount":3, "item_code":"shield_advanced"},
    {"category":"defender",  "rank":3, "type":"gp",   "amount":1000},
    {"category":"defender",  "rank":10,"type":"gp",   "amount":300},

    {"category":"quester",   "rank":1, "type":"gp",   "amount":2000, "title":"Quest Hero"},
    {"category":"quester",   "rank":1, "type":"xp",   "amount":400},
    {"category":"quester",   "rank":3, "type":"gp",   "amount":1000},
    {"category":"quester",   "rank":10,"type":"gp",   "amount":300},

    {"category":"dedicated", "rank":1, "type":"gp",   "amount":1500, "title":"Most Dedicated"},
    {"category":"dedicated", "rank":1, "type":"xp",   "amount":300},
    {"category":"dedicated", "rank":3, "type":"gp",   "amount":800},
    {"category":"dedicated", "rank":10,"type":"gp",   "amount":200}
  ]'::jsonb,
  '{"dust_storm":0.05,"meteor_shower":0.08,"solar_flare":0.02,"cold_wave":0.30,"clear":0.55}'::jsonb,
  'rgba(100,180,255,0.06)'
FROM seasons s1
WHERE s1.id = (SELECT id FROM seasons ORDER BY id LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM seasons WHERE theme = 'ice_age');

-- Set S2 active_categories (different mix)
UPDATE seasons SET active_categories = '["overall","territory","defender","quester","dedicated","combat"]'::jsonb
WHERE theme = 'ice_age';

-- ═══════════════════════════════════════
--  SEASON 3: SOLAR INFERNO ☀️
-- ═══════════════════════════════════════
INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint)
SELECT
  'Season 3: Solar Inferno', 'solar_storm',
  s2.ends_at, s2.ends_at + INTERVAL '30 days', false,
  '[
    {"category":"overall",   "rank":1, "type":"gp",   "amount":5000, "title":"Solar Sovereign"},
    {"category":"overall",   "rank":1, "type":"pp",   "amount":1},
    {"category":"overall",   "rank":1, "type":"xp",   "amount":800},
    {"category":"overall",   "rank":1, "type":"item", "amount":5, "item_code":"pixel_doubler"},
    {"category":"overall",   "rank":3, "type":"gp",   "amount":2500},
    {"category":"overall",   "rank":3, "type":"xp",   "amount":400},
    {"category":"overall",   "rank":10,"type":"gp",   "amount":800},

    {"category":"territory", "rank":1, "type":"gp",   "amount":3000, "title":"Solar Landlord"},
    {"category":"territory", "rank":1, "type":"item", "amount":4, "item_code":"shield_advanced"},
    {"category":"territory", "rank":3, "type":"gp",   "amount":1500},
    {"category":"territory", "rank":10,"type":"gp",   "amount":500},

    {"category":"mining",    "rank":1, "type":"gp",   "amount":3000, "title":"Plasma Miner"},
    {"category":"mining",    "rank":1, "type":"item", "amount":5, "item_code":"mining_boost"},
    {"category":"mining",    "rank":3, "type":"gp",   "amount":1500},
    {"category":"mining",    "rank":10,"type":"gp",   "amount":500},

    {"category":"combat",    "rank":1, "type":"gp",   "amount":4000, "title":"Inferno Warlord"},
    {"category":"combat",    "rank":1, "type":"pp",   "amount":0.5},
    {"category":"combat",    "rank":1, "type":"item", "amount":5, "item_code":"emp_strike"},
    {"category":"combat",    "rank":3, "type":"gp",   "amount":2000},
    {"category":"combat",    "rank":10,"type":"gp",   "amount":600},

    {"category":"shopper",   "rank":1, "type":"gp",   "amount":2500, "title":"Item Master"},
    {"category":"shopper",   "rank":1, "type":"item", "amount":3, "item_code":"pixel_doubler"},
    {"category":"shopper",   "rank":3, "type":"gp",   "amount":1200},
    {"category":"shopper",   "rank":10,"type":"gp",   "amount":400},

    {"category":"influencer","rank":1, "type":"gp",   "amount":2000, "title":"Mars Influencer"},
    {"category":"influencer","rank":1, "type":"xp",   "amount":500},
    {"category":"influencer","rank":3, "type":"gp",   "amount":1000},
    {"category":"influencer","rank":10,"type":"gp",   "amount":300}
  ]'::jsonb,
  '{"dust_storm":0.08,"meteor_shower":0.10,"solar_flare":0.30,"cold_wave":0.02,"clear":0.50}'::jsonb,
  'rgba(255,200,50,0.06)'
FROM seasons s2
WHERE s2.theme = 'ice_age'
AND NOT EXISTS (SELECT 1 FROM seasons WHERE theme = 'solar_storm');

-- Set S3 active_categories (another different mix)
UPDATE seasons SET active_categories = '["overall","combat","mining","shopper","influencer","explorer"]'::jsonb
WHERE theme = 'solar_storm';

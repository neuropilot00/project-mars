-- ═══════════════════════════════════════════════════
-- 050: Redesign seasons with balanced rewards
-- PP is money — main rewards are GP + Items, PP is rare top-tier only
-- ═══════════════════════════════════════════════════

-- Update Season 1 with balanced rewards (was giving 5000 PP to rank 1, way too much)
UPDATE seasons SET
  name = 'Season 1: Volcanic Dawn',
  theme = 'volcanic',
  ends_at = GREATEST(ends_at, NOW() + INTERVAL '25 days'),
  rewards_json = '[
    {"rank":1,  "type":"pp",  "amount":10,   "title":"Mars Conqueror"},
    {"rank":2,  "type":"pp",  "amount":5,    "title":"Volcanic Champion"},
    {"rank":3,  "type":"pp",  "amount":3,    "title":"Lava Lord"},
    {"rank":5,  "type":"gp",  "amount":500,  "title":"Fire Walker"},
    {"rank":10, "type":"gp",  "amount":300},
    {"rank":20, "type":"gp",  "amount":200},
    {"rank":50, "type":"gp",  "amount":100}
  ]'::jsonb,
  weather_weights = '{
    "dust_storm": 0.10,
    "meteor_shower": 0.15,
    "solar_flare": 0.10,
    "cold_wave": 0.05,
    "clear": 0.60
  }'::jsonb,
  visual_tint = 'rgba(255,80,30,0.06)'
WHERE id = (SELECT id FROM seasons ORDER BY id LIMIT 1);

-- Pre-create Season 2 (inactive, starts after Season 1 ends)
INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint)
SELECT
  'Season 2: Frozen Frontier',
  'ice_age',
  s1.ends_at,
  s1.ends_at + INTERVAL '30 days',
  false,
  '[
    {"rank":1,  "type":"pp",  "amount":15,   "title":"Ice Emperor"},
    {"rank":2,  "type":"pp",  "amount":8,    "title":"Frost General"},
    {"rank":3,  "type":"pp",  "amount":5,    "title":"Glacier Knight"},
    {"rank":5,  "type":"gp",  "amount":600,  "title":"Blizzard Walker"},
    {"rank":10, "type":"gp",  "amount":350},
    {"rank":20, "type":"gp",  "amount":200},
    {"rank":50, "type":"gp",  "amount":120}
  ]'::jsonb,
  '{
    "dust_storm": 0.05,
    "meteor_shower": 0.08,
    "solar_flare": 0.02,
    "cold_wave": 0.30,
    "clear": 0.55
  }'::jsonb,
  'rgba(100,180,255,0.06)'
FROM seasons s1
WHERE s1.id = (SELECT id FROM seasons ORDER BY id LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM seasons WHERE theme = 'ice_age');

-- Pre-create Season 3 (inactive)
INSERT INTO seasons (name, theme, starts_at, ends_at, active, rewards_json, weather_weights, visual_tint)
SELECT
  'Season 3: Solar Inferno',
  'solar_storm',
  s2.ends_at,
  s2.ends_at + INTERVAL '30 days',
  false,
  '[
    {"rank":1,  "type":"pp",  "amount":20,   "title":"Solar Sovereign"},
    {"rank":2,  "type":"pp",  "amount":12,   "title":"Plasma Warden"},
    {"rank":3,  "type":"pp",  "amount":7,    "title":"Flare Commander"},
    {"rank":5,  "type":"gp",  "amount":700,  "title":"Radiation Runner"},
    {"rank":10, "type":"gp",  "amount":400},
    {"rank":20, "type":"gp",  "amount":250},
    {"rank":50, "type":"gp",  "amount":150}
  ]'::jsonb,
  '{
    "dust_storm": 0.08,
    "meteor_shower": 0.10,
    "solar_flare": 0.30,
    "cold_wave": 0.02,
    "clear": 0.50
  }'::jsonb,
  'rgba(255,200,50,0.06)'
FROM seasons s2
WHERE s2.theme = 'ice_age'
AND NOT EXISTS (SELECT 1 FROM seasons WHERE theme = 'solar_storm');

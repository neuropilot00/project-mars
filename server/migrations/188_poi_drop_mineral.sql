-- Migration 188: POI(exploration_pois) 보상에 mineral 카테고리 추가
-- 사용자 신고: "poi에도 gp나 아이템이나 광물이 섞여서 나오는게 맞지 않을까?"
-- Fix: rocket drop 과 동일한 패턴 — mineral weight + 광물 풀 + 수량 settings + reward_type CHECK 갱신.

-- 1) reward_type CHECK constraint 에 'mineral' 추가
ALTER TABLE exploration_pois DROP CONSTRAINT IF EXISTS exploration_pois_reward_type_check;
ALTER TABLE exploration_pois ADD CONSTRAINT exploration_pois_reward_type_check
  CHECK (reward_type::text = ANY (ARRAY['pp','gp','item','xp','mineral']::text[]));

-- 2) settings 시드
INSERT INTO settings (category, key, value, description) VALUES
  ('poi', 'poi_drop_mineral_weight',  '25',
     'POI 광물 보상 가중치 (gp/item/mineral/pp 비교) — admin 조정 가능'),
  ('poi', 'poi_drop_mineral_pool',    '"iron_ore,carbon_fiber,silicon_chip,titanium_alloy,plasma_crystal,nano_polymer"',
     'POI 광물 풀 (resources.code 쉼표 구분). 비면 mineral slot 은 GP fallback.'),
  ('poi', 'poi_drop_mineral_min_qty', '1',
     'POI 광물 1회 드롭 최소 수량'),
  ('poi', 'poi_drop_mineral_max_qty', '4',
     'POI 광물 1회 드롭 최대 수량')
ON CONFLICT (key) DO NOTHING;

-- 3) 기존 GP 가중치 70 → 50 으로 조정 (mineral 25 추가했으니 GP 비중 낮춤). admin 재조정 가능.
UPDATE settings SET value = '50'
WHERE key = 'poi_drop_gp_weight' AND value::text = '70';

INSERT INTO schema_migrations (filename) VALUES ('188_poi_drop_mineral.sql') ON CONFLICT DO NOTHING;

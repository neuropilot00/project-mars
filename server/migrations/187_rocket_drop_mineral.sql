-- Migration 187: Rocket drop reward — mineral 카테고리 추가
-- 사용자 신고: "자원드롭 15개인데 GP만 존나 나옴 — GP/아이템/광물 랜덤 섞이게 해"
-- Fix: mineral 가중치 추가 + 광물 풀(공통 채굴 광물 3종) + 수량 범위 settings.

INSERT INTO settings (category, key, value, description) VALUES
  ('rocket', 'rocket_drop_mineral_weight',  '25',
     '광물 보상 가중치 (다른 weight 들과 비교) — admin 조정 가능'),
  ('rocket', 'rocket_drop_mineral_pool',    '"iron_ore,carbon_fiber,silicon_chip,titanium_alloy,plasma_crystal,nano_polymer"',
     '로켓 드롭 광물 풀 (resources.code 쉼표 구분). 비면 mineral slot 은 GP 로 fallback.'),
  ('rocket', 'rocket_drop_mineral_min_qty', '1',
     '광물 1회 드롭 최소 수량'),
  ('rocket', 'rocket_drop_mineral_max_qty', '5',
     '광물 1회 드롭 최대 수량')
ON CONFLICT (key) DO NOTHING;

-- 기존 GP 가중치 50 → 30 으로 조정 (광물 25 추가했으니 GP 비중 낮춰서 균형).
-- 사용자가 admin 패널에서 다시 조정 가능.
UPDATE settings SET value = '30'
WHERE key = 'rocket_drop_gp_weight' AND value::text = '50';

INSERT INTO schema_migrations (filename) VALUES ('187_rocket_drop_mineral.sql') ON CONFLICT DO NOTHING;

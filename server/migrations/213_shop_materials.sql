-- Migration 213: 조선소 재료 상점 판매 추가
-- 프리깃/구축함 제작에 필요한 Tier1~2 재료를 GP로 구매 가능

INSERT INTO item_types (code, name, description, category, price_gp, price_pp, price_usdt, duration_hours, effect_value, icon, max_stack, active)
VALUES
  ('mat_iron_ore',       '철광석 x5',       '함선 제작 기초 재료. 철광석 5개.',                        'material', 50,  0, 0, 0, 5,  '⛏', 99, true),
  ('mat_carbon_fiber',   '탄소섬유 x5',     '프리깃 제작 필수 재료. 탄소섬유 5개.',                   'material', 60,  0, 0, 0, 5,  '🧵', 99, true),
  ('mat_silicon_chip',   '실리콘 칩 x3',    'FSP 함선 제작 재료. 실리콘 칩 3개.',                     'material', 55,  0, 0, 0, 3,  '💾', 99, true),
  ('mat_titanium_alloy', '티타늄 합금 x3',  '구축함/고급 함선 제작 재료. 티타늄 합금 3개.',           'material', 120, 0, 0, 0, 3,  '🔩', 99, true),
  ('mat_plasma_crystal', '플라즈마 결정 x2','고급 함선 제작 재료. 플라즈마 결정 2개.',               'material', 150, 0, 0, 0, 2,  '💎', 99, true),
  ('mat_plasma_coil',    '플라즈마 코일 x3','MCC 함선 전용 제작 재료. 플라즈마 코일 3개.',           'material', 80,  0, 0, 0, 3,  '🔋', 99, true),
  ('mat_alloy_frame',    '합금 프레임 x2',  'Tier 3 고급 재료. 합금 프레임 2개.',                     'material', 200, 0, 0, 0, 2,  '🛠', 99, true),
  ('mat_hull_plate',     '장갑판 x2',       '대형함 제작 필수 재료. 장갑판 2개.',                     'material', 250, 0, 0, 0, 2,  '🔲', 99, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('213_shop_materials.sql') ON CONFLICT DO NOTHING;

-- Migration 212: Crafting recipes seed
-- 제작 탭에 기본 레시피 추가 (광물 → 아이템)

-- ingredients format: [{"code":"iron_ore","qty":3}, ...]
-- output_item_type_id: item_types.id 기준

INSERT INTO crafting_recipes
  (name, description, category, ingredients, gp_cost, output_item_type_id, output_qty, output_name, success_rate, fail_refund_pct, is_active, sort_order)
VALUES
  -- DEFENSE 카테고리
  ('에너지 실드 제작', '기본 에너지 실드를 제작합니다. 12시간 동안 영토를 보호합니다.',
   'defense',
   '[{"code":"iron_ore","qty":5},{"code":"silicon_dust","qty":3}]',
   50, 1, 1, '에너지 실드', 80, 50, true, 1),

  ('플라즈마 실드 제작', '고급 플라즈마 실드를 제작합니다. 24시간 동안 영토를 보호합니다.',
   'defense',
   '[{"code":"titanium_alloy","qty":3},{"code":"plasma_crystal","qty":2}]',
   150, 2, 1, '플라즈마 실드', 65, 50, true, 2),

  -- ATTACK 카테고리
  ('EMP 공격 제작', '대상 실드를 6시간 동안 비활성화합니다.',
   'attack',
   '[{"code":"iron_ore","qty":4},{"code":"silicon_dust","qty":4}]',
   80, 3, 1, 'EMP 공격', 75, 50, true, 3),

  ('화성의 분노 제작', '다음 점령 시 공격력을 강화합니다.',
   'attack',
   '[{"code":"exotic_alloy","qty":1},{"code":"iron_ore","qty":5}]',
   200, 4, 1, '화성의 분노', 60, 50, true, 4),

  -- UTILITY 카테고리
  ('레이더 스캔 제작', '근처 숨겨진 영토를 표시합니다.',
   'utility',
   '[{"code":"silicon_dust","qty":5},{"code":"carbon_fiber","qty":2}]',
   60, 6, 2, '레이더 스캔', 85, 50, true, 5),

  ('스텔스 망토 제작', '1시간 동안 영토를 숨깁니다.',
   'utility',
   '[{"code":"dark_matter","qty":1},{"code":"silicon_dust","qty":3}]',
   180, 5, 1, '스텔스 망토', 70, 50, true, 6),

  -- BOOST 카테고리
  ('채굴 부스트 제작', '채굴 효율을 2배로 높입니다.',
   'boost',
   '[{"code":"carbon_fiber","qty":3},{"code":"silicon_dust","qty":3}]',
   100, 8, 2, '채굴 부스트', 80, 50, true, 7),

  ('픽셀 더블러 제작', '다음 클레임 시 픽셀 수를 2배로 합니다.',
   'boost',
   '[{"code":"quantum_core","qty":1},{"code":"titanium_alloy","qty":2}]',
   300, 7, 1, '픽셀 더블러', 55, 50, true, 8)

ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('212_crafting_recipes_seed.sql') ON CONFLICT DO NOTHING;

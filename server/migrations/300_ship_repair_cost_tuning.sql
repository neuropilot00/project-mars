-- ============================================================
-- Migration 300: 함선 수리비 적정화 (전투 손상 → 의미있는 반복 GP 싱크)
--
-- 배경: ship_repair_gp_per_hp가 라이브 0.01로 사실상 공짜였음(대형함 30% 손상
--   수리가 건조비의 ~10%). full-loss 전투(격침=영구소멸)와 짝이 되는 "생존함 수리"
--   싱크가 무의미 → 전투 손상이 GP를 거의 안 태움.
--
-- 조치: ship_repair_gp_per_hp 0.01 → 0.03. 캡(건조비×60%)은 유지.
--   결과(클래스별, 손상비례→캡):
--     cruiser  재건 4500  : 30%손상 900 / 60%손상 1800 / 캡 2700
--     battleship 11000    : 3780 / 6600(캡) / 6600
--     titan    52000      : 15750 / 31200(캡) / 31200
--     frigate/destroyer   : 캡이 일찍 걸려 ~60% (싼 건조비, 준-소모품)
--   → 대형함은 수리vs재건 실제 선택, 빈번한 전투에 반복 GP 싱크. EVE식 디플레 강화.
--
-- 정리: ship_repair_iron_per_hp(0.5)는 코드 미사용(죽은 설정) → 제거. 실제 광물 싱크는
--   ship_repair_iron_per_10hp(0.2) 사용 중이며 유지.
--
-- 주의: settings.key 단독 UNIQUE 없음 → UPDATE(중복행 전부) 패턴.
-- ============================================================

UPDATE settings SET value = '0.03' WHERE key = 'ship_repair_gp_per_hp';

INSERT INTO settings (category, key, value, description)
  SELECT 'fleet', 'ship_repair_gp_per_hp', '0.03', '수리 GP/HP (전투 손상 싱크; 캡=건조비×ship_repair_cost_cap_pct_of_build)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'ship_repair_gp_per_hp');

DELETE FROM settings WHERE key = 'ship_repair_iron_per_hp';

INSERT INTO schema_migrations (filename) VALUES ('300_ship_repair_cost_tuning.sql') ON CONFLICT DO NOTHING;

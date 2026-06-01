-- ============================================================
-- Migration 294: 경제 파우셋 절충 복구 (재시뮬 결과 반영)
--
-- 배경: 1차 시뮬은 함대 소비를 빼먹어 "GP 소각 0 / 인플레"라는 틀린 결론을 냈고,
--       그에 따라 mig 293(v7.347)에서 파우셋을 일괄 하향했다.
--       함대 소비(건조/가챠/합체/강화/수리/실드/하이잭) 포함 재시뮬 결과 경제는
--       강한 디플레(소각 ≫ 발행: 함대액티브 net -579k, 고래 -24.2M, 혼합 -282k)임이
--       확인됐다. 따라서 파우셋을 굳이 깎을 이유가 없고, 삭감은 신규/F2P 진입만 막는다.
--
-- 절충: 신규 진입에 직접 영향 큰 미션 전부완료 보너스는 원래값(50)으로 복구.
--       장기 출석 streak 마일스톤은 봇 long-term farming 억제 차원에서 원래값과
--       293값의 "중간"으로 둔다(완전 원복은 안 함).
--
-- 주의: settings.key 에 단독 UNIQUE 없고 일부 키 중복행 존재 → ON CONFLICT 대신
--       UPDATE(중복행 전부) + 없을 때만 INSERT 패턴.
-- ============================================================

-- 1) 미션 전부완료 보너스: 25 -> 50 (원복, 신규 진입)
UPDATE settings SET value = '50' WHERE key = 'daily_mission_bonus_gp';

-- 2) streak 마일스톤: 원래(200/500/1000)와 293(100/300/600)의 중간값
UPDATE settings SET value = '150' WHERE key = 'streak_7_gp';   -- 200<->100 중간
UPDATE settings SET value = '400' WHERE key = 'streak_14_gp';  -- 500<->300 중간
UPDATE settings SET value = '800' WHERE key = 'streak_30_gp';  -- 1000<->600 중간

-- 3) 키 부재 시(프로덕션) 1행 삽입
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'daily_mission_bonus_gp', '50', '일일 미션 전부완료 보너스 GP (원복)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='daily_mission_bonus_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_7_gp', '150', '7일 연속 출석 마일스톤 GP (절충)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_7_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_14_gp', '400', '14일 연속 출석 마일스톤 GP (절충)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_14_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_30_gp', '800', '30일 연속 출석 마일스톤 GP (절충)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_30_gp');

INSERT INTO schema_migrations (filename) VALUES ('294_economy_faucet_revert_compromise.sql') ON CONFLICT DO NOTHING;

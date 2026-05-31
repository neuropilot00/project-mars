-- ============================================================
-- Migration 293: 경제 밸런스 — GP 파우셋(발행) 하향 튜닝
--
-- 배경: 격리 경제 시뮬(50인×7일) 결과, 무과금(F2P) 루프가 GP를 단방향
--       순발행(7일 +46,720 GP, 1인 일평균 +133)했고 발행의 99.86%가
--       일일 로그인 + 미션 고정 보상이었다(수확은 v2 throttle로 0.14%).
--       GP 소각처는 측정 루프에 0. → 파우셋을 낮춰 인플레 압력 완화.
--
-- 이 마이그레이션은 settings 값만 조정한다(코드의 하드코딩 보상
-- DEFAULT_DAY_REWARDS / MISSION_POOL 하향은 server/services/daily.js에서 별도 처리).
--
-- 주의: 이 DB의 settings.key 에는 단독 UNIQUE 제약이 없고 일부 키는 중복 행이
-- 존재한다(예: streak_30_gp). 따라서 ON CONFLICT 대신 UPDATE(중복 행 전부 갱신)
-- + 없을 때만 INSERT 패턴을 쓴다.
-- ============================================================

-- 1) 기존 행(중복 포함) 값 갱신
UPDATE settings SET value = '25'  WHERE key = 'daily_mission_bonus_gp';
UPDATE settings SET value = '100' WHERE key = 'streak_7_gp';
UPDATE settings SET value = '300' WHERE key = 'streak_14_gp';
UPDATE settings SET value = '600' WHERE key = 'streak_30_gp';

-- 2) 프로덕션에 키가 아예 없는 경우에만 1행 삽입
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'daily_mission_bonus_gp', '25', '일일 미션 전부완료 보너스 GP (50->25)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='daily_mission_bonus_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_7_gp', '100', '7일 연속 출석 마일스톤 GP (200->100)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_7_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_14_gp', '300', '14일 연속 출석 마일스톤 GP (500->300)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_14_gp');
INSERT INTO settings (category, key, value, description)
  SELECT 'economy', 'streak_30_gp', '600', '30일 연속 출석 마일스톤 GP (1000->600)'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='streak_30_gp');

INSERT INTO schema_migrations (filename) VALUES ('293_economy_faucet_tuning.sql') ON CONFLICT DO NOTHING;

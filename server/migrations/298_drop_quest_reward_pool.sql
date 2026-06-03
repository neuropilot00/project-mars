-- ============================================================
-- Migration 298: quest_reward_pool 폐지 (v7.354)
--
-- 배경: quest_reward_pool은 "퀘스트 상금 풀"이 아니라 게임플레이 PP 보상의
--   발행 throttle 이었다(채굴/클레임/퀘스트/미션/탐험/로켓 보상이 이 풀에서
--   PP를 빼서 GP로 환산 지급, 풀 비면 GP 폴백/429). PP는 상환가능(redeemable)
--   이라 무제한 발행 시 페그 위험 → 풀로 발행량을 제어했던 것.
--
-- 결정(사용자): 게임플레이 보상은 GP로 직접 지급, PP는 충전(deposit) 전용으로
--   분리. 따라서 풀 throttle 불필요 → 코드에서 풀 의존 전부 제거(8개 소비/적립
--   지점 + admin 엔드포인트 스텁). 이 마이그레이션은 테이블과 풀 전용 설정 제거.
--
-- 유지: tier 하드캡(quest_max_reward_*, quest_max_daily_per_user, quest_min_gp_*)
--   은 남용 방지용으로 코드에서 계속 사용하므로 보존한다.
-- ============================================================

DROP TABLE IF EXISTS quest_reward_pool CASCADE;

DELETE FROM settings WHERE key IN (
  'quest_pool_fee_rate',
  'quest_pool_min_balance',
  'quest_daily_budget',
  'quest_reward_multiplier_min',
  'quest_reward_multiplier_max'
);

INSERT INTO schema_migrations (filename) VALUES ('298_drop_quest_reward_pool.sql') ON CONFLICT DO NOTHING;

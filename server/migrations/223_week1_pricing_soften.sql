-- Migration 223: Week-1 pricing soften for pre-open onboarding
-- 목적:
-- 1) season pass premium GP 비용을 주차 1 도달 가능 구간으로 완화
-- 2) 첫 territory 진입용 기본 PP 가격을 소폭 완화

UPDATE settings
SET value = '150'
WHERE key = 'season_pass_premium_cost_gp';

UPDATE settings
SET value = '0.08'
WHERE key = 'land_base_price_pp';

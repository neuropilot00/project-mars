-- Migration 224: Week-1 funnel GP bundle
-- 목적:
-- 1) 온보딩 완료 GP 보상을 소폭 상향해 첫 spend 여유를 늘린다
-- 2) 7일 로그인 GP 총합은 유지하면서 Day1~3 보상을 앞당겨 초반 체감을 높인다

UPDATE settings
SET value = '75'
WHERE key = 'onboarding_gp_reward';

UPDATE settings
SET value = '[8, 12, 16, 20, 22, 25, 40]'
WHERE key = 'daily_login_gp_rewards';

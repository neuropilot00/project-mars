-- Migration 220: Economy Balance Adjustment (Global + SEA users, 1 PP = $1)
-- 목적: 동남아 포함 글로벌 유저가 부담 없이 과금할 수 있는 경제 밸런스
-- 참고: 1 PP = $1, 동남아 평균 게임 소비 $1-5/월, 글로벌 캐주얼 $5-20/월

-- 1. 온보딩 보상: $100 무료 → $0.5 (현실적 welcome gift)
UPDATE settings SET value = '0.5'  WHERE key = 'onboarding_pp_reward';
UPDATE settings SET value = '50'   WHERE key = 'onboarding_gp_reward';

-- 2. Chronicle 최소 비용: $300-500 → $3-5 (참여 문턱 낮춤)
UPDATE settings SET value = '5'   WHERE key = 'chronicle_hijack_min_pp';
UPDATE settings SET value = '3'   WHERE key = 'chronicle_storm_min_pp';

-- 3. PP 직접 소비 항목 조정 (SEA 친화적)
UPDATE settings SET value = '0.2' WHERE key = 'exploration_fee_pp';       -- $1 → $0.2
UPDATE settings SET value = '0.2' WHERE key = 'loot_priority_cost_pp';    -- $0.3 → $0.2
UPDATE settings SET value = '0.1' WHERE key = 'poi_hint_cost_pp';         -- $0.2 → $0.1
UPDATE settings SET value = '0.2' WHERE key = 'instant_harvest_cost_pp';  -- $0.5 → $0.2
UPDATE settings SET value = '0.5' WHERE key = 'cosmetic_equip_fee_pp';    -- $2 → $0.5

-- 4. PP 일일 획득 한도 (무제한 farm 방지)
UPDATE settings SET value = '0.3' WHERE key = 'pp_daily_earn_cap_per_user';

-- 5. 데일리 로그인 보상 (7일차 PP 소폭 상향)
UPDATE settings SET value = '[0, 0, 0, 0, 0, 0, 0.1]'     WHERE key = 'daily_login_pp_rewards';
UPDATE settings SET value = '[5, 8, 12, 16, 22, 30, 50]'   WHERE key = 'daily_login_gp_rewards';

-- 6. PP→GP 교환률 개선: 1PP=4GP → 1PP=10GP (GP 접근성 향상)
UPDATE settings SET value = '10' WHERE key = 'pp_to_gp_exchange_rate';
UPDATE settings SET value = '5'  WHERE key = 'pp_to_gp_exchange_max';     -- 일일 한도 10→5 PP

-- 7. 기본 프리깃 GP 비용 절반 (신규 유저 진입 장벽 낮춤)
UPDATE ship_types SET build_gp_cost = 20 WHERE code = 'cv_int';
UPDATE ship_types SET build_gp_cost = 25 WHERE code = 'mcc_int';
UPDATE ship_types SET build_gp_cost = 35 WHERE code = 'fsp_int';
UPDATE ship_types SET build_gp_cost = 50 WHERE code = 'cv_frg';
UPDATE ship_types SET build_gp_cost = 60 WHERE code = 'mcc_frg';

-- 8. 기타 GP 비용 소폭 조정
UPDATE settings SET value = '5'   WHERE key = 'marketplace_listing_fee_gp';  -- 10 → 5
UPDATE settings SET value = '15'  WHERE key = 'expedition_base_cost_gp';     -- 30 → 15
UPDATE settings SET value = '100' WHERE key = 'monument_cost_base';          -- 150 → 100

INSERT INTO schema_migrations (filename) VALUES ('220_economy_balance_sea.sql') ON CONFLICT DO NOTHING;

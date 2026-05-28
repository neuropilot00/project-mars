-- 245_ship_crate_expansion.sql
-- 가챠 상자 3종 → 5종 확장 + 일일 무료 상자(데일리 리텐션 후크).
-- · recruit_crate : 무료, 1일 1회, frigate 위주(EVE의 무료 루키십 = 신규/복귀 유도). 함선 공급 통제 위해 daily_limit 강제.
-- · elite_crate   : 2000 GP, premium(1000)~legendary(3000) 가격 갭 메움. 순양함/전함 위주 = 순수 GP 싱크.
-- daily_limit > 0 이면 지갑×상자별 당일 개봉 횟수를 제한(서버 권위). 0=무제한(기존 동작).

ALTER TABLE ship_crate_types ADD COLUMN IF NOT EXISTS daily_limit INTEGER NOT NULL DEFAULT 0;

INSERT INTO ship_crate_types (code, label_ko, label_en, price_gp, rarity_weights, pity_pulls, daily_limit, sort_order) VALUES
  ('recruit_crate', '신병 보급 상자', 'Recruit Crate', 0,
    '{"frigate":88,"destroyer":12}'::jsonb, 0, 1, 0),
  ('elite_crate',   '엘리트 상자',    'Elite Crate',   2000,
    '{"destroyer":18,"cruiser":52,"battleship":28,"titan":2}'::jsonb, 7, 0, 25)
ON CONFLICT (code) DO NOTHING;

-- 정렬 재배치: recruit(0) → standard(10) → premium(20) → elite(25) → legendary(30)
UPDATE ship_crate_types SET sort_order = 10 WHERE code = 'standard_crate';
UPDATE ship_crate_types SET sort_order = 20 WHERE code = 'premium_crate';
UPDATE ship_crate_types SET sort_order = 30 WHERE code = 'legendary_crate';

INSERT INTO schema_migrations (filename) VALUES ('245_ship_crate_expansion.sql') ON CONFLICT DO NOTHING;

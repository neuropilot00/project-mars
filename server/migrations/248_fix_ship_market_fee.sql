-- 248_fix_ship_market_fee.sql
-- HOTFIX: ship_market_fee_pct 가 0.05 (분수 표기)로 들어가 있어 실효 수수료가
-- 의도(5%)의 1/100인 0.05% 가 적용되던 버그. 코드는 `floor(price * pct / 100)`로
-- 0~100 퍼센트 스케일을 기대한다. 강제 UPDATE 로 영속 복원.
UPDATE settings SET value = '5' WHERE key = 'ship_market_fee_pct' AND value::text IN ('0.05','"0.05"','0.5');

INSERT INTO schema_migrations (filename) VALUES ('248_fix_ship_market_fee.sql') ON CONFLICT DO NOTHING;

-- 278_ship_mining_redteam_fixes.sql
-- 레드팀 검증 후속: 죽은 설정 제거 + v2 튜닝값 강제 적용(기존 행 UPDATE).
DELETE FROM settings WHERE key = 'ship_mining_gp_per_ship_h';  -- 미사용(코드는 gp_per_capacity_h 사용)
UPDATE settings SET value = '{"frigate":1,"destroyer":2,"cruiser":4,"battleship":14,"titan":60}' WHERE key = 'ship_mining_capacity_weights';
UPDATE settings SET value = '3' WHERE key = 'ship_mining_gp_per_capacity_h';
INSERT INTO settings (category,key,value,description) VALUES
 ('mining','ship_mining_gp_cap_per_day','1500','지갑당 채굴 GP 일일 상한(레드팀 #1).'),
 ('mining','ship_mining_min_hp_pct','0.15','채굴 가능 최소 내구도 비율(repair sink 게이트).')
ON CONFLICT (key) DO NOTHING;
INSERT INTO schema_migrations (filename) VALUES ('278_ship_mining_redteam_fixes.sql') ON CONFLICT DO NOTHING;

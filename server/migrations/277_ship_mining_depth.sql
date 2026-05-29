-- 277_ship_mining_depth.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 P5 — 함선 채굴 깊이 추가. "어느 함선을, 어디로, 어떻게" 의사결정.
--   ① 함급별 채굴 적재량(capacity)으로 수율 결정(함종/등급 반영) ② 목적지 거리(frontier/mid/core)별
--   드롭테이블·수율·마모·약탈위험 차등. 멀수록 희귀재료+고수율이나 마모↑+위험↑.
-- ════════════════════════════════════════════════════════════════

-- 채굴 적재량 스냅샷(출항 시 함대 구성 기반 계산값) 보관.
ALTER TABLE ship_mining_jobs ADD COLUMN IF NOT EXISTS capacity NUMERIC NOT NULL DEFAULT 0;

INSERT INTO settings (category, key, value, description) VALUES
  ('mining', 'ship_mining_capacity_weights',
   '{"frigate":1,"destroyer":2,"cruiser":4,"battleship":14,"titan":60}',
   '함급별 채굴 적재량(capacity). HP 비례(레드팀 보정 — 대형함 수리비 적자 역설 제거). 수율 = 함대 총 capacity 기반.'),
  ('mining', 'ship_mining_tier_bonus_per_level', '0.1',
   '함선 등급(tier) 1단계당 capacity 보너스(0.1=+10%/단계).'),
  ('mining', 'ship_mining_gp_per_capacity_h', '3',
   'GP 수율 = 함대 총 capacity × 시간 × 이 값. (레드팀: GP→PP 우회 인플레 차단 위해 5→3).'),
  ('mining', 'ship_mining_gp_cap_per_day', '1500',
   '지갑당 채굴 GP 일일 상한(24h 합산). 무료 채굴 GP 무한 양산 차단(레드팀 #1).'),
  ('mining', 'ship_mining_min_hp_pct', '0.15',
   '채굴 출항 가능 최소 함선 내구도(최대HP 대비). 이하면 조선소 수리 필요(repair sink 게이트).'),
  ('mining', 'ship_mining_destinations',
   '[{"key":"frontier","yieldMult":1.0,"wearMult":1.0,"raidPct":0.0},{"key":"mid","yieldMult":1.5,"wearMult":1.5,"raidPct":0.05},{"key":"core","yieldMult":2.2,"wearMult":2.5,"raidPct":0.15}]',
   '채굴 목적지(거리)별 수율/마모/약탈위험 배율. key는 드롭 테이블(sector_type)과 일치.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('277_ship_mining_depth.sql')
ON CONFLICT DO NOTHING;

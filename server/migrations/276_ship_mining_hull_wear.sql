-- 276_ship_mining_hull_wear.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 P5 — 함선 채굴 내구도 마모 (EVE식 sink). 채굴 런 복귀 시 함대 함선 HP가 닳는다.
--   닳은 함선은 조선소에서 수리(GP + 재료)해야 다시 채굴 가능 → GP/재료 sink 루프 형성.
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('mining', 'ship_mining_hull_wear_pct_per_hour', '0.02',
   '채굴 런 시간당 함선 내구도(HP) 마모율(최대HP 대비). 예 0.02=2%/h → 8h 런이 max_hp의 16% 마모. 닳으면 수리(GP sink) 필요.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('276_ship_mining_hull_wear.sql')
ON CONFLICT DO NOTHING;

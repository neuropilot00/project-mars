-- [v7.209] 영토 업그레이드 트랙 상한 4 → 5.
-- P5 카탈로그가 5 트랙(extractor/refinery/shield_grid/relay_tower/art_beacon)인데
-- 상한이 4면 마지막 1개 트랙은 영구 잠김. UI 에는 5개 다 보이는데 5번째 클릭 시 에러.
-- 5 로 올려 모든 트랙 풀 강화 허용.

UPDATE settings SET value = '5' WHERE key = 'upgrade_max_per_claim';

-- 누락 환경 대비 upsert
INSERT INTO settings (category, key, value, description) VALUES
  ('upgrade', 'upgrade_max_per_claim', '5', '영토 1개당 동시 보유 가능한 업그레이드 트랙 수 (P5 카탈로그 5트랙 전부 허용)')
ON CONFLICT (key) DO UPDATE SET value = '5';

INSERT INTO schema_migrations (filename) VALUES ('255_upgrade_max_per_claim_5.sql') ON CONFLICT DO NOTHING;

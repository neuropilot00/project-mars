-- 262_sector_governance_unique.sql
-- ════════════════════════════════════════════════════════════════
-- 레드팀 후속: sector_governance.sector_id ↔ sectors.id 1:1 을 DB 레벨에서 강제.
--   collectTax 가 sector_id 로 길드 거버너를 조회하므로 중복 매핑 시 세수 라우팅 모호.
--   mig 260 backfill 은 1:1 이지만 제약이 없었음 → 부분 UNIQUE 로 보강.
-- ════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sector_gov_sector_id
  ON sector_governance(sector_id) WHERE sector_id IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('262_sector_governance_unique.sql')
ON CONFLICT DO NOTHING;

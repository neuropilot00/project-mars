-- Migration 214: 영토별 개별 수확 지원
-- claims 테이블에 last_harvest_at 컬럼 추가
-- 기존 /api/harvest (wallet 전체 일괄) 와 병행 가능

ALTER TABLE claims ADD COLUMN IF NOT EXISTS last_harvest_at TIMESTAMPTZ;

-- 인덱스 (쿨다운 체크 최적화)
CREATE INDEX IF NOT EXISTS idx_claims_last_harvest_at ON claims(last_harvest_at)
  WHERE last_harvest_at IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('214_per_territory_harvest.sql') ON CONFLICT DO NOTHING;

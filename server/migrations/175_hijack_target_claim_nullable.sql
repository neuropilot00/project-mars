-- Migration 175: hijack_battles.target_claim_id NULL 허용
-- declare-with-pp 흐름은 새 claim 생성 + 적 픽셀 일부 탈취 형태라
-- 단일 target claim이 없는 경우가 일반적. 코드가 -1을 박아 FK 위반 발생.

ALTER TABLE hijack_battles
  ALTER COLUMN target_claim_id DROP NOT NULL;

-- 기존 -1 값은 NULL로 정리 (FK 위반 데이터 정리)
UPDATE hijack_battles SET target_claim_id = NULL WHERE target_claim_id = -1;

INSERT INTO schema_migrations (filename) VALUES ('175_hijack_target_claim_nullable.sql')
ON CONFLICT DO NOTHING;

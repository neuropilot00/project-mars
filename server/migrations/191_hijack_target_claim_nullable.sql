-- Migration 191: hijack_battles.target_claim_id NULL 허용 (migration 175 재적용)
-- declare-with-pp 흐름에서 적 픽셀만 공격 시 newClaimId=null → NOT NULL 위반 500 에러
-- production DB에 175가 미적용 상태임을 확인, 191로 재등록

ALTER TABLE hijack_battles
  ALTER COLUMN target_claim_id DROP NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('191_hijack_target_claim_nullable.sql')
ON CONFLICT DO NOTHING;

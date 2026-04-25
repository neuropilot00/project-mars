-- ═══════════════════════════════════════════════════
-- 184: users.avatar_color + users.motto 컬럼 추가
-- ═══════════════════════════════════════════════════
-- services/profile.js가 두 컬럼을 SELECT/UPDATE하지만 실제 users 테이블에는 없음.
-- 결과: /api/profile 호출 시 "column avatar_color does not exist" 500 에러.
-- 두 컬럼 추가로 프로필 변경/조회 정상 동작.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7) DEFAULT '#FF6644';
ALTER TABLE users ADD COLUMN IF NOT EXISTS motto VARCHAR(80);

INSERT INTO schema_migrations (filename) VALUES ('184_user_profile_columns.sql')
ON CONFLICT DO NOTHING;

COMMIT;

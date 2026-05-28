-- 252_email_verification.sql
-- A-C3: 이메일 인증 시스템 — 가입 시 SMTP 6자리 코드 발송 → 검증 후 email_verified=true.
-- 일부 sensitive action(USDT 출금 등)은 향후 verified 필수로 게이팅 가능(이 마이그레이션은 컬럼 + endpoint 인프라만).

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

-- 기존 사용자는 grandfather — 인증 필수 기능 도입 시 점진 적용(즉시 차단 X).
-- 새 가입자만 unverified 로 시작하도록 가입 흐름에서 false 명시.

CREATE INDEX IF NOT EXISTS idx_users_email_unverified ON users(email_verified) WHERE email_verified = FALSE;

INSERT INTO settings (category, key, value, description) VALUES
  ('auth', 'email_verification_enabled', 'true', '신규 가입 시 이메일 인증 코드 발송 활성화(SMTP 설정 필요)'),
  ('auth', 'email_verification_ttl_minutes', '15', '인증 코드 유효 시간(분)'),
  ('auth', 'email_verification_resend_cooldown_sec', '60', '재발송 쿨다운(초)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('252_email_verification.sql') ON CONFLICT DO NOTHING;

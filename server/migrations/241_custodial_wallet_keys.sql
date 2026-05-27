-- Migration 241: 자동 커스터디 지갑 — 실제 키페어 생성/암호화 저장 + 키 노출 면책
-- ───────────────────────────────────────────────────────────────────────────
-- 모델: 가입 시 서버가 진짜 EOA 키페어 생성 → 개인키를 AES-256-GCM 암호화(서버 마스터키
--       WALLET_ENCRYPTION_KEY)하여 저장. 유저는 본인 키를 1회 열람 가능(분실 시 운영자 책임 없음 — 면책 고지).
--       이로써 입금주소=유저 EOA, 출금은 서버가 키로 자동 처리(phase 2 relayer) 가능.
-- ⚠️ WALLET_ENCRYPTION_KEY 미설정 시 키 생성/저장 안 함(평문 저장 절대 금지) → 기존 placeholder 주소 유지.
-- 기존 유저(placeholder 주소, 키 없음)는 영향 없음. 신규 가입부터 실키 적용.

ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_privkey TEXT;          -- iv:tag:ciphertext (hex)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_type VARCHAR(20) NOT NULL DEFAULT 'placeholder'; -- 'placeholder' | 'custodial'
ALTER TABLE users ADD COLUMN IF NOT EXISTS key_revealed_at TIMESTAMPTZ;     -- 마지막 키 열람 시각(감사)
ALTER TABLE users ADD COLUMN IF NOT EXISTS key_reveal_count INT NOT NULL DEFAULT 0;

INSERT INTO settings (category, key, value, description) VALUES
  ('wallet', 'custodial_wallet_enabled', 'false', '가입 시 자동 커스터디 실키 지갑 생성(WALLET_ENCRYPTION_KEY 필요). 기본 OFF — 키 설정 후 켬')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('241_custodial_wallet_keys.sql') ON CONFLICT DO NOTHING;

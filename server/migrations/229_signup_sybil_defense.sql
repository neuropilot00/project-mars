-- Migration 229: Sybil defense — signup IP/device 추적 + per-IP 일일 가입 캡
-- 목적: 이메일+비밀번호 커스터디얼 가입(온체인 서명 없음)이라 다계정(시빌) 생성이 쉬움.
--       한 IP에서 대량 계정 생성 → signup PP 보너스 + 추천 보너스 파밍을 차단한다.
-- 참고: trust proxy=1 이므로 req.ip 는 실제 클라이언트 IP. 공유 IP(회사/모바일) 오탐을
--       줄이기 위해 캡은 보수적으로 시작(기본 8/일)하고 admin 에서 조정 가능하게 둔다.

CREATE TABLE IF NOT EXISTS account_signups (
  id            BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  email         TEXT,
  signup_ip     TEXT,
  user_agent    TEXT,
  referred_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_signups_ip_time ON account_signups (signup_ip, created_at);
CREATE INDEX IF NOT EXISTS idx_account_signups_wallet  ON account_signups (wallet_address);

-- 설정값: PK 는 key 단독, value 는 JSONB.
INSERT INTO settings (category, key, value, description) VALUES
  ('security', 'signup_max_per_ip_per_day', '8',    'IP당 24시간 최대 가입 수 (0=무제한)'),
  ('security', 'referral_self_ip_block',     'true', '같은 IP에서 가입한 피추천인에게는 양면 추천 보너스 미지급(셀프추천 차단)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('229_signup_sybil_defense.sql') ON CONFLICT DO NOTHING;

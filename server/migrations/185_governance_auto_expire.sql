-- ═══════════════════════════════════════════════════
-- 185: Governance auto-expire settings + index
-- ═══════════════════════════════════════════════════
-- governor/commander 가 비활성/탈퇴 시 자동 자리 비우기.
-- admin 이 매번 수동 클리어할 수 없는 문제 해결 (사용자 신고).
--
-- 사용 시나리오:
--   1) governor 가 N일 동안 로그인 안 함 → 자리 비움 + announcement NULL
--   2) governor wallet 이 users 테이블에 없음 (탈퇴) → 자리 비움
--   3) governor 가 임기를 초과 (term_days > 0) → 자리 비움 (옵션)

INSERT INTO settings (category, key, value, description) VALUES
  ('governance', 'governance_auto_expire_enabled', 'true',
    '거버너/사령관 자동 만료 활성화'),
  ('governance', 'governor_inactive_days', '14',
    '거버너가 N일 동안 로그인 안 하면 자동 자리 비움 (0=비활성)'),
  ('governance', 'commander_inactive_days', '14',
    '사령관이 N일 동안 로그인 안 하면 자동 자리 비움 (0=비활성)'),
  ('governance', 'governor_max_term_days', '0',
    '거버너 최대 임기 일수, 0=무제한 (선택 — siege 가 일반적인 교체 메커니즘)'),
  ('governance', 'commander_max_term_days', '0',
    '사령관 최대 임기 일수, 0=무제한')
ON CONFLICT (key) DO NOTHING;

-- last_login_at 인덱스 (스케줄러 쿼리 빠르게)
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at) WHERE last_login_at IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('185_governance_auto_expire.sql')
ON CONFLICT DO NOTHING;

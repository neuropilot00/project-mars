-- Migration 242: 신규 유저 hijack 면역 (상용화 stop-ship) — full-loss ON 상태에서 고인물의 신규 학살 방지
-- ───────────────────────────────────────────────────────────────────────────
-- 가입 N일 미만 또는 레벨 N 미만 수비자는 hijack 대상에서 제외. 설정으로 조정/해제 가능.
-- (full-loss 영구파괴가 켜진 상태에서 신규 보호 없이 오픈하면 신규 이탈 직결 — 게임성 검수 지적)

INSERT INTO settings (category, key, value, description) VALUES
  ('pvp', 'hijack_newbie_protection_enabled',   'true', '신규 유저 hijack 면역 활성화'),
  ('pvp', 'hijack_newbie_protection_days',      '3',    '가입 후 이 일수 미만 수비자는 hijack 불가(0=미적용)'),
  ('pvp', 'hijack_newbie_protection_max_level', '5',    '이 레벨 미만 수비자는 hijack 불가(0=미적용)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('242_hijack_newbie_protection.sql') ON CONFLICT DO NOTHING;

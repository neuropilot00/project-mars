-- 269_commander_siege_schedule.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 커맨더 공성 자동 주기(월 1회 고정 슬롯) + 임기/무도전 강등.
--   레드팀 권고: 도전 0명 영구 유임 방지. 매월 dom일 hour시(UTC) 슬롯에 자동 declareCommanderSiege,
--   도전자(sov 2위, 최소섹터) 있으면 결전 개최 / 없으면 무도전 streak++ → N회 연속 시 맹주 vacant 강등(sov 파생 폴백).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE mars_commander ADD COLUMN IF NOT EXISTS no_challenge_streak INT DEFAULT 0;
ALTER TABLE mars_commander ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE mars_commander ADD COLUMN IF NOT EXISTS term_ends_at TIMESTAMPTZ;

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'commander_siege_auto_enabled', 'true', '커맨더 공성 월간 자동 개최'),
  ('siege', 'commander_siege_dom', '1', '커맨더 공성 자동 개최 일(매월 N일, UTC)'),
  ('siege', 'commander_siege_hour_utc', '12', '커맨더 공성 자동 개최 시(UTC)'),
  ('siege', 'commander_vacate_after_no_challenge', '3', '연속 무도전 N회 시 맹주 자리 비움(sov 파생 폴백)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('269_commander_siege_schedule.sql')
ON CONFLICT DO NOTHING;

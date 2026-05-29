-- 266_siege_schedule.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 주간 공성 캘린더: 공성 결전(siege_starts_at)을 고정 요일/시각 슬롯으로 스냅.
--   관전 집중 + 무분별 공성 방지(리니지 공성 시간표). siege_schedule_enabled=false 면 기존 now+warning_hours.
--   dows: UTC 요일 0(일)~6(토) 콤마 목록. hour_utc: 결전 시작 UTC 시. min_notice_hours: 최소 예고.
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_schedule_enabled', 'true', '공성 결전을 고정 주간 슬롯으로 스냅'),
  ('siege', 'siege_schedule_dows', '"3,6"', '결전 요일(UTC 0=일~6=토) 콤마 목록 — 기본 수/토'),
  ('siege', 'siege_schedule_hour_utc', '12', '결전 시작 UTC 시 (예: 12 = 한국 21시)'),
  ('siege', 'siege_schedule_min_notice_hours', '6', '선언~결전 최소 예고 시간(시)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('266_siege_schedule.sql')
ON CONFLICT DO NOTHING;

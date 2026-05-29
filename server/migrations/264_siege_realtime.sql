-- 264_siege_realtime.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 실시간 권위 전투(라이브 틱 루프 + 다유저 동시 명령) 설정.
--   siege_realtime_enabled=true 면 siege 전투를 simulateBattleLive(라이브)로 실행.
--   false(기본 아님 — 유저 부재라 ON)면 기존 precompute→stream 경로.
--   tick_ms: 라이브 틱 간격(체감 속도). wallclock_min: 라이브 전투 최대 분(hang 방지).
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_realtime_enabled', 'true', 'siege 전투를 실시간 권위 틱 루프(다유저 동시 명령)로 실행'),
  ('siege', 'siege_realtime_tick_ms', '250', '라이브 틱 간격(ms) — 체감 속도/부하 균형'),
  ('siege', 'siege_realtime_wallclock_min', '10', '라이브 전투 최대 진행 시간(분) — hang 방지'),
  ('siege', 'siege_cmd_rate_per_sec', '3', '참가자 1인당 초당 명령 수 상한(어뷰징 방지)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('264_siege_realtime.sql')
ON CONFLICT DO NOTHING;

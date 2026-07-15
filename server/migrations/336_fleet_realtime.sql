-- 336_fleet_realtime.sql
-- 실시간 전투를 siege 전용에서 일반(비-siege) 전투로 확장 — 라이브 실행 게이트/틱/월클럭 설정 시드.
--   siege 는 기존 siege_realtime_enabled / siege_realtime_tick_ms / siege_realtime_wallclock_min
--   게이트를 그대로 유지하며 이 설정의 영향을 받지 않는다.
--
--   fleet_realtime_mode:
--     "off" = 현행. 모든 비-siege 전투는 precompute → 리플레이 스트림.
--     "ai"  = 기본. AI 연습전(battle_summary.is_ai_battle=true)만 라이브 틱 루프로 실행.
--             (NPC↔NPC 아레나 전투는 지휘자/시청자가 없어 라이브에서 제외 — 스케줄러 판단.)
--     "all" = 비-siege 전부 라이브(PvP/하이잭 포함 — 오너가 명시적으로 켜는 토글).
--
--   적용: server/services/battleScheduler.js#runBattle 라이브 게이트.
--   기본값 "ai" 라 PvP/하이잭 경제 흐름은 현행과 동일하고, AI 연습전만 라이브로 바뀐다.

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'fleet_realtime_mode', '"ai"',
     '일반(비-siege) 전투 실시간 모드: off(precompute 리플레이=현행) | ai(AI 연습전만 라이브, 기본) | all(PvP/하이잭 포함 전부 라이브 — 오너 토글)'),
  ('fleet', 'fleet_realtime_tick_ms', '120',
     '일반 전투 라이브 틱 간격(ms) — siege 는 siege_realtime_tick_ms 를 따름'),
  ('fleet', 'fleet_realtime_wallclock_min', '6',
     '일반 전투 라이브 wall-clock 상한(분) — 초과 시 draw 종료. siege 는 siege_realtime_wallclock_min 을 따름')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key IN ('fleet_realtime_mode','fleet_realtime_tick_ms','fleet_realtime_wallclock_min');
--   DELETE FROM schema_migrations WHERE filename = '336_fleet_realtime.sql';
-- ============================================================

INSERT INTO schema_migrations (filename) VALUES ('336_fleet_realtime.sql') ON CONFLICT DO NOTHING;

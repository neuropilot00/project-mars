-- 290_enable_void_raider_autospawn.sql
-- 월드 이벤트(Void Raider)가 어드민 수동 없이 주기적으로 자동 등장하도록 활성화. [v7.318]
-- 빈도는 기존 설정 유지(기본 3일마다 19 UTC 1회) — 스팸 방지.
-- 유저가 "월드 이벤트를 못 찾겠다"고 한 이유: enabled/auto_spawn 이 false라 한 번도 안 떴기 때문.

INSERT INTO settings (category, key, value, description) VALUES
  ('world_events', 'void_raider_enabled',   'true', 'Void Raider 월드 이벤트 활성화'),
  ('world_events', 'void_raider_auto_spawn', 'true', 'Void Raider 자동 스폰(스케줄러)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO schema_migrations (filename) VALUES ('290_enable_void_raider_autospawn.sql') ON CONFLICT DO NOTHING;

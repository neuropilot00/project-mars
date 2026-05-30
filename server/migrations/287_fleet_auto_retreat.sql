-- 287_fleet_auto_retreat.sql
-- 자동 퇴각: 함대 HP가 임계% 이하로 떨어지면 자동 후퇴(함선 보존). 0=비활성.
ALTER TABLE fleets ADD COLUMN IF NOT EXISTS auto_retreat_pct SMALLINT NOT NULL DEFAULT 0;
INSERT INTO schema_migrations (filename) VALUES ('287_fleet_auto_retreat.sql') ON CONFLICT DO NOTHING;

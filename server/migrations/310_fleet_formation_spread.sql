-- ============================================================
-- Migration 310: 진형 밀집도(formation_spread) — 진형 커스터마이징
--
-- 같은 진형도 밀집(0.75)↔표준(1.0)↔분산(1.3)으로 좌우/링 간격을 조절.
-- 미리보기 기하(fleetPreviewPoint)에 곱해진다. 0.55~1.6 클램프(서버 updateFleet).
-- ============================================================

ALTER TABLE fleets ADD COLUMN IF NOT EXISTS formation_spread NUMERIC DEFAULT 1.0;

INSERT INTO schema_migrations (filename) VALUES ('310_fleet_formation_spread.sql') ON CONFLICT DO NOTHING;

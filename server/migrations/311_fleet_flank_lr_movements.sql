-- ============================================================
-- Migration 311: 기동 좌현/우현 분리 (전후좌우)
--
-- 기존 단일 'flank'(측면 우회)를 좌현(flank_left)/우현(flank_right)으로 분리해 전후좌우 기동을
-- 제공. 기존 'flank' 데이터는 flank_right로 이전. CHECK는 legacy 'flank'도 허용(안전).
-- 전투는 위치/속도만 영향 — 스탯 밸런스 무영향.
-- ============================================================

UPDATE fleets SET movement = 'flank_right' WHERE movement = 'flank';

ALTER TABLE fleets DROP CONSTRAINT IF EXISTS fleets_movement_check;
ALTER TABLE fleets ADD CONSTRAINT fleets_movement_check
  CHECK (movement::text = ANY (ARRAY[
    'advance','retreat','flank','flank_left','flank_right','scatter','rally'
  ]::text[]));

INSERT INTO schema_migrations (filename) VALUES ('311_fleet_flank_lr_movements.sql') ON CONFLICT DO NOTHING;

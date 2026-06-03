-- ============================================================
-- Migration 309: 신규 진형 3종 허용 (line/echelon/vanguard)
--
-- 진형 리서치 재설계(v7.381~382)로 전열 횡대/사다리꼴/호위 방진을 추가. 기존
-- fleets_formation_check CHECK가 옛 4종만 허용해 신규 진형 변경이 500나던 것을 해소.
-- 진형은 전투에서 위치 배치(slotX/Y)만 담당 — 스탯 밸런스 무영향.
-- ============================================================

ALTER TABLE fleets DROP CONSTRAINT IF EXISTS fleets_formation_check;
ALTER TABLE fleets ADD CONSTRAINT fleets_formation_check
  CHECK (formation::text = ANY (ARRAY[
    'sphere','wedge','screen','pincer','line','echelon','vanguard'
  ]::text[]));

INSERT INTO schema_migrations (filename) VALUES ('309_fleet_new_formations.sql') ON CONFLICT DO NOTHING;

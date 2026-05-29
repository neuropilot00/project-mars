-- 260_geo_governor_bridge.sql
-- ════════════════════════════════════════════════════════════════
-- (A) 지오 섹터 정본 통합 — 공성 결과를 라이브 세금 시스템(sectors)에 반영하는 브리지.
--   설계: docs/GUILD_TERRITORY_WAR_DESIGN_2026-05-29.md §13.1 (이원 거버넌스 단일화)
--   근본원인: sector_governance(code, 공성)와 sectors(id, 픽셀/세금)가 분리된 우주.
--   해결: sector_governance.sector_id 로 sectors.id 와 1:1 연결(positional, 둘 다 1..24 검증됨).
--         공성 승리 시 sectors/governance_positions(정본 세금 경로)도 동기화 → 세수가 승자에게.
--   안전: siege_governor_canonical_enabled 기본 false → 켜기 전까지 sectors/세금 경로 무변경.
--         sectors.siege_governor_locked 가 true 인 섹터만 픽셀 자동 거버너 재산정에서 제외.
-- ════════════════════════════════════════════════════════════════

-- sector_governance(코드) → sectors(지오 id) 연결 컬럼
ALTER TABLE sector_governance ADD COLUMN IF NOT EXISTS sector_id INT;
-- sectors: 공성 거버너가 설치되면 픽셀 자동 재산정이 덮어쓰지 못하게 잠금
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS siege_governor_locked BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sector_gov_sectorid ON sector_governance(sector_id) WHERE sector_id IS NOT NULL;

-- Backfill: sector_governance.sector_code → sector_definitions.id (= 유효 sectors.id)
-- sector_definitions.id 와 sectors.id 가 동일 범위(1..24)이며 def_without_sector=0 임을 검증함.
UPDATE sector_governance sg
   SET sector_id = sd.id
  FROM sector_definitions sd
 WHERE sd.code = sg.sector_code
   AND sg.sector_id IS NULL
   AND EXISTS (SELECT 1 FROM sectors s WHERE s.id = sd.id);

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_governor_canonical_enabled', 'false',
   '공성 승리를 정본 sectors/governance_positions(세금 경로)에 동기화할지. true 면 공성 거버너가 실제 세수를 받고 픽셀 재산정이 덮어쓰지 않음. false 면 기존(공성=sector_governance 만).')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('260_geo_governor_bridge.sql')
ON CONFLICT DO NOTHING;

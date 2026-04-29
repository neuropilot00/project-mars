-- ═══════════════════════════════════════════════════════════════
-- Migration 203: Capital ship Core/Mid material requirement gate
-- ═══════════════════════════════════════════════════════════════
-- CLAUDE.md §8 task #1: 타이탄/배틀십에 Core/Mid 전용 재료 요구사항 추가.
--
-- Migration 163 이미 다음 정책을 시드했음:
--   • Frontier-only mats : iron_ore, carbon_fiber, silicon_chip
--   • Mid-only mats      : titanium_alloy, plasma_crystal, nano_polymer
--   • Core-only mats     : exotic_alloy, dark_matter, quantum_core
--   • Battleship recipe  : 2× Mid mats + 1× Core mat (exotic_alloy 2~3)
--   • Titan recipe       : 3× Core mats + 1~2× Mid mats
--
-- 이번 마이그레이션은:
--   1. fsp_titan 의 누락된 2번째 Mid mat (nano_polymer) 추가 → 다른 두 타이탄과 균형
--   2. Battleship의 Core mat (exotic_alloy) 최소 3개로 통일 → 무게감 일치
--   3. 어드민 추적용 설정 키 시드 (capital ship recipe contract 명시)
--   4. 검증 쿼리로 모든 BS/Titan 이 Core+Mid 둘 다 포함하는지 확인 (assertion)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. fsp_titan 균형: nano_polymer 40 추가 ──────────────────
-- 다른 두 Titan은 Mid mat 2종 보유: mcc_titan(titanium_alloy+nano_polymer), cv_titan(titanium_alloy+plasma_crystal)
-- fsp_titan은 plasma_crystal만 보유 → nano_polymer 추가
UPDATE ship_types
SET recipe_minerals = recipe_minerals || '{"nano_polymer": 40}'::jsonb
WHERE code = 'fsp_titan'
  AND NOT (recipe_minerals ? 'nano_polymer');

-- ── 2. Battleship Core mat (exotic_alloy) 최소 3개로 통일 ────
-- fsp_bs만 2개였음 → 3개로 통일
UPDATE ship_types
SET recipe_minerals = jsonb_set(recipe_minerals, '{exotic_alloy}', '3'::jsonb)
WHERE size_class = 'battleship'
  AND (recipe_minerals->>'exotic_alloy')::int < 3;

-- ── 3. 어드민 추적용 설정 시드 ───────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'capital_ship_core_mat_required',
   'true',
   'Battleship/Titan 건조 시 Core 전용 재료(exotic_alloy/dark_matter/quantum_core) 1종 이상 필수 (recipe_minerals 검증)'),
  ('fleet', 'capital_ship_mid_mat_required',
   'true',
   'Battleship/Titan 건조 시 Mid 전용 재료(titanium_alloy/plasma_crystal/nano_polymer) 1종 이상 필수'),
  ('fleet', 'capital_ship_recipe_contract',
   '"battleship: 2 Mid + 1 Core; titan: 2 Mid + 3 Core"',
   'Capital ship recipe 정책 메모 (admin 참고용; ship.js startBuild에서 경고 로깅)'),
  ('fleet', 'core_exclusive_minerals',
   '"exotic_alloy,dark_matter,quantum_core"',
   'Core 섹터 채굴 전용 광물 코드 (sector_resource_rates 동기화 필요)'),
  ('fleet', 'mid_exclusive_minerals',
   '"titanium_alloy,plasma_crystal,nano_polymer"',
   'Mid 섹터 채굴 전용 광물 코드 (sector_resource_rates 동기화 필요)')
ON CONFLICT (key) DO NOTHING;

-- ── 4. 검증 (assertion via DO block) ─────────────────────────
-- 모든 battleship/titan 이 Core+Mid 광물 둘 다 포함하는지 확인
DO $$
DECLARE
  bad_ship_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_ship_count
  FROM ship_types
  WHERE size_class IN ('battleship', 'titan')
    AND (
      -- Core 전용 광물 1종 이상 포함 안 함
      NOT (
        recipe_minerals ? 'exotic_alloy'
        OR recipe_minerals ? 'dark_matter'
        OR recipe_minerals ? 'quantum_core'
      )
      OR
      -- Mid 전용 광물 1종 이상 포함 안 함
      NOT (
        recipe_minerals ? 'titanium_alloy'
        OR recipe_minerals ? 'plasma_crystal'
        OR recipe_minerals ? 'nano_polymer'
      )
    );

  IF bad_ship_count > 0 THEN
    RAISE EXCEPTION 'Migration 203: % battleship/titan(s) missing Core or Mid exclusive material requirement', bad_ship_count;
  END IF;
END $$;

COMMIT;

INSERT INTO schema_migrations (filename) VALUES ('203_capital_ship_core_mid_materials.sql') ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (수동)
-- ═══════════════════════════════════════════════════════════════
-- SELECT code, faction_code, size_class,
--        recipe_minerals ? 'exotic_alloy' OR recipe_minerals ? 'dark_matter' OR recipe_minerals ? 'quantum_core' AS has_core,
--        recipe_minerals ? 'titanium_alloy' OR recipe_minerals ? 'plasma_crystal' OR recipe_minerals ? 'nano_polymer' AS has_mid,
--        recipe_minerals
-- FROM ship_types WHERE size_class IN ('battleship','titan')
-- ORDER BY size_class, faction_code;
-- 기대: 6행 모두 has_core=t AND has_mid=t

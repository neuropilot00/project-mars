-- Migration 164: Mineral Resources Integration
-- 163에서 item_types에만 추가된 9종 광물을 resources 테이블로도 등록
-- → sector_resource_rates에 zone별 드롭 연결
-- → ship.js가 user_resource_inventory(resource_id FK)로 조회 가능하게

-- ── 1. resources 테이블에 9종 광물 추가 ─────────────────────────────────────
INSERT INTO resources (code, name_en, name_ko, rarity, icon_emoji, tier, base_pp_value, is_tradeable, is_active)
VALUES
  -- Frontier tier (tier 1)
  ('iron_ore',       'Iron Ore',       '철광석',         'common',    '🪨', 1, 1.0,  true, true),
  ('carbon_fiber',   'Carbon Fiber',   '탄소섬유',       'common',    '🧵', 1, 1.5,  true, true),
  ('silicon_chip',   'Silicon Chip',   '실리콘 칩',      'rare',      '💠', 1, 2.0,  true, true),
  -- Mid tier (tier 2)
  ('titanium_alloy', 'Titanium Alloy', '티타늄 합금',    'rare',      '⚙️', 2, 5.0,  true, true),
  ('plasma_crystal', 'Plasma Crystal', '플라즈마 결정',  'rare',      '🔮', 2, 7.0,  true, true),
  ('nano_polymer',   'Nano Polymer',   '나노 폴리머',    'rare',      '🧬', 2, 6.0,  true, true),
  -- Core tier (tier 3 — Titan only)
  ('dark_matter',    'Dark Matter',    '암흑물질',       'legendary', '🌑', 3, 30.0, true, true),
  ('quantum_core',   'Quantum Core',   '퀀텀 코어',      'legendary', '⚡', 3, 40.0, true, true),
  ('exotic_alloy',   'Exotic Alloy',   '이그조틱 합금',  'legendary', '✨', 3, 25.0, true, true)
ON CONFLICT (code) DO NOTHING;

-- ── 2. sector_resource_rates 에 zone별 드롭 확률 추가 ────────────────────────
-- Frontier: iron_ore (30%), carbon_fiber (20%), silicon_chip (10%)
INSERT INTO sector_resource_rates (sector_type, resource_code, base_rate, miner_bonus, is_active)
VALUES
  ('frontier', 'iron_ore',       0.30, 0.05, true),
  ('frontier', 'carbon_fiber',   0.20, 0.04, true),
  ('frontier', 'silicon_chip',   0.10, 0.03, true),
  -- Mid: titanium_alloy (20%), plasma_crystal (15%), nano_polymer (15%)
  ('mid',      'titanium_alloy', 0.20, 0.04, true),
  ('mid',      'plasma_crystal', 0.15, 0.03, true),
  ('mid',      'nano_polymer',   0.15, 0.03, true),
  -- Core: dark_matter (15%), quantum_core (12%), exotic_alloy (10%)
  ('core',     'dark_matter',    0.15, 0.03, true),
  ('core',     'quantum_core',   0.12, 0.03, true),
  ('core',     'exotic_alloy',   0.10, 0.02, true)
ON CONFLICT (sector_type, resource_code) DO NOTHING;

-- ── 3. Core 구역 진입 레벨 25 → 20 ────────────────────────────────────────────
UPDATE sector_entry_requirements
SET min_level = 20
WHERE min_level = 25;

-- ── 4. Mid 구역 진입 레벨 확인 (이미 10이면 NO-OP) ────────────────────────────
UPDATE sector_entry_requirements
SET min_level = 10
WHERE min_level != 10
  AND sector_code IN (
    SELECT code FROM sector_definitions WHERE sector_type = 'mid'
  );

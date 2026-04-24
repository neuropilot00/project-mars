-- Migration 163: Zone-based Mineral System
-- 구역별 채굴 재료 차별화
-- Frontier → 기본 재료 / Mid → 중급 재료 / Core → 희귀 재료(타이탄 전용)
-- 함선 건조 recipe_minerals에 사용

-- ── 재료 아이템 타입 추가 (item_types) ─────────────────────────────────────────
-- 기존 item_types 구조 확인 후 mineral 카테고리 추가
-- item_types 스키마: code, name, description, category, price_pp, price_usdt, price_gp, max_stack, active, icon
INSERT INTO item_types (code, name, description, category, price_gp, price_pp, price_usdt, max_stack, active, icon)
VALUES
  -- Frontier 재료 (기본, tier1)
  ('iron_ore',        'Iron Ore (철광석)',           '[Frontier] 기본 건설 자재',        'mineral', 0, 0, 0, 9999, true, '🪨'),
  ('carbon_fiber',    'Carbon Fiber (탄소섬유)',      '[Frontier] 경량 구조재',           'mineral', 0, 0, 0, 9999, true, '🧵'),
  ('silicon_chip',    'Silicon Chip (실리콘 칩)',     '[Frontier] 전자 부품재',           'mineral', 0, 0, 0, 9999, true, '💠'),

  -- Mid 재료 (중급, tier2)
  ('titanium_alloy',  'Titanium Alloy (티타늄 합금)', '[Mid] 구축함 건조에 필요',         'mineral', 0, 0, 0, 9999, true, '⚙️'),
  ('plasma_crystal',  'Plasma Crystal (플라즈마 결정)','[Mid] 순양함 건조에 필요',        'mineral', 0, 0, 0, 9999, true, '🔮'),
  ('nano_polymer',    'Nano Polymer (나노 폴리머)',   '[Mid] 전함 건조에 필요',           'mineral', 0, 0, 0, 9999, true, '🧬'),

  -- Core 재료 (희귀, tier3 — 타이탄 전용)
  ('dark_matter',     'Dark Matter (암흑물질)',       '[Core 전용] 타이탄 건조에 필수',   'mineral', 0, 0, 0, 9999, true, '🌑'),
  ('quantum_core',    'Quantum Core (퀀텀 코어)',     '[Core 전용] 타이탄 퀀텀 처리장치', 'mineral', 0, 0, 0, 9999, true, '⚡'),
  ('exotic_alloy',    'Exotic Alloy (이그조틱 합금)', '[Core 전용] 타이탄/자본함 전용',   'mineral', 0, 0, 0, 9999, true, '✨')
ON CONFLICT (code) DO NOTHING;

-- ── 구역 티어별 광물 드롭 설정 (settings) ──────────────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  -- Frontier 드롭 테이블 (기본재료 3종, 각 확률)
  ('mineral', 'mineral_frontier_drops', '"iron_ore,carbon_fiber,silicon_chip"',
     'Frontier 구역 채굴 시 드롭 가능한 재료 목록 (쉼표구분)'),
  ('mineral', 'mineral_frontier_chance', '40',
     'Frontier 채굴 1회당 재료 드롭 확률 (%)'),
  ('mineral', 'mineral_frontier_qty_min', '1',
     'Frontier 드롭 최소 수량'),
  ('mineral', 'mineral_frontier_qty_max', '3',
     'Frontier 드롭 최대 수량'),

  -- Mid 드롭 테이블
  ('mineral', 'mineral_mid_drops', '"titanium_alloy,plasma_crystal,nano_polymer"',
     'Mid 구역 채굴 시 드롭 가능한 재료 목록'),
  ('mineral', 'mineral_mid_chance', '30',
     'Mid 채굴 1회당 재료 드롭 확률 (%)'),
  ('mineral', 'mineral_mid_qty_min', '1',
     'Mid 드롭 최소 수량'),
  ('mineral', 'mineral_mid_qty_max', '2',
     'Mid 드롭 최대 수량'),

  -- Core 드롭 테이블 (희귀)
  ('mineral', 'mineral_core_drops', '"dark_matter,quantum_core,exotic_alloy"',
     'Core 구역 채굴 시 드롭 가능한 재료 목록'),
  ('mineral', 'mineral_core_chance', '20',
     'Core 채굴 1회당 재료 드롭 확률 (%)'),
  ('mineral', 'mineral_core_qty_min', '1',
     'Core 드롭 최소 수량'),
  ('mineral', 'mineral_core_qty_max', '1',
     'Core 드롭 최대 수량')
ON CONFLICT (key) DO NOTHING;

-- ── 함선 recipe_minerals 업데이트 (등급별 재료 요구) ───────────────────────────
-- Frigate: 기본 재료 (Frontier)
UPDATE ship_types SET recipe_minerals = '{"iron_ore":5,"carbon_fiber":3}'
WHERE size_class = 'frigate' AND faction_code = 'mcc';

UPDATE ship_types SET recipe_minerals = '{"iron_ore":4,"carbon_fiber":4}'
WHERE size_class = 'frigate' AND faction_code = 'cv';

UPDATE ship_types SET recipe_minerals = '{"iron_ore":3,"carbon_fiber":5,"silicon_chip":2}'
WHERE size_class = 'frigate' AND faction_code = 'fsp';

-- Destroyer: Frontier + Mid 재료 필요
UPDATE ship_types SET recipe_minerals = '{"iron_ore":15,"titanium_alloy":5}'
WHERE size_class = 'destroyer' AND faction_code = 'mcc';

UPDATE ship_types SET recipe_minerals = '{"iron_ore":12,"titanium_alloy":6}'
WHERE size_class = 'destroyer' AND faction_code = 'cv';

UPDATE ship_types SET recipe_minerals = '{"silicon_chip":8,"titanium_alloy":4,"plasma_crystal":2}'
WHERE size_class = 'destroyer' AND faction_code = 'fsp';

-- Cruiser: Mid 재료 중심
UPDATE ship_types SET recipe_minerals = '{"titanium_alloy":20,"plasma_crystal":8,"nano_polymer":5}'
WHERE size_class = 'cruiser' AND faction_code = 'mcc';

UPDATE ship_types SET recipe_minerals = '{"titanium_alloy":18,"nano_polymer":8,"plasma_crystal":4}'
WHERE size_class = 'cruiser' AND faction_code = 'cv';

UPDATE ship_types SET recipe_minerals = '{"plasma_crystal":15,"titanium_alloy":10,"silicon_chip":20}'
WHERE size_class = 'cruiser' AND faction_code = 'fsp';

-- Battleship: Mid + Core 재료 (core 조금만)
UPDATE ship_types SET recipe_minerals = '{"titanium_alloy":50,"nano_polymer":20,"exotic_alloy":3}'
WHERE size_class = 'battleship' AND faction_code = 'mcc';

UPDATE ship_types SET recipe_minerals = '{"titanium_alloy":45,"plasma_crystal":25,"exotic_alloy":3}'
WHERE size_class = 'battleship' AND faction_code = 'cv';

UPDATE ship_types SET recipe_minerals = '{"plasma_crystal":40,"nano_polymer":30,"exotic_alloy":2}'
WHERE size_class = 'battleship' AND faction_code = 'fsp';

-- Titan: Core 재료 필수 (dark_matter, quantum_core 없으면 못 만듦)
UPDATE ship_types SET recipe_minerals = '{"exotic_alloy":10,"dark_matter":5,"quantum_core":3,"titanium_alloy":100,"nano_polymer":50}'
WHERE size_class = 'titan' AND faction_code = 'mcc';

UPDATE ship_types SET recipe_minerals = '{"exotic_alloy":10,"dark_matter":5,"quantum_core":3,"titanium_alloy":90,"plasma_crystal":60}'
WHERE size_class = 'titan' AND faction_code = 'cv';

UPDATE ship_types SET recipe_minerals = '{"exotic_alloy":10,"quantum_core":5,"dark_matter":3,"plasma_crystal":100,"silicon_chip":80}'
WHERE size_class = 'titan' AND faction_code = 'fsp';

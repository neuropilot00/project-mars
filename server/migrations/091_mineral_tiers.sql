-- ═══════════════════════════════════════════════════════════════
-- Migration 091: Fleet Combat - Mineral Tiers & Components
-- ═══════════════════════════════════════════════════════════════
-- 기존 resources 테이블에 함대전용 컬럼 추가
--   - tier: 0/1/2/3 분류
--   - is_craftable: 제작 가능 여부
--   - craft_recipe: 제작 레시피
--   - craft_time_seconds: 제작 시간
--
-- 신규 자원 4종 추가:
--   - hull_plate (Tier 3, 제작)
--   - plasma_coil (Tier 3, 제작)
--   - alloy_frame (Tier 3, 제작)
--   - xenomatter (Tier 2, Titan 전용)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. resources 테이블 확장 ──────────────────────────────────

ALTER TABLE resources ADD COLUMN IF NOT EXISTS tier SMALLINT DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_craftable BOOLEAN DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS craft_recipe JSONB;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS craft_time_seconds INTEGER DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS description_ko TEXT;


-- ── 2. 기존 9개 광물 Tier 분류 ────────────────────────────────

UPDATE resources SET 
  tier = 0,
  color_hex = '#795548',
  description_ko = '화성 표토에서 흔하게 발견되는 기본 광물'
WHERE code = 'iron_dust';

UPDATE resources SET 
  tier = 0,
  color_hex = '#e57373',
  description_ko = '붉은 모래 · 기본 구조 재료'
WHERE code = 'red_sand';

UPDATE resources SET 
  tier = 0,
  color_hex = '#9e9e9e',
  description_ko = '레골리스 광석 · 범용 광물'
WHERE code = 'regolith_ore';

UPDATE resources SET 
  tier = 1,
  color_hex = '#5d4037',
  description_ko = '화산 지대에서 채굴되는 중급 광물'
WHERE code = 'basalt_chip';

UPDATE resources SET 
  tier = 1,
  color_hex = '#4fc3f7',
  description_ko = '극지 섹터의 얼음 결정 · 중급 광물'
WHERE code = 'ice_crystal';

UPDATE resources SET 
  tier = 1,
  color_hex = '#ff6d00',
  description_ko = '화산 파편 · 고에너지 중급 광물'
WHERE code = 'volcanic_shard';

UPDATE resources SET 
  tier = 2,
  color_hex = '#7e57c2',
  description_ko = '플라즈마 먼지 · 고급 에너지 소재'
WHERE code = 'plasma_dust';

UPDATE resources SET 
  tier = 2,
  color_hex = '#ffd700',
  description_ko = 'Frontier 섹터 극희귀 금속'
WHERE code = 'ancient_metal';

UPDATE resources SET 
  tier = 2,
  color_hex = '#b39ddb',
  description_ko = '유성우 이벤트 중 드랍되는 파편'
WHERE code = 'meteorite_fragment';


-- ── 3. 신규 Tier 2: Xenomatter (Titan 전용) ──────────────────

INSERT INTO resources (
  code, name_en, name_ko, name_ja, name_zh,
  rarity, icon_emoji, base_pp_value, is_tradeable, is_active,
  tier, is_craftable, color_hex, description_ko, description_en
) VALUES (
  'xenomatter',
  'Xenomatter',
  '외계 물질',
  '異星物質',
  '外星物质',
  'legendary',
  '💠',
  500,
  true,
  true,
  2,
  false,
  '#00e5ff',
  '외계 함선 격파 시 드랍되는 극희귀 물질 · Titan 건조 필수',
  'Extremely rare material dropped from alien ship wrecks · Required for Titan construction'
) ON CONFLICT (code) DO UPDATE SET
  tier = EXCLUDED.tier,
  color_hex = EXCLUDED.color_hex,
  description_ko = EXCLUDED.description_ko,
  description_en = EXCLUDED.description_en;


-- ── 4. 신규 Tier 3: 중간 부품 3종 (유저 제작) ────────────────

INSERT INTO resources (
  code, name_en, name_ko, name_ja, name_zh,
  rarity, icon_emoji, base_pp_value, is_tradeable, is_active,
  tier, is_craftable, craft_recipe, craft_time_seconds,
  color_hex, description_ko, description_en
) VALUES
(
  'hull_plate',
  'Hull Plate', '장갑판', 'ハルプレート', '装甲板',
  'rare',
  '▣',
  80,
  true,
  true,
  3,
  true,
  '{"iron_dust":50,"regolith_ore":20}'::jsonb,
  600,
  '#607d8b',
  '중대형 함선용 보강 장갑판 (Crafter 제작)',
  'Reinforced armor plating for mid-to-capital ships (Crafter-produced)'
),
(
  'plasma_coil',
  'Plasma Coil', '플라즈마 코일', 'プラズマコイル', '等离子线圈',
  'rare',
  '⚡',
  120,
  true,
  true,
  3,
  true,
  '{"volcanic_shard":10,"basalt_chip":3}'::jsonb,
  900,
  '#ff6d00',
  '중화기 전력 전도체 (Crafter 제작)',
  'Power conduit for heavy weapon systems (Crafter-produced)'
),
(
  'alloy_frame',
  'Alloy Frame', '합금 프레임', '合金フレーム', '合金框架',
  'rare',
  '⬢',
  150,
  true,
  true,
  3,
  true,
  '{"iron_dust":80,"ice_crystal":15,"basalt_chip":2}'::jsonb,
  1200,
  '#29b6f6',
  '대형함용 구조 합금 프레임 (Crafter 제작)',
  'Structural alloy frame for capital-class vessels (Crafter-produced)'
)
ON CONFLICT (code) DO UPDATE SET
  tier = EXCLUDED.tier,
  is_craftable = EXCLUDED.is_craftable,
  craft_recipe = EXCLUDED.craft_recipe,
  craft_time_seconds = EXCLUDED.craft_time_seconds,
  color_hex = EXCLUDED.color_hex,
  description_ko = EXCLUDED.description_ko,
  description_en = EXCLUDED.description_en;


-- ── 5. 인덱스 ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_resources_tier ON resources(tier);
CREATE INDEX IF NOT EXISTS idx_resources_craftable ON resources(is_craftable) WHERE is_craftable = true;


-- ── 6. 제작 작업 큐 테이블 (부품 제작용) ─────────────────────

CREATE TABLE IF NOT EXISTS resource_crafting_jobs (
  id              BIGSERIAL PRIMARY KEY,
  wallet_address  VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  resource_code   VARCHAR(24) NOT NULL REFERENCES resources(code),
  quantity        INTEGER NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completes_at    TIMESTAMPTZ NOT NULL,
  status          VARCHAR(16) DEFAULT 'crafting',  -- crafting|completed|cancelled
  materials_used  JSONB NOT NULL,                  -- 실제 소모된 재료 (로그용)
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crafting_jobs_wallet ON resource_crafting_jobs(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_crafting_jobs_status ON resource_crafting_jobs(status, completes_at) WHERE status = 'crafting';


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- SELECT tier, COUNT(*), STRING_AGG(code, ', ' ORDER BY code) FROM resources GROUP BY tier ORDER BY tier;
-- 기대 결과:
--  tier 0: iron_dust, red_sand, regolith_ore (3개)
--  tier 1: basalt_chip, ice_crystal, volcanic_shard (3개)
--  tier 2: ancient_metal, meteorite_fragment, plasma_dust, xenomatter (4개)
--  tier 3: alloy_frame, hull_plate, plasma_coil (3개)
--
-- 총 13개 자원 (기존 9개 + 신규 4개)

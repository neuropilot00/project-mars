-- ═══════════════════════════════════════════════════════════════
-- Migration 089: Fleet Combat - Factions (파벌 시스템)
-- ═══════════════════════════════════════════════════════════════
-- 프로토타입 v11 기반 3파벌 정의
-- MCC (기하학·레일건) / FSP (유기적·드론) / CV (조립식·돌격)
--
-- 이 마이그레이션은:
--   1. factions 테이블 생성
--   2. 3파벌 시드 데이터 삽입
--   3. users 테이블에 faction_id 컬럼 추가 (선택 가능)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Factions 테이블 ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS factions (
  code            VARCHAR(8)   PRIMARY KEY,
  
  -- 다국어 이름 (resources 테이블 패턴과 동일)
  name_en         VARCHAR(64)  NOT NULL,
  name_ko         VARCHAR(64)  NOT NULL,
  name_ja         VARCHAR(64),
  name_zh         VARCHAR(64),
  
  description_en  TEXT,
  description_ko  TEXT,
  
  -- 시각 정체성
  color_primary   VARCHAR(7)   NOT NULL,      -- #4fc3f7
  color_dark      VARCHAR(7)   NOT NULL,
  color_bright    VARCHAR(7)   NOT NULL,
  visual_style    VARCHAR(16)  NOT NULL,      -- geometric | organic | patchwork
  icon_emoji      VARCHAR(8),
  
  -- 게임플레이 설명
  specialty_en    TEXT,
  specialty_ko    TEXT,
  naming_scheme   TEXT,
  
  -- 밸런스 보정 (기본 1.00)
  atk_multiplier  NUMERIC(3,2) DEFAULT 1.00,
  def_multiplier  NUMERIC(3,2) DEFAULT 1.00,
  spd_multiplier  NUMERIC(3,2) DEFAULT 1.00,
  
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factions_active ON factions(is_active, sort_order);


-- ── 2. 3파벌 시드 ──────────────────────────────────────────────

INSERT INTO factions (
  code, 
  name_en, name_ko, name_ja, name_zh,
  description_en, description_ko,
  color_primary, color_dark, color_bright, visual_style, icon_emoji,
  specialty_en, specialty_ko, naming_scheme,
  atk_multiplier, def_multiplier, spd_multiplier, sort_order
) VALUES
(
  'mcc',
  'Mars Corporate Consortium', '마스 기업 연합', 'マーズ企業連合', '火星企业联合',
  'Corporate alliance with geometric ship designs and railgun specialization',
  '기업 연합 · 기하학적 디자인 · 레일건 특화',
  '#4fc3f7', '#0277bd', '#81d4fa', 'geometric', '⬢',
  'Long-range precision railgun fire',
  '장거리 포격 · 정확도 높은 레일건',
  '금속성 명칭 (Shard, Vector, Prism, Obelisk, Tessellate)',
  1.05, 1.00, 0.95, 1
),
(
  'fsp',
  'Free Settlers Pact', '자유 정착자 연맹', '自由開拓者連盟', '自由开拓者联盟',
  'Free settlers with organic curves, drones and logistics',
  '자유 정착자 · 유기적 곡선 · 드론/로지 특화',
  '#81c784', '#388e3c', '#a5d6a7', 'organic', '◉',
  'Drone swarms, shields and repair logistics',
  '드론 운영 · 방어막 · 로지스틱',
  '자연 명칭 (Sprite, Verdant, Grove, Nova, Sequoia)',
  0.95, 1.10, 0.95, 2
),
(
  'cv',
  'Crimson Verdict', '크림슨 베르딕트', 'クリムゾン裁判', '猩红裁决',
  'Pirate coalition with patchwork rusted hulls and assault tactics',
  '해적 연합 · 조립식 녹슨 외형 · 돌격 특화',
  '#ef5350', '#b71c1c', '#ff8a80', 'patchwork', '▲',
  'Close combat, high speed, saturation fire',
  '근접 전투 · 빠른 속도 · 탄막 화력',
  '폭력적 명칭 (Slasher, Jagged, Butcher, Reaper, Ironclad)',
  1.10, 0.90, 1.05, 3
)
ON CONFLICT (code) DO UPDATE SET
  name_en         = EXCLUDED.name_en,
  name_ko         = EXCLUDED.name_ko,
  name_ja         = EXCLUDED.name_ja,
  name_zh         = EXCLUDED.name_zh,
  description_en  = EXCLUDED.description_en,
  description_ko  = EXCLUDED.description_ko,
  color_primary   = EXCLUDED.color_primary,
  color_dark      = EXCLUDED.color_dark,
  color_bright    = EXCLUDED.color_bright,
  visual_style    = EXCLUDED.visual_style,
  icon_emoji      = EXCLUDED.icon_emoji,
  specialty_en    = EXCLUDED.specialty_en,
  specialty_ko    = EXCLUDED.specialty_ko,
  naming_scheme   = EXCLUDED.naming_scheme,
  atk_multiplier  = EXCLUDED.atk_multiplier,
  def_multiplier  = EXCLUDED.def_multiplier,
  spd_multiplier  = EXCLUDED.spd_multiplier,
  sort_order      = EXCLUDED.sort_order;


-- ── 3. users에 faction_id 추가 (선택적) ──────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS faction_code VARCHAR(8) REFERENCES factions(code);
ALTER TABLE users ADD COLUMN IF NOT EXISTS faction_chosen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction_code) WHERE faction_code IS NOT NULL;


-- ── 4. Settings 추가 ──────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'fleet_combat_enabled', 'false', 'Fleet combat system master switch (false until tested)'),
  ('fleet', 'faction_change_cooldown_hours', '168', 'Hours between faction changes (7 days)'),
  ('fleet', 'faction_change_fee_gp', '500', 'GP cost to change faction')
ON CONFLICT (key) DO NOTHING;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (실행 후)
-- ═══════════════════════════════════════════════════════════════
-- SELECT code, name_ko, visual_style, color_primary FROM factions ORDER BY sort_order;
-- 기대 결과: mcc, fsp, cv 3행

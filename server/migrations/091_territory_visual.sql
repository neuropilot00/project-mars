-- ═══════════════════════════════════════════════════════════════
-- Migration 091: 영토 매매 비주얼
-- GAME_BIBLE_V4 Part 2 § 2 기준
-- claims 테이블 컬럼 추가 + 영토 가격 settings
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. claims 테이블 컬럼 보강 ───

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS price_paid_pp    DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS adjacency_bonus  DECIMAL(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_headquarter   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cluster_size     INT DEFAULT 1;

-- sector_code 컬럼 (sector_definitions 테이블 존재 여부 확인 후)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'sector_definitions'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS sector_code VARCHAR(30);
    -- FK는 안전하게 조건부로
    BEGIN
      ALTER TABLE claims
        ADD CONSTRAINT fk_claims_sector
        FOREIGN KEY (sector_code) REFERENCES sector_definitions(code)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  ELSE
    ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS sector_code VARCHAR(30);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claims_sector   ON claims(sector_code) WHERE sector_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claims_hq       ON claims(owner) WHERE is_headquarter = TRUE;
CREATE INDEX IF NOT EXISTS idx_claims_adjacency ON claims(adjacency_bonus) WHERE adjacency_bonus > 0;

-- ─── 2. 영토 가격 Settings ───

INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'land_base_price_pp',        '0.1',   '픽셀당 기본 PP 가격'),
  ('territory', 'land_adjacent_discount',    '0.85',  '인접 구매 할인 배율 (15% 할인)'),
  ('territory', 'land_core_price_mult',       '5.0',   'Core 섹터 가격 배율'),
  ('territory', 'land_mid_price_mult',        '2.0',   'Mid 섹터 가격 배율'),
  ('territory', 'land_frontier_price_mult',   '1.0',   'Frontier 섹터 가격 배율'),
  ('territory', 'land_center_price_mult',     '1.5',   '섹터 중심부 가격 배율'),
  ('territory', 'land_min_size',              '25',    '최소 영토 크기 (px)'),
  ('territory', 'land_max_single_purchase',   '10000', '1회 최대 구매 크기 (px)'),
  ('territory', 'land_max_core_px',           '20000', 'Core 1인 최대 보유 (px)'),
  ('territory', 'land_max_mid_px',            '50000', 'Mid 1인 최대 보유 (px)'),
  ('territory', 'land_adjacency_5_bonus',     '0.05',  '5개 인접 Mining 보너스'),
  ('territory', 'land_adjacency_10_bonus',    '0.10',  '10개 인접 Mining 보너스'),
  ('territory', 'land_adjacency_20_bonus',    '0.20',  '20개 인접 Mining 보너스'),
  ('territory', 'land_hq_defense_bonus',      '0.20',  '본진 방어 보너스 (20%)')
ON CONFLICT (key) DO NOTHING;

-- ─── 3. 영토 가격 계산 함수 ───

CREATE OR REPLACE FUNCTION calc_territory_price(
  p_pixel_count      INT,
  p_sector_type      VARCHAR DEFAULT 'frontier',
  p_is_center        BOOLEAN DEFAULT FALSE,
  p_is_adjacent      BOOLEAN DEFAULT FALSE
) RETURNS DECIMAL(20,8) AS $$
DECLARE
  v_base         DECIMAL;
  v_sector_mult  DECIMAL;
  v_center_mult  DECIMAL;
  v_adj_mult     DECIMAL;
BEGIN
  SELECT COALESCE(NULLIF(value,''),'0.1')::DECIMAL INTO v_base
  FROM settings WHERE key = 'land_base_price_pp';

  v_sector_mult := CASE p_sector_type
    WHEN 'core'     THEN 5.0
    WHEN 'mid'      THEN 2.0
    ELSE                 1.0
  END;

  v_center_mult := CASE WHEN p_is_center THEN 1.5 ELSE 1.0 END;
  v_adj_mult    := CASE WHEN p_is_adjacent THEN 0.85 ELSE 1.0 END;

  RETURN ROUND(v_base * p_pixel_count * v_sector_mult * v_center_mult * v_adj_mult, 8);
END;
$$ LANGUAGE plpgsql;

-- ─── 4. 완료 알림 ───

DO $$
BEGIN
  RAISE NOTICE '[M-091] claims 컬럼 보강, territory settings 14개, calc_territory_price 함수 생성 완료';
END $$;

COMMIT;

-- 검증:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'claims' AND column_name IN
-- ('price_paid_pp','adjacency_bonus','is_headquarter','cluster_size','sector_code');
-- SELECT key, value FROM settings WHERE category = 'territory';
-- SELECT calc_territory_price(100, 'core', true, false); → 75
-- SELECT calc_territory_price(100, 'frontier', false, true); → 8.5

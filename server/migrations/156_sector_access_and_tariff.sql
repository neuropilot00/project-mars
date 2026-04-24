-- ════════════════════════════════════════════════════════════════════
-- Migration 156 — Phase A: 섹터 진입 제약 + 관세 시스템 활성화
--
-- 배경:
--   M-084에서 sector_definitions/sector_entry_requirements 테이블을 만들었지만
--   실제 게임에서 쓰이는 좌표/거버넌스 테이블은 sectors (PK=id, polygon 기반).
--   두 시스템이 분리돼 entry-check 함수가 사실상 미연결 상태.
--
-- 결정:
--   sector_definitions는 lore/UI용으로 유지하되, 게임 룰(entry/tariff)은
--   sectors 테이블에 직접 부착해서 단일 진실 출처(SSOT)로 만든다.
--
-- 변경:
--   1) sectors에 entry 요건 컬럼 추가 + tier 기반 시드
--   2) sectors.tax_rate는 이미 존재 (default 2.00) — 그대로 활용
--   3) 새 settings:
--      - sector_tariff_enabled         (true)
--      - sector_tariff_pct             (2.0)   ← admin이 글로벌 기본값 조정
--      - sector_tariff_guild_exempt    (true)  ← 길드 멤버 면제 토글
--      - sector_tariff_uses_per_sector (true)  ← true면 sectors.tax_rate 우선
--      - sector_entry_check_enabled    (이미 있음, 보장만)
--   4) marketplace_listings에 sector_id 컬럼 (관세 정산용)
--
-- 모두 idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. sectors 테이블에 entry 요건 컬럼 ─────────────────────────────
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS entry_min_level         INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_required_mid_owns INT     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_check_active      BOOLEAN DEFAULT TRUE;

-- ── 2. tier 기반 시드 (이미 값 있으면 SKIP) ─────────────────────────
UPDATE sectors SET
  entry_min_level = CASE tier
    WHEN 'frontier' THEN 0
    WHEN 'mid'      THEN 10
    WHEN 'core'     THEN 25
    ELSE 0
  END,
  entry_required_mid_owns = CASE tier
    WHEN 'core' THEN 1
    ELSE 0
  END
WHERE entry_min_level = 0
  AND entry_required_mid_owns = 0
  AND tier IN ('mid','core');

-- ── 3. settings (관세 + 진입 제한 토글) ─────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('sector', 'sector_entry_check_enabled', 'true',
   '섹터 진입 레벨/영토 제약 전역 토글 (false면 모두 통과)'),

  ('sector', 'sector_tariff_enabled', 'true',
   '섹터 관세(거버너 수수료) 전역 토글'),

  ('sector', 'sector_tariff_pct', '2.0',
   '섹터 관세 기본 % (sector_tariff_uses_per_sector=false일 때만 사용)'),

  ('sector', 'sector_tariff_uses_per_sector', 'true',
   'true면 sectors.tax_rate 컬럼 값을 섹터별로 사용. false면 sector_tariff_pct 글로벌값'),

  ('sector', 'sector_tariff_guild_exempt', 'true',
   '판매자와 거버너가 같은 길드 소속이면 관세 면제'),

  ('sector', 'sector_tariff_min_listing_pp', '0.001',
   '관세 부과 최소 거래 금액 (먼지 거래 보호)')
ON CONFLICT (key) DO NOTHING;

-- ── 4. marketplace_listings에 sector_id (관세 정산용) ──────────────
-- 등록 시 판매 아이템 위치 sector를 기록 → 구매 시 거버너에게 관세
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS sector_id INT REFERENCES sectors(id);

CREATE INDEX IF NOT EXISTS idx_mkt_listings_sector
  ON marketplace_listings(sector_id) WHERE sector_id IS NOT NULL;

-- ── 5. 관세 수입 로그 테이블 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sector_tariff_log (
  id              SERIAL PRIMARY KEY,
  sector_id       INT REFERENCES sectors(id),
  governor_wallet VARCHAR(42) REFERENCES users(wallet_address),
  payer_wallet    VARCHAR(42) REFERENCES users(wallet_address),
  source          VARCHAR(30) NOT NULL,   -- 'marketplace_buy', 'mining_yield', etc
  source_ref_id   INT,                    -- listing_id 등
  gross_amount    DECIMAL(20,8) NOT NULL,
  tariff_pct      DECIMAL(5,2)  NOT NULL,
  tariff_amount   DECIMAL(20,8) NOT NULL,
  guild_exempted  BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_sector ON sector_tariff_log(sector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tariff_governor ON sector_tariff_log(governor_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tariff_payer ON sector_tariff_log(payer_wallet, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK SQL:
--   ALTER TABLE sectors
--     DROP COLUMN IF EXISTS entry_min_level,
--     DROP COLUMN IF EXISTS entry_required_mid_owns,
--     DROP COLUMN IF EXISTS entry_check_active;
--   ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS sector_id;
--   DROP TABLE IF EXISTS sector_tariff_log;
--   DELETE FROM settings WHERE key IN (
--     'sector_tariff_enabled','sector_tariff_pct','sector_tariff_uses_per_sector',
--     'sector_tariff_guild_exempt','sector_tariff_min_listing_pp');
-- ════════════════════════════════════════════════════════════════════

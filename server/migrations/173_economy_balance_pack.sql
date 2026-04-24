-- Migration 173: 경제 밸런스 패키지
-- A. 상점 UI 재배치 (프론트엔드 변경, SQL 불필요)
-- B. Frigate 수리 vs 신조 경제성
-- C. 함선 해체 (Core 광물 sink)
-- D. 레퍼럴 × 마켓 수수료 연동
-- E. 함대 전투 손실 회수율 대시보드 (admin 엔드포인트)
-- F. 파벌 변경 쿨다운 현실화

-- ── B. Frigate 수리 경제성 캡 ────────────────────────────────
-- 수리 총비용은 절대로 신조 비용의 N%를 넘지 않음 → 수리 > 신조 역전 방지
INSERT INTO settings (category, key, value, description) VALUES
  ('ship', 'ship_repair_cost_cap_pct_of_build', '60',
   '수리 총비용 상한 (신조가의 %) — 60이면 풀수리는 최대 신조의 60% GP로 고정')
ON CONFLICT (key) DO NOTHING;

-- ── C. 함선 해체 settings + 로그 테이블 ──────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  ('ship', 'ship_scrap_enabled',     'true', '함선 해체 활성화'),
  ('ship', 'ship_scrap_refund_pct',  '40',   '해체 시 GP/광물 환불 % (나머지는 소각 → sink)')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS ship_scrap_log (
  id                BIGSERIAL PRIMARY KEY,
  ship_id           BIGINT NOT NULL,
  wallet            TEXT NOT NULL,
  ship_type_code    TEXT,
  gp_refunded       NUMERIC(20,6) DEFAULT 0,
  minerals_refunded JSONB DEFAULT '{}'::jsonb,
  minerals_burned   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ship_scrap_wallet ON ship_scrap_log(wallet);
CREATE INDEX IF NOT EXISTS idx_ship_scrap_created ON ship_scrap_log(created_at DESC);

-- 함선 파괴 사유 컬럼 추가 (scrapped, battle, hijack 구분)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ships' AND column_name='destroyed_reason'
  ) THEN
    ALTER TABLE ships ADD COLUMN destroyed_reason TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ships' AND column_name='destroyed_at'
  ) THEN
    ALTER TABLE ships ADD COLUMN destroyed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── D. 레퍼럴 × 마켓 수수료 연동 ─────────────────────────────
-- 마켓 수수료 중 X%를 레퍼럴 트리에 분배 (기존: 구매액 전체 기준 → 수수료 기준으로 변경)
INSERT INTO settings (category, key, value, description) VALUES
  ('marketplace', 'marketplace_referral_commission_pct_of_fee', '25',
   '마켓 수수료 중 레퍼럴 트리로 분배되는 % (25 → fee의 25%를 트리로)'),
  ('referral',    'referral_market_fee_pct', '100',
   'market_fee 트리거 시 baseAmount 대비 pool 비율 (100=전체, creditReferralCommission 내부용)')
ON CONFLICT (key) DO NOTHING;

-- ── F. 파벌 변경 쿨다운/비용 현실화 ──────────────────────────
-- 168h(7일)은 너무 길어 신규 유저가 선택 실수 시 락인. 72h(3일)로 완화.
-- 수수료 500 GP는 낮게 유지 (쿨다운이 주요 장벽)
UPDATE settings SET value = '72',  description = COALESCE(description,'Faction change cooldown (hours)')
  WHERE key = 'faction_change_cooldown_hours'
    AND (value::text IN ('"168"','168') OR value = '168');
UPDATE settings SET value = '300', description = COALESCE(description,'Faction change fee (GP)')
  WHERE key = 'faction_change_fee_gp'
    AND (value::text IN ('"500"','500') OR value = '500');

-- 만약 위 UPDATE가 매칭 안 되면 (첫 설치 / 이미 다른 값) INSERT로 보장
INSERT INTO settings (category, key, value, description) VALUES
  ('faction', 'faction_change_cooldown_hours', '72',  'Faction change cooldown (hours)'),
  ('faction', 'faction_change_fee_gp',         '300', 'Faction change fee (GP)')
ON CONFLICT (key) DO NOTHING;

-- ── schema_migrations ────────────────────────────────────────
INSERT INTO schema_migrations (filename) VALUES ('173_economy_balance_pack.sql')
ON CONFLICT DO NOTHING;

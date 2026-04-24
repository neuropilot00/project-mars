-- ═══════════════════════════════════════════════════════════════
-- Migration 092: 파벌 시스템
-- factions 테이블(MCC/FSP/CV) 이미 존재 → 유저 연동 + 버프 + Settings
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. factions 테이블 버프 컬럼 보강 ───
-- 기존 factions 테이블에 게임플레이 버프 컬럼 추가

DO $$
BEGIN
  -- factions 테이블의 PK 컬럼명 확인 (code or id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factions' AND column_name = 'code'
  ) THEN
    ALTER TABLE factions
      ADD COLUMN IF NOT EXISTS mining_bonus      DECIMAL(5,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hijack_bonus      DECIMAL(5,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS defense_bonus     DECIMAL(5,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS market_fee_mult   DECIMAL(5,4) DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS territory_max_mult DECIMAL(5,4) DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS lore_ko           TEXT,
      ADD COLUMN IF NOT EXISTS lore_en           TEXT;

    -- 각 파벌 버프 설정
    UPDATE factions SET
      mining_bonus = 0.00, hijack_bonus = 0.05, defense_bonus = 0.00,
      market_fee_mult = 1.0, territory_max_mult = 1.2,
      lore_ko = '지구 메가기업 연합. 자원 독점과 영토 확장을 추구한다. Core 섹터를 장악하고 있다.',
      lore_en = 'Corporate alliance pursuing resource monopoly. Controls Core sectors.'
    WHERE code = 'mcc';

    UPDATE factions SET
      mining_bonus = 0.15, hijack_bonus = 0.00, defense_bonus = 0.05,
      market_fee_mult = 1.0, territory_max_mult = 1.0,
      lore_ko = '1세대 개척자 후손. 자유 무역과 채굴을 중시한다. Mid 섹터를 기반으로 한다.',
      lore_en = 'Free settlers prioritizing mining and trade. Based in Mid sectors.'
    WHERE code = 'fsp';

    UPDATE factions SET
      mining_bonus = 0.05, hijack_bonus = 0.10, defense_bonus = 0.00,
      market_fee_mult = 0.95, territory_max_mult = 1.0,
      lore_ko = '반기업 광부 연합. 빠른 공격과 약탈을 선호한다. Frontier 섹터를 누빈다.',
      lore_en = 'Pirate miners favoring fast raids. Roam the Frontier sectors.'
    WHERE code = 'cv';
  END IF;
END $$;

-- ─── 2. users 테이블 파벌 컬럼 추가 ───
-- faction_code 컬럼이 이미 있을 수 있음 (fleet combat에서 추가됨)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS faction_code         VARCHAR(8),
  ADD COLUMN IF NOT EXISTS faction_chosen_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faction_change_count INT DEFAULT 0;

-- FK 추가 (factions 테이블 PK가 code인 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factions' AND column_name = 'code'
  ) THEN
    BEGIN
      ALTER TABLE users
        ADD CONSTRAINT fk_users_faction
        FOREIGN KEY (faction_code) REFERENCES factions(code);
    EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction_code) WHERE faction_code IS NOT NULL;

-- ─── 3. 파벌 전쟁 기여 로그 (서사용) ───

CREATE TABLE IF NOT EXISTS faction_activity_log (
  id             BIGSERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  faction_code   VARCHAR(8)  NOT NULL,
  activity_type  VARCHAR(30) NOT NULL,
  -- hijack_success / mining_harvest / territory_defense / guild_war_win
  points         INT DEFAULT 1,
  sector_code    VARCHAR(30),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faction_log_faction ON faction_activity_log(faction_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faction_log_wallet  ON faction_activity_log(wallet_address);

-- ─── 4. Settings ───

INSERT INTO settings (category, key, value, description) VALUES
  ('faction', 'faction_system_enabled',       'true', '파벌 시스템 활성화'),
  ('faction', 'faction_change_cooldown_hours', '168',  '파벌 변경 쿨다운 (7일)'),
  ('faction', 'faction_change_fee_gp',         '500',  '파벌 변경 GP 비용'),
  ('faction', 'faction_first_choice_free',     'true', '첫 파벌 선택 무료'),
  ('faction', 'faction_mcc_territory_bonus',   '0.20', 'MCC 영토 최대 보유량 보너스'),
  ('faction', 'faction_fsp_mining_bonus',      '0.15', 'FSP 채굴량 보너스'),
  ('faction', 'faction_cv_hijack_bonus',       '0.10', 'CV Hijack 성공률 보너스'),
  ('faction', 'faction_cv_market_fee',         '0.95', 'CV 마켓 수수료 배율')
ON CONFLICT (key) DO NOTHING;

-- ─── 5. 완료 알림 ───

DO $$
BEGIN
  RAISE NOTICE '[M-092] factions 버프 컬럼, users.faction_code, faction_activity_log, settings 완료';
END $$;

COMMIT;

-- 검증:
-- SELECT code, name_ko, mining_bonus, hijack_bonus FROM factions ORDER BY sort_order;
-- SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name LIKE 'faction%';
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'faction_activity_log';
-- SELECT key, value FROM settings WHERE category = 'faction';

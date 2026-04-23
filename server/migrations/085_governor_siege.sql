-- ============================================================
-- Migration 085: Governor Siege 시스템 (BIBLE Migration 082)
--
-- ⚠️  users 테이블에 id 컬럼이 없음 (PK = wallet_address)
--     → challenger_id/defender_id/winner_id/user_id 대신
--       challenger_wallet/defender_wallet/winner_wallet/user_wallet 사용
-- ⚠️  sector_governance.active_siege_id 컬럼은 이미 존재
--     → FK constraint만 추가
-- ============================================================

-- ── 1. governor_sieges 테이블 ──
CREATE TABLE IF NOT EXISTS governor_sieges (
  id                    SERIAL PRIMARY KEY,
  sector_code           VARCHAR(30) NOT NULL
                          REFERENCES sector_definitions(code),
  challenger_wallet     VARCHAR(42) NOT NULL
                          REFERENCES users(wallet_address),
  defender_wallet       VARCHAR(42)
                          REFERENCES users(wallet_address),
  status                VARCHAR(20) DEFAULT 'pending'
                          CHECK (status IN ('pending','active','resolved','cancelled')),
  gp_cost               INT NOT NULL DEFAULT 0,
  declared_at           TIMESTAMP DEFAULT NOW(),
  siege_starts_at       TIMESTAMP,
  siege_ends_at         TIMESTAMP,
  winner_wallet         VARCHAR(42),
  final_challenger_px   INT DEFAULT 0,
  final_defender_px     INT DEFAULT 0,
  participant_count     INT DEFAULT 0,
  total_pp_volume       DECIMAL(20,8) DEFAULT 0,
  resolved_at           TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sieges_sector_status
  ON governor_sieges(sector_code, status);
CREATE INDEX IF NOT EXISTS idx_sieges_challenger
  ON governor_sieges(challenger_wallet);
CREATE INDEX IF NOT EXISTS idx_sieges_ends_at
  ON governor_sieges(siege_ends_at) WHERE status IN ('active','pending');

-- ── 2. governor_hall_of_fame 테이블 ──
CREATE TABLE IF NOT EXISTS governor_hall_of_fame (
  id                 SERIAL PRIMARY KEY,
  user_wallet        VARCHAR(42) NOT NULL
                       REFERENCES users(wallet_address),
  sector_code        VARCHAR(30) NOT NULL,
  term_start         TIMESTAMP NOT NULL,
  term_end           TIMESTAMP,
  duration_days      INT,
  total_tax_earned   DECIMAL(20,8) DEFAULT 0,
  ended_by           VARCHAR(30),        -- 'siege' | 'abdication' | 'season_end'
  max_tax_rate       DECIMAL(5,2),
  notable_event      TEXT
);

CREATE INDEX IF NOT EXISTS idx_hof_user_wallet  ON governor_hall_of_fame(user_wallet);
CREATE INDEX IF NOT EXISTS idx_hof_sector_code  ON governor_hall_of_fame(sector_code);

-- ── 3. sector_governance.active_siege_id FK 추가 ──
-- (컬럼 자체는 084에서 이미 생성됨)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sector_governance_active_siege_id_fkey'
  ) THEN
    ALTER TABLE sector_governance
      ADD CONSTRAINT sector_governance_active_siege_id_fkey
      FOREIGN KEY (active_siege_id) REFERENCES governor_sieges(id);
  END IF;
END $$;

-- ── 4. settings 추가 ──
INSERT INTO settings (key, value, description) VALUES
  ('siege_declaration_cost_gp', '100',  'Siege 선언 비용 GP'),
  ('siege_warning_hours',        '48',   'Siege 예고 기간 (시간)'),
  ('siege_battle_hours',         '24',   'Siege 전투 기간 (시간)'),
  ('siege_min_territories',      '3',    'Siege 선언 최소 영토 수'),
  ('governor_max_tax_rate',      '10',   'Governor 최대 세율 (%)'),
  ('governor_market_cut',        '0.01', 'Governor 마켓 수수료 비율'),
  ('governor_declaration_cost_gp','5',   'Governor 선언문 작성 비용 GP')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   ALTER TABLE sector_governance DROP CONSTRAINT IF EXISTS sector_governance_active_siege_id_fkey;
--   DROP TABLE IF EXISTS governor_hall_of_fame;
--   DROP TABLE IF EXISTS governor_sieges;
--   DELETE FROM settings WHERE key IN (
--     'siege_declaration_cost_gp','siege_warning_hours','siege_battle_hours',
--     'siege_min_territories','governor_max_tax_rate','governor_market_cut',
--     'governor_declaration_cost_gp'
--   );
-- ============================================================

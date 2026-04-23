-- ============================================================
-- Migration 092: Ship Construction
--
-- Players build ships using GP (+ optional resources later).
-- Ships form a fleet used in battles (Migration 093).
-- ⚠️  wallet-based — no users.id
-- ============================================================

-- ── 1. user_ships ──
CREATE TABLE IF NOT EXISTS user_ships (
  id                SERIAL PRIMARY KEY,
  wallet_address    VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  ship_type         VARCHAR(30) NOT NULL,
  level             INT NOT NULL DEFAULT 1,
  hp                INT NOT NULL DEFAULT 100,
  max_hp            INT NOT NULL DEFAULT 100,
  attack            INT NOT NULL DEFAULT 10,
  defense           INT NOT NULL DEFAULT 5,
  speed             INT NOT NULL DEFAULT 5,
  status            VARCHAR(20) NOT NULL DEFAULT 'docked'
                      CHECK (status IN ('docked','deployed','repairing','destroyed')),
  build_cost_gp     INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  last_repaired_at  TIMESTAMP,
  destroyed_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_ships_wallet  ON user_ships(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_user_ships_type    ON user_ships(ship_type);

-- ── 2. ship_build_log ──
CREATE TABLE IF NOT EXISTS ship_build_log (
  id              SERIAL PRIMARY KEY,
  wallet_address  VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  ship_type       VARCHAR(30) NOT NULL,
  gp_cost         INT NOT NULL,
  result          VARCHAR(20) NOT NULL DEFAULT 'built', -- built / destroyed
  ship_id         INT REFERENCES user_ships(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_log_wallet ON ship_build_log(wallet_address);

-- ── 3. Settings ──
INSERT INTO settings (key, value, description, category) VALUES
  ('ship_enabled',           'true', '함선 건조 시스템 활성화', 'ships'),
  ('ship_max_fleet_size',    '10',   '플레이어당 최대 함선 수', 'ships'),
  ('ship_repair_pct',        '30',   '수리 비용 (건조비의 %)', 'ships'),
  ('ship_fishing_gp',        '50',   '어선 건조비 GP', 'ships'),
  ('ship_container_gp',      '80',   '컨테이너선 건조비 GP', 'ships'),
  ('ship_explorer_gp',       '120',  '탐험선 건조비 GP', 'ships'),
  ('ship_tugboat_gp',        '60',   '예인선 건조비 GP', 'ships'),
  ('ship_dreadnought_gp',    '500',  '드레드노트 건조비 GP', 'ships'),
  ('ship_drilling_gp',       '200',  '시추선 건조비 GP', 'ships'),
  ('ship_speedboat_gp',      '90',   '스피드보트 건조비 GP', 'ships'),
  ('ship_survey_gp',         '150',  '측량선 건조비 GP', 'ships'),
  ('ship_galleon_gp',        '300',  '갈레온 건조비 GP', 'ships'),
  ('ship_submarine_gp',      '400',  '잠수함 건조비 GP', 'ships')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS ship_build_log;
--   DROP TABLE IF EXISTS user_ships;
--   DELETE FROM settings WHERE category = 'ships';
-- ============================================================

-- ============================================================
-- Migration 088: Hall of Fame & User Titles
--
-- ⚠️  users 테이블에 id 컬럼이 없음 (PK = wallet_address)
--     → user_id INT 대신 user_wallet VARCHAR(42) 사용
-- ============================================================

-- ── 1. hall_of_fame 테이블 ──
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(60) NOT NULL,           -- 'top_territory' | 'top_governor' | 'top_killer' | ...
  user_wallet     VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  guild_id        INT REFERENCES guilds(id) ON DELETE SET NULL,
  sector_code     VARCHAR(30),
  value_numeric   DECIMAL(20,8),
  description_en  TEXT,
  description_ko  TEXT,
  description_ja  TEXT,
  description_zh  TEXT,
  achieved_at     TIMESTAMP DEFAULT NOW(),
  season_id       INT,
  is_all_time     BOOLEAN DEFAULT FALSE,
  is_featured     BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_hof_category   ON hall_of_fame(category, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_hof_wallet      ON hall_of_fame(user_wallet);
CREATE INDEX IF NOT EXISTS idx_hof_season      ON hall_of_fame(season_id, category);

-- ── 2. user_titles 테이블 ──
CREATE TABLE IF NOT EXISTS user_titles (
  id          SERIAL PRIMARY KEY,
  user_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  title_code  VARCHAR(50) NOT NULL,
  title_en    VARCHAR(100),
  title_ko    VARCHAR(100),
  title_ja    VARCHAR(100),
  title_zh    VARCHAR(100),
  earned_at   TIMESTAMP DEFAULT NOW(),
  is_equipped BOOLEAN DEFAULT FALSE,
  season_id   INT,
  UNIQUE(user_wallet, title_code)
);

CREATE INDEX IF NOT EXISTS idx_titles_wallet ON user_titles(user_wallet);

-- ── 3. 칭호 장착 비용 settings ──
INSERT INTO settings (key, value, description) VALUES
  ('title_equip_cost_gp', '20', '칭호 장착 비용 GP')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS user_titles;
--   DROP TABLE IF EXISTS hall_of_fame;
--   DELETE FROM settings WHERE key = 'title_equip_cost_gp';
-- ============================================================

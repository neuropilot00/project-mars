-- ============================================================
-- Migration 087: Territory War Betting (BIBLE Migration 087)
--
-- ⚠️  users 테이블에 id 컬럼이 없음 (PK = wallet_address)
--     → user_id 대신 user_wallet VARCHAR(42) 사용
-- ============================================================

-- ── 1. war_bet_events 테이블 ──
CREATE TABLE IF NOT EXISTS war_bet_events (
  id              SERIAL PRIMARY KEY,
  event_type      VARCHAR(30) NOT NULL,           -- 'siege' | 'guild_war' | 'custom'
  event_id        INT NOT NULL,                   -- 관련 siege_id 또는 guild_war_id
  option_a_label  VARCHAR(100),                   -- 도전자 이름
  option_b_label  VARCHAR(100),                   -- 수비자 이름
  total_bet_a     BIGINT DEFAULT 0,               -- A팀 총 베팅 GP
  total_bet_b     BIGINT DEFAULT 0,               -- B팀 총 베팅 GP
  status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open','closed','resolved','cancelled')),
  winner_option   VARCHAR(5),                     -- 'a' | 'b'
  opens_at        TIMESTAMP DEFAULT NOW(),
  closes_at       TIMESTAMP,
  resolved_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bet_events_status
  ON war_bet_events(event_type, status, closes_at);

-- ── 2. war_bets 테이블 ──
CREATE TABLE IF NOT EXISTS war_bets (
  id          SERIAL PRIMARY KEY,
  event_id    INT NOT NULL REFERENCES war_bet_events(id) ON DELETE CASCADE,
  user_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  option      VARCHAR(5) NOT NULL CHECK (option IN ('a','b')),
  amount_gp   INT NOT NULL CHECK (amount_gp > 0),
  status      VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','won','lost','refunded')),
  payout_gp   INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_war_bets_event    ON war_bets(event_id);
CREATE INDEX IF NOT EXISTS idx_war_bets_user     ON war_bets(user_wallet);
CREATE UNIQUE INDEX IF NOT EXISTS idx_war_bets_user_event
  ON war_bets(event_id, user_wallet); -- 이벤트당 한 번만 베팅 허용

-- ── 3. governor_sieges에 betting_event_id 컬럼 추가 ──
ALTER TABLE governor_sieges
  ADD COLUMN IF NOT EXISTS betting_event_id INT REFERENCES war_bet_events(id);

-- ── 4. settings 추가 ──
INSERT INTO settings (key, value, description) VALUES
  ('war_betting_enabled',     'false', 'War Betting 기능 활성화'),
  ('war_betting_min_gp',      '10',   '최소 베팅 GP'),
  ('war_betting_max_gp',      '1000', '최대 베팅 GP'),
  ('war_betting_house_edge',  '0.05', '하우스 엣지 (5%)'),
  ('war_betting_max_per_user','3',    '유저당 최대 동시 베팅 수')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   ALTER TABLE governor_sieges DROP COLUMN IF EXISTS betting_event_id;
--   DROP TABLE IF EXISTS war_bets;
--   DROP TABLE IF EXISTS war_bet_events;
--   DELETE FROM settings WHERE key IN (
--     'war_betting_enabled','war_betting_min_gp','war_betting_max_gp',
--     'war_betting_house_edge','war_betting_max_per_user'
--   );
-- ============================================================

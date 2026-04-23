-- ============================================================
-- Migration 086: Chronicle Engine (BIBLE Migration 083)
--
-- ⚠️  users 테이블에 id 컬럼이 없음 (PK = wallet_address)
--     → actor_id/target_id 대신 actor_wallet/target_wallet 사용
-- ============================================================

-- ── 1. server_chronicles 테이블 ──
CREATE TABLE IF NOT EXISTS server_chronicles (
  id             SERIAL PRIMARY KEY,
  event_type     VARCHAR(50) NOT NULL,
  actor_wallet   VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  target_wallet  VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  guild_id       INT REFERENCES guilds(id) ON DELETE SET NULL,
  sector_code    VARCHAR(30),
  value_pp       DECIMAL(20,8),
  value_gp       DECIMAL(20,8),
  extra_data     JSONB DEFAULT '{}',
  title_en       VARCHAR(300),
  title_ko       VARCHAR(300),
  title_ja       VARCHAR(300),
  title_zh       VARCHAR(300),
  body_en        TEXT,
  is_public      BOOLEAN DEFAULT TRUE,
  webhook_sent   BOOLEAN DEFAULT FALSE,
  occurred_at    TIMESTAMP DEFAULT NOW(),
  season_id      INT
);

CREATE INDEX IF NOT EXISTS idx_chronicles_event
  ON server_chronicles(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicles_actor
  ON server_chronicles(actor_wallet, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicles_public
  ON server_chronicles(is_public, occurred_at DESC);

-- ── 2. settings 추가 ──
INSERT INTO settings (key, value, description) VALUES
  ('chronicle_hijack_min_pp', '500',  'Chronicle 기록 최소 Hijack PP 금액'),
  ('chronicle_siege_min_p',   '5',    'Chronicle 기록 최소 Siege 참가자 수'),
  ('discord_webhook_url',     '""',   'Discord Webhook URL (빈 문자열 = 비활성)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS server_chronicles;
--   DELETE FROM settings WHERE key IN (
--     'chronicle_hijack_min_pp','chronicle_siege_min_p','discord_webhook_url'
--   );
-- ============================================================

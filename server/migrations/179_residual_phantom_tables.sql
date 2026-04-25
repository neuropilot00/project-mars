-- ═══════════════════════════════════════════════════
-- 179: 잔여 phantom 테이블 (lottery / dividends / news)
-- ═══════════════════════════════════════════════════
-- Migration 178에서 제외됐던 3개 라이브 기능의 누락 테이블.
-- 모두 index.html에서 fetch 호출 확인됨 (live).
--   /api/lottery/{current,buy}  — 복권
--   /api/dividends/info         — 주간 배당 (스테이커 대상)
--   /api/news?limit=30          — 행성 뉴스 피드
--
-- Idempotent — CREATE TABLE IF NOT EXISTS.

BEGIN;

-- ─── lottery (services/lottery.js, 1분 스케줄러) ──────────────
CREATE TABLE IF NOT EXISTS lottery_rounds (
  id                     BIGSERIAL PRIMARY KEY,
  round_number           INTEGER NOT NULL,
  ticket_price_gp        NUMERIC(20,6) NOT NULL,
  ticket_count           INTEGER NOT NULL DEFAULT 0,
  prize_pool_gp          NUMERIC(20,6) NOT NULL DEFAULT 0,
  status                 VARCHAR(16) NOT NULL DEFAULT 'open',  -- open / drawn / cancelled
  ends_at                TIMESTAMPTZ NOT NULL,
  drawn_at               TIMESTAMPTZ,
  winner_wallet          VARCHAR(42),
  winning_ticket_number  INTEGER,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lottery_rounds_round_number ON lottery_rounds(round_number);
CREATE INDEX IF NOT EXISTS idx_lottery_rounds_status_ends_at ON lottery_rounds(status, ends_at);

CREATE TABLE IF NOT EXISTS lottery_tickets (
  id             BIGSERIAL PRIMARY KEY,
  round_id       BIGINT NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  wallet         VARCHAR(42) NOT NULL,
  ticket_number  INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (round_id, ticket_number)
);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_round_wallet ON lottery_tickets(round_id, wallet);

-- ─── dividends (services/dividends.js, 6h 스케줄러) ───────────
CREATE TABLE IF NOT EXISTS gp_dividend_pool (
  id               BIGSERIAL PRIMARY KEY,
  week_start       DATE NOT NULL UNIQUE,
  pool_gp          NUMERIC(20,6) NOT NULL DEFAULT 0,
  is_distributed   BOOLEAN NOT NULL DEFAULT false,
  distributed_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gp_dividend_claims (
  pool_id        BIGINT NOT NULL REFERENCES gp_dividend_pool(id) ON DELETE CASCADE,
  wallet         VARCHAR(42) NOT NULL,
  stake_weight   NUMERIC(20,6) NOT NULL,
  dividend_gp    NUMERIC(20,6) NOT NULL,
  claimed        BOOLEAN NOT NULL DEFAULT false,
  claimed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_gp_dividend_claims_wallet ON gp_dividend_claims(wallet);

-- ─── news (services/news.js, 24h cleanup) ─────────────────────
CREATE TABLE IF NOT EXISTS planet_news (
  id          BIGSERIAL PRIMARY KEY,
  event_type  VARCHAR(64) NOT NULL,
  headline    TEXT NOT NULL,
  wallet      VARCHAR(42),
  wallet2     VARCHAR(42),
  amount      NUMERIC(20,6),
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planet_news_created ON planet_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planet_news_event_type ON planet_news(event_type);

INSERT INTO schema_migrations (filename) VALUES ('179_residual_phantom_tables.sql')
ON CONFLICT DO NOTHING;

COMMIT;

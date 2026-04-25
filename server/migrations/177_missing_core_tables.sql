-- ═══════════════════════════════════════════════════
-- 177: 누락된 핵심 테이블 일괄 생성 (silent 실패 복구)
-- ═══════════════════════════════════════════════════
-- 다수 서비스가 INSERT/SELECT 하지만 실제로는 존재하지 않던 테이블들.
-- 결과: GP 활동 로그가 모두 유실되고, Colony Prestige(플레이어 랭크)
-- 시스템이 동작하지 않았음.
--
-- 추가 테이블:
--   1) gp_activity_log    — db.js의 logGPActivity() 대상 (감사 로그)
--   2) gp_transactions    — 30+ 서비스가 직접 INSERT (호환 컬럼명 모두 지원)
--   3) colony_prestige    — 플레이어 랭크 시스템 (commit da123c4)
--   4) prestige_log       — 플레이어 랭크 변경 감사 로그
--
-- 참고: territory_prestige(클레임 티어)는 이미 존재. 이 마이그레이션은
-- 'colony'(=플레이어 단위) 쪽만 생성.

-- ── 1) gp_activity_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gp_activity_log (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  delta       NUMERIC(20,6) NOT NULL,   -- + 충전 / - 차감
  source      VARCHAR(64),              -- 'hijack_attack', 'craft', 'shop' 등
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gp_activity_log_wallet_created
  ON gp_activity_log(wallet, created_at DESC);

-- ── 2) gp_transactions ─────────────────────────────────────────────
-- 서비스마다 컬럼명 불일치 (type vs transaction_type, note vs description)
-- → 모두 허용하도록 양쪽 컬럼 + ref_id 포함.
CREATE TABLE IF NOT EXISTS gp_transactions (
  id                BIGSERIAL PRIMARY KEY,
  wallet            VARCHAR(42) NOT NULL,
  amount            NUMERIC(20,6) NOT NULL,
  type              VARCHAR(64),         -- 일부 서비스가 사용
  transaction_type  VARCHAR(64),         -- 다른 서비스가 사용
  note              TEXT,
  description       TEXT,
  ref_id            BIGINT,              -- 연관된 외부 ID (선택)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gp_transactions_wallet_created
  ON gp_transactions(wallet, created_at DESC);

-- ── 3) colony_prestige ────────────────────────────────────────────
-- 플레이어 단위 prestige (territory_prestige는 클레임 단위, 별개)
CREATE TABLE IF NOT EXISTS colony_prestige (
  wallet            VARCHAR(42) PRIMARY KEY,
  prestige_points   INTEGER     NOT NULL DEFAULT 0,
  prestige_rank     SMALLINT    NOT NULL DEFAULT 0,  -- 0=Colonist, 1=Pioneer, 2=Explorer, 3=Commander, 4=Governor, 5=Admiral
  total_gp_spent    NUMERIC(20,6) NOT NULL DEFAULT 0,
  last_upgrade      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4) prestige_log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prestige_log (
  id              BIGSERIAL PRIMARY KEY,
  wallet          VARCHAR(42) NOT NULL,
  gp_spent        NUMERIC(20,6) NOT NULL,
  points_gained   INTEGER NOT NULL,
  old_rank        SMALLINT,
  new_rank        SMALLINT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prestige_log_wallet_created
  ON prestige_log(wallet, created_at DESC);

-- ── schema_migrations ──────────────────────────────────────────
INSERT INTO schema_migrations (filename) VALUES ('177_missing_core_tables.sql')
ON CONFLICT DO NOTHING;

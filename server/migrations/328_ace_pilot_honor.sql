-- ============================================================
-- 328_ace_pilot_honor.sql
-- ACE 명예 시스템 — 클라 ACE 미니게임 결과 기록(코스메틱 전용).
--   경제 무접촉: GP/PP/USDT/보상/솔벤시/전투 승패에 0 영향.
--   칭호는 기존 user_titles(title.js) 재사용 — 새 칭호 시스템 발명 없음.
--   위조내성: 보고값은 settings 임계값으로 CLAMP, 칭호는 누적 임계 기반.
-- ============================================================

-- ── 1. ace_runs — 런 단위 원장 (감사/이상탐지용) ──
CREATE TABLE IF NOT EXISTS ace_runs (
  id                    BIGSERIAL PRIMARY KEY,
  wallet                VARCHAR(42) NOT NULL,
  battle_id             BIGINT,                                  -- battle 모드면 fleet_battles.id, demo면 NULL (FK 미설정: 삭제전투 참조무결성 회피)
  mode                  VARCHAR(10) NOT NULL DEFAULT 'demo' CHECK (mode IN ('battle','demo')),
  outcome               VARCHAR(8)  NOT NULL CHECK (outcome IN ('win','loss')),
  kills                 INT NOT NULL DEFAULT 0,                  -- CLAMP 후 저장값
  duration_sec          INT NOT NULL DEFAULT 0,                  -- CLAMP 후 저장값
  reported_kills        INT,                                     -- 원본(신뢰 안 함, 사후 이상탐지용)
  reported_duration_sec INT,                                     -- 원본
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ace_runs_wallet_created ON ace_runs(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ace_runs_created        ON ace_runs(created_at DESC);

-- ── 2. ace_pilot_stats — 지갑별 누적 (칭호 임계 판정 단일 소스) ──
CREATE TABLE IF NOT EXISTS ace_pilot_stats (
  wallet            VARCHAR(42) PRIMARY KEY,
  total_runs        INT    DEFAULT 0,
  total_wins        INT    DEFAULT 0,
  total_kills       BIGINT DEFAULT 0,
  best_kills        INT    DEFAULT 0,
  best_duration_sec INT    DEFAULT 0,
  last_run_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ace_stats_kills ON ace_pilot_stats(total_kills DESC);
CREATE INDEX IF NOT EXISTS idx_ace_stats_wins  ON ace_pilot_stats(total_wins DESC);

-- ── 3. settings — 클램프 상한/칭호 임계값 (하드코딩 금지) ──
INSERT INTO settings (category, key, value, description) VALUES
  ('ace', 'ace_max_kills_per_run',      '100',  'ACE 런 1회 kills 클램프 상한 (위조 폭주 방지)'),
  ('ace', 'ace_max_duration_sec',       '1800', 'ACE 런 duration_sec 클램프 상한'),
  ('ace', 'ace_min_duration_sec',       '3',    'ACE 런 duration_sec 클램프 하한'),
  ('ace', 'ace_title_runs_threshold',   '1',    'ace_recruit 칭호: 누적 런 임계 (참여 기반)'),
  ('ace', 'ace_title_kills_threshold',  '200',  'ace_pilot 칭호: 누적 kills 임계 (누적, 1회 위조 무의미)'),
  ('ace', 'ace_title_wins_threshold',   '25',   'ace_veteran 칭호: 누적 wins 임계'),
  ('ace', 'ace_title_topgun_kills',     '1000', 'top_gun 칭호: 누적 kills 임계 (장기 헌신)'),
  ('ace', 'ace_title_doubleace_wins',   '100',  'ace_ace(DOUBLE ACE) 칭호: 누적 wins 임계 (최상위)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('328_ace_pilot_honor.sql') ON CONFLICT DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS ace_runs;
--   DROP TABLE IF EXISTS ace_pilot_stats;
--   DELETE FROM settings WHERE category = 'ace';
--   DELETE FROM schema_migrations WHERE filename = '328_ace_pilot_honor.sql';
-- ============================================================

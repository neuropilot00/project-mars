-- Migration 233: 동적 PP↔GP 환율 (수급 기반 밴딩) — 기본 OFF
-- ───────────────────────────────────────────────────────────────────────────
-- 고정 환율(pp_to_gp_exchange_rate='10')을 24h 환전 수요(D)에 따라 자동 밴딩.
-- D > 목표 → GP 수요 과열 → rate↓(PP당 GP 적게) → GP 인플레 억제.
-- D < 목표 → rate↑(ceil 한도). 1회 변동 ≤ max_step_pct, [floor, ceil] 하드밴드로
-- 봇 단일 펌핑 방어. 스케줄러 1h 주기(RUN_SCHEDULERS 게이트). 기본 OFF.

CREATE TABLE IF NOT EXISTS pp_gp_rate_history (
  id               BIGSERIAL PRIMARY KEY,
  rate             NUMERIC(12,4) NOT NULL,
  prev_rate        NUMERIC(12,4),
  exchange_vol_24h NUMERIC(20,6) DEFAULT 0,
  vol_target       NUMERIC(20,6) DEFAULT 0,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pp_gp_rate_history_time ON pp_gp_rate_history (computed_at DESC);

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'pp_to_gp_dynamic_enabled',          'false', '동적 PP→GP 환율 활성화(기본 OFF=고정 rate)'),
  ('economy', 'pp_to_gp_rate_floor',               '5',     'PP→GP 환율 하한'),
  ('economy', 'pp_to_gp_rate_ceil',                '20',    'PP→GP 환율 상한'),
  ('economy', 'pp_to_gp_rate_max_step_pct',        '2',     '환율 1회 최대 변동률(%)'),
  ('economy', 'pp_to_gp_exchange_daily_vol_target','1000',  '24h PP→GP 환전 목표 거래량(밴딩 기준)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('233_dynamic_pp_gp_exchange.sql') ON CONFLICT DO NOTHING;

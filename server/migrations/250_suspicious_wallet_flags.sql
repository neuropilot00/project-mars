-- 250_suspicious_wallet_flags.sql
-- 자기거래(self-trade) chain 분석 — A→B→A 폐쇄 루프로 수수료/보너스 짜내는 패턴 감지 스캐폴드.
-- 기존 1차원 sybil 가드(가입일/입금/추천 수)는 못 잡는 2차 그래프(연결 wallet 관계).
-- 일일 스케줄러가 분석 결과를 이 테이블에 적립 → 운영자가 검토 후 가드 액션(차단/한도/관찰).

CREATE TABLE IF NOT EXISTS suspicious_wallet_flags (
  id BIGSERIAL PRIMARY KEY,
  wallet           TEXT NOT NULL,                 -- 의심 wallet (보통 두 wallet 중 하나)
  pair_wallet      TEXT,                          -- 폐쇄 루프 상대방
  flag_type        TEXT NOT NULL,                 -- 'self_trade_loop', 'referral_self', 'rapid_market_flip' 등
  severity         INTEGER NOT NULL DEFAULT 1,    -- 1~5 (5=가장 의심)
  evidence         JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed         BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  action_taken     TEXT,
  UNIQUE (wallet, pair_wallet, flag_type)         -- 같은 쌍·유형은 한 번만(severity·evidence 업데이트)
);
CREATE INDEX IF NOT EXISTS idx_susp_wallet ON suspicious_wallet_flags(wallet, reviewed);
CREATE INDEX IF NOT EXISTS idx_susp_detected ON suspicious_wallet_flags(detected_at DESC);

-- 운영자 설정 — 감지 임계값
INSERT INTO settings (category, key, value, description) VALUES
  ('sybil', 'self_trade_window_days', '7', '자기거래 chain 분석 시간 윈도우(일)'),
  ('sybil', 'self_trade_min_pairs', '3', '의심 판정 최소 폐쇄 루프 수(이 윈도우 내 동일 쌍 거래 횟수)'),
  ('sybil', 'self_trade_min_value', '100', '의심 판정 최소 거래액(GP, 누적 기준)'),
  ('sybil', 'sybil_detect_enabled', 'true', '자기거래 chain 감지 스케줄러 활성화')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('250_suspicious_wallet_flags.sql') ON CONFLICT DO NOTHING;

-- [v7.192 F4] Wash-trade 탐지 인프라
-- 목적: 마켓에서 같은 유저가 다른 wallet (또는 같은 IP/추천 체인) 끼리 함선/자원을 매수/매도 반복해
--       referral 커미션 farming / fee waste 익스플로잇 차단.
--
-- 동작:
--   1) ship_market_sale_log / marketplace_listings sold event 발생 시 wash-trade scorer 호출
--   2) buyer/seller 의 IP 같음, 또는 추천 체인이 겹침, 또는 12시간 안 양방향 거래 N회 이상이면 플래그
--   3) suspicious_wallet_flags 에 'wash_trade' reason 기록 — 어드민 대시보드에 노출
--   4) reward (referral 커미션) 자체는 차단하지 않음 (자동 차단은 정상 거래도 잡을 수 있어 위험).
--      대신 어드민 검수 후 수동 처리. 자동 차단은 추후 규칙 정착되면 활성화.
--
-- 운영자에게:
--   * 임계값은 settings.wash_trade_window_hours / wash_trade_min_swaps 로 조정
--   * sybilDetect 와 비슷한 cron 으로 6시간 마다 sweep 가능 (별도 스크립트)

CREATE TABLE IF NOT EXISTS wash_trade_observations (
  id BIGSERIAL PRIMARY KEY,
  buyer_wallet TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  asset_type TEXT NOT NULL,        -- 'ship' | 'cosmetic' | 'resource' | 'territory'
  asset_id BIGINT,
  price_gp NUMERIC,
  shared_ip TEXT,                  -- buyer/seller 의 같은 IP (null = 다름)
  shared_referrer TEXT,            -- 같은 추천 체인 wallet (null = 다름)
  reciprocal_window BOOLEAN,       -- 12h 안 양방향 거래 있었는지
  score INTEGER NOT NULL DEFAULT 0, -- 0~100. 합산 (shared_ip=40, shared_referrer=30, reciprocal=30)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wash_buyer  ON wash_trade_observations (buyer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wash_seller ON wash_trade_observations (seller_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wash_score  ON wash_trade_observations (score DESC, created_at DESC);

-- Settings
INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'wash_trade_window_hours',   '12',  '양방향 거래 reciprocal 윈도(시간)'),
  ('economy', 'wash_trade_min_score',      '60',  '의심 플래그 자동 부여 임계 (0~100)'),
  ('economy', 'wash_trade_min_swaps',      '3',   'reciprocal 거래 최소 횟수')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('253_wash_trade_detection.sql') ON CONFLICT DO NOTHING;

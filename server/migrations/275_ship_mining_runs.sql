-- 275_ship_mining_runs.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 P5 — 함선 채굴 런 (EVE식 함선 채굴). 땅 없는 F2P 유저의 노가다 수급 루프.
--   땅(영토) 불필요. 함대를 채굴 런에 보내면 일정 시간 점유되고, 복귀(collect) 시
--   재료(rollResourceDrop) + GP 를 수급한다. PP는 안 줌(무료 PP 폐지 정책 일관).
--   사다리: 함선 채굴 → 재료/GP → (경매서 GP로 PP 구입) → 땅 구매 → 상위.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ship_mining_jobs (
  id             SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  fleet_id       INTEGER NOT NULL,
  ship_count     INTEGER NOT NULL DEFAULT 1,
  sector_type    TEXT NOT NULL DEFAULT 'frontier',   -- frontier|mid|core (드롭 테이블 키)
  duration_h     NUMERIC NOT NULL DEFAULT 1,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at        TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'mining',      -- mining|collected|cancelled
  reward_gp      NUMERIC,
  reward_resources JSONB,
  collected_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ship_mining_wallet ON ship_mining_jobs (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_ship_mining_fleet_active ON ship_mining_jobs (fleet_id) WHERE status = 'mining';

INSERT INTO settings (category, key, value, description) VALUES
  ('mining', 'ship_mining_enabled', 'true', '함선 채굴 런 on/off (땅 없는 F2P 수급).'),
  ('mining', 'ship_mining_durations_h', '[1,4,8]', '선택 가능한 채굴 런 시간(시간) 목록(JSON).'),
  ('mining', 'ship_mining_gp_per_ship_h', '5', '채굴 런 GP 보상 = 살아있는 함선수 × 시간 × 이 값.'),
  ('mining', 'ship_mining_max_per_wallet', '3', '동시 진행 가능한 채굴 런 수(지갑당).'),
  ('mining', 'ship_mining_resource_rolls_per_4h', '1', '4시간당 재료 드롭 roll 횟수(시간 비례, 최소 1).'),
  ('mining', 'ship_mining_launch_cost_gp', '0', '채굴 런 출항 비용 GP(0=무료, F2P 노가다).')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('275_ship_mining_runs.sql')
ON CONFLICT DO NOTHING;

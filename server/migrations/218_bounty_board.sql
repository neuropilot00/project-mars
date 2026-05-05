-- Migration 218: 현상금 게시판 (Bounty Board)
-- 플레이어가 특정 상대에게 현상금을 걸고, 다른 플레이어가 전투 승리 후 수령

CREATE TABLE IF NOT EXISTS bounty_listings (
  id SERIAL PRIMARY KEY,
  poster_wallet VARCHAR(100) NOT NULL,
  target_wallet VARCHAR(100) NOT NULL,
  reward_gp INT NOT NULL CHECK (reward_gp > 0),
  reason VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active/claimed/expired/cancelled
  claimed_by VARCHAR(100),
  claim_battle_id INT REFERENCES fleet_battles(id),
  claimed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bounty_status ON bounty_listings(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_bounty_target ON bounty_listings(target_wallet, status);
CREATE INDEX IF NOT EXISTS idx_bounty_poster ON bounty_listings(poster_wallet);

-- 설정
INSERT INTO settings (category, key, value, description) VALUES
  ('bounty', 'min_bounty_gp',       '100',  '현상금 최소 금액 GP'),
  ('bounty', 'max_bounty_gp',       '10000','현상금 최대 금액 GP'),
  ('bounty', 'expiry_days',         '7',    '현상금 만료일 (일)'),
  ('bounty', 'platform_fee_pct',    '5',    '현상금 수령 시 플랫폼 수수료 %'),
  ('bounty', 'max_bounties_per_poster', '3','한 유저가 동시에 걸 수 있는 현상금 수'),
  ('bounty', 'enabled',             'true', '현상금 시스템 활성화')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('218_bounty_board.sql') ON CONFLICT DO NOTHING;

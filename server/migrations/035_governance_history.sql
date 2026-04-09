-- Governance history: tracks all governor/commander tenures for leaderboard + hall of fame

CREATE TABLE IF NOT EXISTS governance_history (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  role VARCHAR(20) NOT NULL,          -- governor, vice_governor, commander, vice_commander
  sector_id INT DEFAULT NULL,         -- NULL for commander/vice_commander
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ DEFAULT NULL,  -- NULL = currently active
  total_tax_earned DECIMAL(14,2) DEFAULT 0,
  tenure_seconds INT DEFAULT 0,       -- computed on end
  CONSTRAINT fk_gh_sector FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gov_history_wallet ON governance_history(wallet);
CREATE INDEX IF NOT EXISTS idx_gov_history_sector ON governance_history(sector_id) WHERE sector_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gov_history_active ON governance_history(ended_at) WHERE ended_at IS NULL;

-- 026_battles.sql
-- Battle system: attack results when claiming overlapping territory

CREATE TABLE IF NOT EXISTS battles (
  id SERIAL PRIMARY KEY,
  attacker VARCHAR(42) NOT NULL,
  defender VARCHAR(42) NOT NULL,
  claim_id INT,
  pixels_attacked INT NOT NULL DEFAULT 0,
  pixels_won INT NOT NULL DEFAULT 0,
  pixels_lost INT NOT NULL DEFAULT 0,
  attack_cost DECIMAL(20,6) DEFAULT 0,
  refund_amount DECIMAL(20,6) DEFAULT 0,
  platform_fee DECIMAL(20,6) DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attacker);
CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defender);
CREATE INDEX IF NOT EXISTS idx_battles_claim ON battles(claim_id);

-- User-level active item effects (attack_boost, stealth_cloak, etc.)
-- Two modes: duration-based (expires_at) and uses-based (uses_remaining)

CREATE TABLE IF NOT EXISTS user_active_effects (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  effect_type VARCHAR(30) NOT NULL,
  effect_value DECIMAL(8,2) NOT NULL DEFAULT 0,
  uses_remaining INT DEFAULT NULL,         -- NULL = duration-based, >0 = uses-based
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,     -- NULL = uses-based (no time limit)
  active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_effects_active ON user_active_effects(wallet, active) WHERE active = true;

-- Auto-expire old effects on insert (cleanup)
-- We'll handle expiry checks in app logic

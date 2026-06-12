-- Track request-time settlement for time-based active item effects.
ALTER TABLE user_active_effects
  ADD COLUMN IF NOT EXISTS last_settled_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_effects_gp_generator_settle
  ON user_active_effects(wallet, effect_type, active, expires_at)
  WHERE active = true AND effect_type = 'gp_generator';

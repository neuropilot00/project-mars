-- Enhancement system: upgrade cosmetic items from +0 to +10

CREATE TABLE IF NOT EXISTS enhancement_log (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES item_instances(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  from_level INT NOT NULL,
  to_level INT NOT NULL,
  success BOOLEAN NOT NULL,
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('success','stay','downgrade','destroy')),
  gp_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enhancement_log_wallet ON enhancement_log(wallet);
CREATE INDEX IF NOT EXISTS idx_enhancement_log_instance ON enhancement_log(instance_id);

-- Enhancement settings
INSERT INTO settings (key, value, description, category) VALUES
  ('enhance_enabled', 'true', 'Enable/disable item enhancement system', 'enhancement'),
  ('enhance_base_cost_gp', '50', 'GP cost for +0 to +1 enhancement attempt', 'enhancement'),
  ('enhance_cost_multiplier', '1.8', 'Cost multiplier per level (cost = base * mult^level)', 'enhancement'),
  ('enhance_success_rates', '[95,90,80,70,55,40,30,20,12,7]', 'Success rate % per level (index 0 = +0→+1)', 'enhancement'),
  ('enhance_fail_stay_pct', '50', 'On failure: % chance level stays the same', 'enhancement'),
  ('enhance_fail_destroy_pct', '10', 'On failure: % chance item is destroyed (rest = downgrade)', 'enhancement'),
  ('enhance_max_level', '10', 'Maximum enhancement level', 'enhancement'),
  ('enhance_show_rates', 'true', 'Show success rates to players', 'enhancement')
ON CONFLICT (key) DO NOTHING;

-- 060: Launch pads — each mission must originate from a chosen claim
--
-- Player feedback: auto-picking the closest owned pixel as the origin made
-- launches feel indiscriminate ("you could fire dozens at once"). Tying each
-- mission to a specific CLAIM and limiting one mission per claim makes the
-- player commit a real piece of territory as the launch pad — which then
-- visibly draws the route on the map until the mission resolves.

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS origin_claim_id INT REFERENCES claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0;

-- Index to help the "is this pad busy?" lookup
CREATE INDEX IF NOT EXISTS idx_missions_origin_claim_active
  ON missions(origin_claim_id)
  WHERE status IN ('traveling','complete');

-- Tunables for reward scaling by launch-pad pixel count
INSERT INTO settings (key, value, category, description) VALUES
  ('mission_pad_baseline_pixels', '25',  'missions', 'Pad pixel count = 1.0x reward multiplier'),
  ('mission_pad_mult_min',        '0.5', 'missions', 'Min reward multiplier from pad size'),
  ('mission_pad_mult_max',        '3.0', 'missions', 'Max reward multiplier from pad size')
ON CONFLICT (key) DO NOTHING;

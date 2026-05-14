-- Add minimum withdrawal guard setting
INSERT INTO settings (key, value, description, category) VALUES
  ('withdraw_min_amount', '10', 'Minimum allowed withdrawal amount in USDT', 'security')
ON CONFLICT (key) DO NOTHING;

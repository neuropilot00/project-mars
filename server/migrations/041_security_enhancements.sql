-- Security enhancements: withdrawal cooldown + login lockout settings

-- Add last_withdrawal_at column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_withdrawal_at TIMESTAMPTZ;

-- Security settings
INSERT INTO settings (key, value, description, category) VALUES
  ('withdrawal_cooldown_hours', '24', 'Hours between allowed withdrawals (0=disabled)', 'security'),
  ('max_login_attempts', '5', 'Max failed login attempts before lockout', 'security'),
  ('login_lockout_minutes', '30', 'Account lockout duration in minutes after max failed attempts', 'security')
ON CONFLICT (key) DO NOTHING;

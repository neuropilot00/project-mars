-- Admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target VARCHAR(255),
  details JSONB,
  admin_auth VARCHAR(20),
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add withdrawal nonce column
ALTER TABLE users ADD COLUMN IF NOT EXISTS withdrawal_nonce INTEGER DEFAULT 0;

-- Legal compliance: TOS acceptance tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_version VARCHAR(10) DEFAULT '1.0';

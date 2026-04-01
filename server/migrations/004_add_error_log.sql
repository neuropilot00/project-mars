-- Client error reporting table for lightweight Sentry-like monitoring
CREATE TABLE IF NOT EXISTS client_errors (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  source TEXT,
  line INTEGER,
  stack TEXT,
  user_agent TEXT,
  url TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_client_errors_created ON client_errors(created_at DESC);

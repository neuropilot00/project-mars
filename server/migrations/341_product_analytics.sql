-- First-party product analytics. Business events are written by the server after
-- the underlying transaction commits; browsers may submit only session_start/ui_view.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS product_analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_key UUID NOT NULL UNIQUE,
  wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  event_name VARCHAR(48) NOT NULL CHECK (event_name IN (
    'session_start', 'ui_view', 'first_battle_started', 'battle_ended',
    'second_battle_started', 'territory_captured', 'production_collected',
    'repair_completed', 'mission_completed', 'shop_view', 'cosmetic_purchased'
  )),
  source VARCHAR(12) NOT NULL CHECK (source IN ('client', 'server')),
  actor_ai BOOLEAN NOT NULL DEFAULT FALSE,
  actor_test BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_analytics_user_time
  ON product_analytics_events (created_at, wallet_address)
  WHERE actor_ai = FALSE AND actor_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_product_analytics_session_time
  ON product_analytics_events (created_at, session_id)
  WHERE actor_ai = FALSE AND actor_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_product_analytics_event_time
  ON product_analytics_events (event_name, created_at)
  WHERE actor_ai = FALSE AND actor_test = FALSE;

-- ROLLBACK (manual only; do not add to the automatic migration runner):
-- DROP TABLE IF EXISTS product_analytics_events;
-- ALTER TABLE users DROP COLUMN IF EXISTS is_test_account;
-- DELETE FROM schema_migrations WHERE filename = '341_product_analytics.sql';

-- Migration 096: Player Notification System
-- In-game persistent notifications for important game events.
-- (Battle declarations, battle results, marketplace sales, auction outbid/won)

CREATE TABLE IF NOT EXISTS player_notifications (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  type        VARCHAR(50) NOT NULL,   -- 'battle_declared','battle_won','battle_lost','listing_sold','auction_outbid','auction_won'
  message     TEXT        NOT NULL,
  metadata    JSONB       DEFAULT '{}',
  read        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnotif_wallet ON player_notifications(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnotif_unread  ON player_notifications(wallet, read) WHERE read = false;

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('notifications_enabled',      'true', 'Enable in-game player notifications',          'system'),
  ('notifications_max_per_user', '50',   'Maximum stored notifications per player',       'system'),
  ('notifications_ttl_days',     '14',   'Delete notifications older than N days',        'system')
ON CONFLICT (key) DO NOTHING;

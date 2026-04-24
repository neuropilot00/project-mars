-- Migration 148: GP Colony Announcement
-- Players pay GP to broadcast a short message to all active players.
-- The message shows in the global notification banner for a configurable duration.
-- Cost scales with desired broadcast duration.

CREATE TABLE IF NOT EXISTS colony_announcements (
  id          SERIAL       PRIMARY KEY,
  wallet      TEXT         NOT NULL,
  message     VARCHAR(80)  NOT NULL,
  gp_paid     INTEGER      NOT NULL DEFAULT 0,
  duration_m  INTEGER      NOT NULL DEFAULT 30,
  starts_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcement_active ON colony_announcements(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcement_wallet ON colony_announcements(wallet);

-- Settings (column `label` doesn't exist on production — use `description` to match settings schema)
INSERT INTO settings (key, value, category, description) VALUES
  ('announce_enabled',       'true',  'announce', 'Enable Colony Announcements'),
  ('announce_cost_gp',       '80',    'announce', 'GP cost per 30-minute announcement'),
  ('announce_max_length',    '80',    'announce', 'Max message length'),
  ('announce_max_duration_m','180',   'announce', 'Max announcement duration (minutes)'),
  ('announce_cooldown_h',    '6',     'announce', 'Cooldown between announcements (hours, 0=off)'),
  ('announce_max_active',    '3',     'announce', 'Max simultaneous active announcements')
ON CONFLICT (key) DO NOTHING;

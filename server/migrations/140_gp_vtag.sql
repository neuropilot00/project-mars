-- Migration 140: GP Vanity Tag
-- Players pay GP to set a short vanity title/tag (up to 12 chars)
-- shown inline next to their nickname in leaderboard, territory info, capsule feed, etc.
-- First-time set costs X GP; changing costs Y GP.

CREATE TABLE IF NOT EXISTS vanity_tags (
  wallet        TEXT         PRIMARY KEY,
  tag           VARCHAR(12)  NOT NULL,
  gp_paid_total INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vtag_log (
  id         SERIAL       PRIMARY KEY,
  wallet     TEXT         NOT NULL,
  old_tag    TEXT,
  new_tag    TEXT         NOT NULL,
  gp_cost    INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vtag_log_wallet ON vtag_log(wallet);

-- Settings
INSERT INTO settings (key, value, category, description) VALUES
  ('vtag_enabled',    'true', 'vtag', 'Enable Vanity Tag System'),
  ('vtag_first_gp',   '50',   'vtag', 'GP cost for first vanity tag'),
  ('vtag_change_gp',  '25',   'vtag', 'GP cost to change vanity tag'),
  ('vtag_max_length', '12',   'vtag', 'Max vanity tag character length'),
  ('vtag_clear_gp',   '0',    'vtag', 'GP cost to clear vanity tag')
ON CONFLICT (key) DO NOTHING;

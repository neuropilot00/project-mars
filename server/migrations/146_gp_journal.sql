-- Migration 146: GP Colony Journal
-- Players pay GP to publish a permanent journal entry to the colony timeline.
-- Each entry is public and persists indefinitely. Character limit enforced.

CREATE TABLE IF NOT EXISTS colony_journal (
  id          SERIAL       PRIMARY KEY,
  wallet      TEXT         NOT NULL,
  title       VARCHAR(60)  NOT NULL,
  content     VARCHAR(500) NOT NULL,
  gp_paid     INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_wallet ON colony_journal(wallet);
CREATE INDEX IF NOT EXISTS idx_journal_time   ON colony_journal(created_at DESC);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('journal_enabled',       'true', 'journal', 'Enable Colony Journal'),
  ('journal_cost_gp',       '60',   'journal', 'GP cost per journal entry'),
  ('journal_title_max',     '60',   'journal', 'Max title length'),
  ('journal_content_max',   '500',  'journal', 'Max content length'),
  ('journal_cooldown_h',    '24',   'journal', 'Cooldown between entries (hours, 0=off)'),
  ('journal_feed_count',    '20',   'journal', 'Number of entries in public feed')
ON CONFLICT (key) DO NOTHING;

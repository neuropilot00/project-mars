-- Migration 150: GP Colony Milestone
-- Players pay GP to record a personal milestone in the colony's history.
-- Each milestone has a category (CONQUEST/DISCOVERY/LOSS/ALLIANCE/ACHIEVEMENT/LEGACY)
-- and a short description. Visible on the colony timeline.

CREATE TYPE milestone_category AS ENUM (
  'CONQUEST', 'DISCOVERY', 'LOSS', 'ALLIANCE', 'ACHIEVEMENT', 'LEGACY'
);

CREATE TABLE IF NOT EXISTS colony_milestones (
  id          SERIAL              PRIMARY KEY,
  wallet      TEXT                NOT NULL,
  category    milestone_category  NOT NULL DEFAULT 'ACHIEVEMENT',
  title       VARCHAR(50)         NOT NULL,
  description VARCHAR(200)        NOT NULL,
  gp_paid     INTEGER             NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_milestone_wallet   ON colony_milestones(wallet);
CREATE INDEX IF NOT EXISTS idx_milestone_time     ON colony_milestones(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_category ON colony_milestones(category);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('milestone_enabled',      'true', 'milestone', 'Enable Colony Milestones'),
  ('milestone_cost_gp',      '45',   'milestone', 'GP cost per milestone'),
  ('milestone_title_max',    '50',   'milestone', 'Max title length'),
  ('milestone_desc_max',     '200',  'milestone', 'Max description length'),
  ('milestone_cooldown_h',   '12',   'milestone', 'Cooldown between milestones (hours, 0=off)'),
  ('milestone_feed_count',   '30',   'milestone', 'Number of milestones in feed')
ON CONFLICT (key) DO NOTHING;

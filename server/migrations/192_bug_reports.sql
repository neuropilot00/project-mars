-- Migration 192: User-submitted bug reports.
-- Stores in-game bug reports for triage + Claude Code auto-fix pipeline.
-- Each row also gets mirrored to /server/bug-reports/inbox/<id>.json
-- by the bug-report route so a file watcher can hand them to Claude Code.

CREATE TABLE IF NOT EXISTS bug_reports (
  id            BIGSERIAL PRIMARY KEY,
  category      TEXT NOT NULL DEFAULT 'other',
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  wallet        TEXT,
  url           TEXT,
  user_agent    TEXT,
  viewport      JSONB,
  lang          TEXT,
  recent_errors JSONB,
  ip_address    TEXT,
  status        TEXT NOT NULL DEFAULT 'new',
  -- new | triaged | in_progress | fixed | wontfix | duplicate
  claude_notes  TEXT,
  claude_attempts INTEGER NOT NULL DEFAULT 0,
  resolved_commit TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created
  ON bug_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_wallet
  ON bug_reports (wallet) WHERE wallet IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bug_reports_category_status
  ON bug_reports (category, status);

-- Settings for rate limiting + admin gate
INSERT INTO settings (category, key, value, description) VALUES
  ('bug_report', 'bug_report_enabled',         'true',
   'Master switch for the in-game bug report button + endpoint.'),
  ('bug_report', 'bug_report_per_ip_per_hour', '20',
   'Max reports a single IP can submit per hour.'),
  ('bug_report', 'bug_report_inbox_dir',       '"server/bug-reports/inbox"',
   'Filesystem dir where new reports are mirrored as JSON for Claude Code pickup.'),
  ('bug_report', 'bug_report_min_body_chars',  '0',
   'Minimum total chars (title+body) required to accept a report. 0 disables the floor.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('192_bug_reports.sql')
ON CONFLICT DO NOTHING;

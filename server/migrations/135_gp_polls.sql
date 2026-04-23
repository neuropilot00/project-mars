-- Migration 135: GP Community Polls
-- Players spend GP to publish a community poll. Voting is free for all.
-- GP sink: buy attention + community engagement.

CREATE TABLE IF NOT EXISTS gp_polls (
  id          SERIAL PRIMARY KEY,
  wallet      TEXT NOT NULL,
  question    VARCHAR(200) NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',
  gp_cost     INTEGER NOT NULL,
  duration_h  INTEGER NOT NULL DEFAULT 24,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  vote_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id         SERIAL PRIMARY KEY,
  poll_id    INTEGER NOT NULL REFERENCES gp_polls(id) ON DELETE CASCADE,
  wallet     TEXT NOT NULL,
  option_idx INTEGER NOT NULL,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_gp_polls_active  ON gp_polls(is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_gp_polls_wallet  ON gp_polls(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll  ON poll_votes(poll_id);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('poll_enabled',          'true',  'poll'),
  ('poll_cost_gp',          '40',    'poll'),
  ('poll_min_options',      '2',     'poll'),
  ('poll_max_options',      '6',     'poll'),
  ('poll_max_question_len', '200',   'poll'),
  ('poll_max_duration_h',   '168',   'poll'),
  ('poll_min_duration_h',   '1',     'poll'),
  ('poll_max_active',       '10',    'poll'),
  ('poll_cooldown_h',       '2',     'poll')
ON CONFLICT (key) DO NOTHING;

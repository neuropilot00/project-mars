-- Migration 118: Pixel Art Contest System
-- Admin creates themed contests. Players submit pixel art (claim snapshots or canvas URLs).
-- Voting is free or costs a small GP amount. GP prize pool grows from entry fees.
-- Winners split the prize pool by rank (1st/2nd/3rd).

CREATE TABLE IF NOT EXISTS art_contests (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(100)   NOT NULL,
  description     VARCHAR(500),
  theme           VARCHAR(80),
  entry_fee_gp    DECIMAL(20,6)  NOT NULL DEFAULT 0,  -- GP to submit an entry
  vote_fee_gp     DECIMAL(20,6)  NOT NULL DEFAULT 0,  -- GP to cast a vote (0 = free)
  prize_pool_gp   DECIMAL(20,6)  NOT NULL DEFAULT 0,  -- accumulated from entry fees + admin seed
  prize_1st_pct   SMALLINT       NOT NULL DEFAULT 60, -- % of prize pool for 1st
  prize_2nd_pct   SMALLINT       NOT NULL DEFAULT 25,
  prize_3rd_pct   SMALLINT       NOT NULL DEFAULT 15,
  max_entries     INT            NOT NULL DEFAULT 50,
  status          VARCHAR(20)    NOT NULL DEFAULT 'upcoming',
                                                      -- upcoming | open | voting | finished | cancelled
  submission_start TIMESTAMPTZ   NOT NULL,
  submission_end   TIMESTAMPTZ   NOT NULL,
  voting_end       TIMESTAMPTZ   NOT NULL,
  created_by      VARCHAR(100),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS art_entries (
  id              SERIAL PRIMARY KEY,
  contest_id      INT            NOT NULL REFERENCES art_contests(id),
  wallet          VARCHAR(100)   NOT NULL,
  title           VARCHAR(100),
  description     VARCHAR(300),
  image_url       VARCHAR(500),        -- URL to submitted pixel art image
  claim_id        INT,                 -- optional: link to a claim as canvas
  vote_count      INT            NOT NULL DEFAULT 0,
  gp_paid         DECIMAL(20,6)  NOT NULL DEFAULT 0,
  rank            SMALLINT,            -- filled when contest finishes
  prize_paid      DECIMAL(20,6)  NOT NULL DEFAULT 0,
  is_disqualified BOOLEAN        NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (contest_id, wallet)
);

CREATE TABLE IF NOT EXISTS art_votes (
  id          SERIAL PRIMARY KEY,
  contest_id  INT            NOT NULL,
  entry_id    INT            NOT NULL REFERENCES art_entries(id),
  voter       VARCHAR(100)   NOT NULL,
  gp_paid     DECIMAL(20,6)  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (contest_id, voter)  -- one vote per wallet per contest
);

CREATE INDEX IF NOT EXISTS idx_art_entries_contest ON art_entries(contest_id, vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_art_votes_contest   ON art_votes(contest_id);
CREATE INDEX IF NOT EXISTS idx_art_votes_entry     ON art_votes(entry_id);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('contest_enabled',       'true',  'Enable pixel art contests',                   'contest'),
  ('contest_default_fee',   '20',    'Default entry fee GP',                        'contest'),
  ('contest_default_vote_fee','0',   'Default voting fee GP (0 = free)',            'contest'),
  ('contest_admin_seed_gp', '500',   'GP admin seeds into each new contest pool',   'contest'),
  ('contest_max_per_wallet','3',     'Max active entries per wallet across contests','contest')
ON CONFLICT (key) DO NOTHING;

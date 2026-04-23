-- Migration 144: GP Territory Star Rating
-- Players pay a small GP fee to rate a territory (1-5 stars).
-- One rating per wallet per territory; can update (change costs extra GP).
-- Average rating shown in territory info panel.

CREATE TABLE IF NOT EXISTS territory_ratings (
  id           SERIAL       PRIMARY KEY,
  claim_id     INTEGER      NOT NULL,
  voter_wallet TEXT         NOT NULL,
  rating       SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  gp_paid      INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (claim_id, voter_wallet)
);
CREATE INDEX IF NOT EXISTS idx_ratings_claim  ON territory_ratings(claim_id);
CREATE INDEX IF NOT EXISTS idx_ratings_voter  ON territory_ratings(voter_wallet);

-- Settings
INSERT INTO settings (key, value, category, label) VALUES
  ('rating_enabled',     'true', 'rating', 'Enable Territory Ratings'),
  ('rating_cost_gp',     '5',    'rating', 'GP cost for first rating'),
  ('rating_change_gp',   '3',    'rating', 'GP cost to change rating'),
  ('rating_min_votes',   '3',    'rating', 'Min votes to show average publicly')
ON CONFLICT (key) DO NOTHING;

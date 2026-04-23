-- Migration 125: GP Tournament System
-- Admin creates tournaments with entry fees. Players register. Winner takes the pot.

CREATE TABLE IF NOT EXISTS tournaments (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  icon         TEXT NOT NULL DEFAULT '🏆',
  entry_fee_gp INTEGER NOT NULL DEFAULT 50,
  prize_pool_gp INTEGER NOT NULL DEFAULT 0,
  max_players  INTEGER,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','running','completed','cancelled')),
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  winner_wallet TEXT,
  winner_prize  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  wallet        TEXT    NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_wallet ON tournament_entries(wallet, tournament_id);

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('tournament_enabled',        'true',  'tournament'),
  ('tournament_house_cut_pct',  '10',    'tournament'),
  ('tournament_min_players',    '2',     'tournament'),
  ('tournament_max_entry_fee',  '10000', 'tournament')
ON CONFLICT (key) DO NOTHING;

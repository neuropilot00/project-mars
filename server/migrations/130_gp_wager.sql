-- Migration 130: GP Leaderboard Wager
-- Players stake GP on which wallet will top the week's/season's leaderboard.
-- Admin creates wager pools; players bet on a wallet; house cuts on settlement.

CREATE TABLE IF NOT EXISTS wager_pools (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT NOT NULL DEFAULT '🎯',
  category      TEXT NOT NULL DEFAULT 'weekly',   -- 'weekly' | 'season' | 'custom'
  min_bet_gp    INTEGER NOT NULL DEFAULT 10,
  max_bet_gp    INTEGER,                          -- NULL = unlimited
  total_pot_gp  INTEGER NOT NULL DEFAULT 0,
  house_cut_pct INTEGER NOT NULL DEFAULT 10,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','settled','cancelled')),
  closes_at     TIMESTAMPTZ NOT NULL,
  winner_wallet TEXT,                              -- set on settlement
  settled_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wager_bets (
  id            SERIAL PRIMARY KEY,
  pool_id       INTEGER NOT NULL REFERENCES wager_pools(id),
  bettor_wallet TEXT NOT NULL,
  target_wallet TEXT NOT NULL,   -- wallet betted to win
  gp_amount     INTEGER NOT NULL,
  payout        INTEGER,         -- filled on settlement
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pool_id, bettor_wallet)  -- one bet per pool per player
);

CREATE INDEX IF NOT EXISTS idx_wager_bets_pool   ON wager_bets(pool_id);
CREATE INDEX IF NOT EXISTS idx_wager_bets_bettor ON wager_bets(bettor_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wager_pools_status ON wager_pools(status, closes_at);

INSERT INTO game_settings (key, value, category) VALUES
  ('wager_enabled',         'true',  'wager'),
  ('wager_house_cut_pct',   '10',    'wager'),
  ('wager_min_bet_gp',      '10',    'wager'),
  ('wager_max_bet_gp',      '0',     'wager'),   -- 0 = unlimited
  ('wager_auto_lock',       'true',  'wager')    -- auto-lock pool when closes_at passes
ON CONFLICT (key) DO NOTHING;

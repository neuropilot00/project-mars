-- Migration 129: GP Raffle System
-- Admin creates time-limited raffles. Players buy tickets with GP.
-- Winner drawn automatically on expiry. Recurring GP sink.

CREATE TABLE IF NOT EXISTS raffles (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  icon          TEXT NOT NULL DEFAULT '🎟️',
  ticket_cost_gp INTEGER NOT NULL DEFAULT 10,
  max_tickets   INTEGER,               -- NULL = unlimited
  tickets_sold  INTEGER NOT NULL DEFAULT 0,
  prize_pool_gp INTEGER NOT NULL DEFAULT 0,
  prize_desc    TEXT,
  house_cut_pct INTEGER NOT NULL DEFAULT 10,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','drawing','completed','cancelled')),
  ends_at       TIMESTAMPTZ NOT NULL,
  winner_wallet TEXT,
  winner_ticket INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raffle_entries (
  id          SERIAL PRIMARY KEY,
  raffle_id   INTEGER NOT NULL REFERENCES raffles(id),
  wallet      TEXT NOT NULL,
  tickets     INTEGER NOT NULL DEFAULT 1,
  gp_spent    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle ON raffle_entries(raffle_id, wallet);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_wallet ON raffle_entries(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status, ends_at);

INSERT INTO game_settings (key, value, category) VALUES
  ('raffle_enabled',           'true',  'raffle'),
  ('raffle_max_tickets_pp',    '100',   'raffle'),  -- max tickets per player per raffle
  ('raffle_min_cost_gp',       '5',     'raffle'),
  ('raffle_house_cut_pct',     '10',    'raffle'),
  ('raffle_auto_draw',         'true',  'raffle'),  -- auto-draw on expiry
  ('raffle_min_tickets_draw',  '1',     'raffle')   -- min tickets sold to draw (else cancel)
ON CONFLICT (key) DO NOTHING;

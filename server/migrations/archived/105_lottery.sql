-- Migration 105: GP Lottery System
-- Players spend GP for tickets; winner drawn when round expires.
-- Creates a fun GP sink with social excitement.

CREATE TABLE IF NOT EXISTS lottery_rounds (
  id               SERIAL PRIMARY KEY,
  round_number     INT          NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'open',  -- open | drawing | completed | cancelled
  ticket_price_gp  DECIMAL(20,6) NOT NULL DEFAULT 10,
  prize_pool_gp    DECIMAL(20,6) NOT NULL DEFAULT 0,
  house_gp         DECIMAL(20,6) NOT NULL DEFAULT 0,      -- house cut collected
  ticket_count     INT          NOT NULL DEFAULT 0,
  winner_wallet    VARCHAR(100),
  winner_ticket    INT,
  starts_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ends_at          TIMESTAMPTZ  NOT NULL,
  drawn_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
  id               SERIAL PRIMARY KEY,
  round_id         INT          NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  wallet           VARCHAR(100) NOT NULL,
  ticket_number    INT          NOT NULL,     -- sequential within round
  purchased_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  is_winner        BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE(round_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_lottery_tickets_wallet  ON lottery_tickets(wallet, round_id);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_round   ON lottery_tickets(round_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_lottery_rounds_status   ON lottery_rounds(status, ends_at);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('lottery_enabled',              'true', 'Enable GP lottery system',                          'lottery'),
  ('lottery_ticket_price_gp',      '10',   'GP cost per lottery ticket',                        'lottery'),
  ('lottery_max_tickets_per_user', '50',   'Max tickets per wallet per round',                  'lottery'),
  ('lottery_round_hours',          '24',   'Hours per lottery round',                            'lottery'),
  ('lottery_house_cut_pct',        '5',    'Percentage of pool kept as house fee',              'lottery'),
  ('lottery_min_tickets',          '3',    'Minimum tickets sold before draw happens',           'lottery'),
  ('lottery_jackpot_rollover',     'true', 'Roll unsold prize over to next round on no winner', 'lottery')
ON CONFLICT (key) DO NOTHING;

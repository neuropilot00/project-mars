-- Migration 119: Player Alliance System
-- Small groups of 2-5 players form alliances for mutual territory defense bonuses,
-- shared mining income split, and a shared GP treasury.
-- GP cost to create alliance; weekly dues to maintain membership.

CREATE TABLE IF NOT EXISTS alliances (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50)    NOT NULL UNIQUE,
  tag             VARCHAR(6)     NOT NULL UNIQUE,   -- short tag e.g. [MARS]
  leader          VARCHAR(100)   NOT NULL,
  description     VARCHAR(300),
  emblem          VARCHAR(10)    NOT NULL DEFAULT '⚔️',  -- emoji
  treasury_gp     DECIMAL(20,6)  NOT NULL DEFAULT 0,
  defense_bonus   SMALLINT       NOT NULL DEFAULT 5,   -- % territory defense buff for all members
  income_share    SMALLINT       NOT NULL DEFAULT 0,   -- % of member mining shared to treasury
  member_count    SMALLINT       NOT NULL DEFAULT 1,
  max_members     SMALLINT       NOT NULL DEFAULT 5,
  is_recruiting   BOOLEAN        NOT NULL DEFAULT true,
  total_gp_burned DECIMAL(20,6)  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alliance_members (
  id           SERIAL PRIMARY KEY,
  alliance_id  INT            NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  wallet       VARCHAR(100)   NOT NULL,
  role         VARCHAR(20)    NOT NULL DEFAULT 'member', -- leader | officer | member
  joined_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  last_dues_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (wallet)  -- one alliance per player
);

CREATE TABLE IF NOT EXISTS alliance_log (
  id           SERIAL PRIMARY KEY,
  alliance_id  INT            NOT NULL,
  wallet       VARCHAR(100),
  event_type   VARCHAR(30)    NOT NULL,  -- created|joined|left|promoted|kicked|dues|treasury_deposit|treasury_withdraw
  amount_gp    DECIMAL(20,6)  NOT NULL DEFAULT 0,
  note         VARCHAR(200),
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alliance_members_wallet ON alliance_members(wallet);
CREATE INDEX IF NOT EXISTS idx_alliance_log_id         ON alliance_log(alliance_id, created_at DESC);

-- ── Settings ──────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('alliance_enabled',            'true',  'Enable alliance system',                           'alliance'),
  ('alliance_create_cost_gp',     '200',   'GP to create a new alliance',                      'alliance'),
  ('alliance_weekly_dues_gp',     '20',    'GP weekly dues per member (keeps alliance active)', 'alliance'),
  ('alliance_max_members',        '5',     'Maximum members per alliance',                     'alliance'),
  ('alliance_defense_bonus',      '5',     'Default territory defense bonus % for members',    'alliance'),
  ('alliance_income_share',       '5',     'Default % of member mining income to treasury',    'alliance'),
  ('alliance_treasury_withdraw_min','10',  'Minimum GP leader can withdraw from treasury',     'alliance'),
  ('alliance_treasury_fee_pct',   '5',     'Fee % on treasury withdrawals (to GP burn)',       'alliance')
ON CONFLICT (key) DO NOTHING;

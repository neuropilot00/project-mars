-- Migration 178: Phantom tables pack
-- Creates tables referenced by 20 services (branding, tdesc, monuments, expedition,
-- contest, tiers, staking, spells, polls, capsule, wager, tevt, status, sponsor,
-- shield, raffle, donation, crafting, broadcasts, beacon) that are missing from DB.
-- Idempotent — uses CREATE TABLE IF NOT EXISTS throughout.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- branding.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_branding (
  claim_id        INTEGER PRIMARY KEY,
  wallet          VARCHAR(42) NOT NULL,
  territory_name  VARCHAR(120),
  tagline         VARCHAR(255),
  theme_color     VARCHAR(32),
  banner_url      TEXT,
  icon            VARCHAR(32),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_branding_wallet ON territory_branding(wallet);
CREATE INDEX IF NOT EXISTS idx_territory_branding_updated ON territory_branding(updated_at DESC);

CREATE TABLE IF NOT EXISTS territory_branding_log (
  id          BIGSERIAL PRIMARY KEY,
  claim_id    INTEGER NOT NULL,
  wallet      VARCHAR(42) NOT NULL,
  field       VARCHAR(64) NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  gp_spent    NUMERIC(20,6) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_branding_log_wallet_created ON territory_branding_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branding_log_claim ON territory_branding_log(claim_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- tdesc.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_descriptions (
  claim_id     INTEGER PRIMARY KEY,
  wallet       VARCHAR(42) NOT NULL,
  description  TEXT NOT NULL,
  gp_paid      NUMERIC(20,6) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tdesc_wallet ON territory_descriptions(wallet);
CREATE INDEX IF NOT EXISTS idx_tdesc_updated ON territory_descriptions(updated_at DESC);

CREATE TABLE IF NOT EXISTS tdesc_log (
  id          BIGSERIAL PRIMARY KEY,
  claim_id    INTEGER NOT NULL,
  wallet      VARCHAR(42) NOT NULL,
  description TEXT,
  gp_paid     NUMERIC(20,6) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tdesc_log_wallet_created ON tdesc_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdesc_log_claim ON tdesc_log(claim_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- monuments.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_monuments (
  id              BIGSERIAL PRIMARY KEY,
  claim_id        INTEGER NOT NULL,
  owner           VARCHAR(42) NOT NULL,
  monument_type   VARCHAR(64) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  message         TEXT,
  icon            VARCHAR(32),
  gp_spent        NUMERIC(20,6) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  preserved_by    VARCHAR(42),
  destroyed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monuments_owner ON territory_monuments(owner);
CREATE INDEX IF NOT EXISTS idx_monuments_claim ON territory_monuments(claim_id);
CREATE INDEX IF NOT EXISTS idx_monuments_active ON territory_monuments(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_monuments_created ON territory_monuments(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- expedition.js  (NOTE: existing mining_expeditions is unrelated)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expeditions (
  id               BIGSERIAL PRIMARY KEY,
  wallet           VARCHAR(42) NOT NULL,
  claim_id         INTEGER NOT NULL,
  expedition_type  VARCHAR(64) DEFAULT 'salvage',
  gp_spent         NUMERIC(20,6) DEFAULT 0,
  duration_h       INTEGER NOT NULL,
  returns_at       TIMESTAMPTZ NOT NULL,
  claim_size       INTEGER,
  status           VARCHAR(32) DEFAULT 'active',  -- active|completed|cancelled
  reward_type      VARCHAR(64),
  reward_amount    NUMERIC(20,6),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expeditions_wallet ON expeditions(wallet);
CREATE INDEX IF NOT EXISTS idx_expeditions_claim ON expeditions(claim_id);
CREATE INDEX IF NOT EXISTS idx_expeditions_status ON expeditions(status);
CREATE INDEX IF NOT EXISTS idx_expeditions_returns_at ON expeditions(returns_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- contest.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS art_contests (
  id                BIGSERIAL PRIMARY KEY,
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  theme             VARCHAR(255),
  entry_fee_gp      NUMERIC(20,6) DEFAULT 0,
  vote_fee_gp       NUMERIC(20,6) DEFAULT 0,
  prize_pool_gp     NUMERIC(20,6) DEFAULT 0,
  prize_1st_pct     NUMERIC(6,2) DEFAULT 50,
  prize_2nd_pct     NUMERIC(6,2) DEFAULT 30,
  prize_3rd_pct     NUMERIC(6,2) DEFAULT 20,
  max_entries       INTEGER,
  status            VARCHAR(32) DEFAULT 'pending', -- pending|open|voting|finished
  submission_start  TIMESTAMPTZ,
  submission_end    TIMESTAMPTZ,
  voting_end        TIMESTAMPTZ,
  created_by        VARCHAR(42),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_art_contests_status ON art_contests(status);

CREATE TABLE IF NOT EXISTS art_entries (
  id              BIGSERIAL PRIMARY KEY,
  contest_id      BIGINT NOT NULL,
  wallet          VARCHAR(42) NOT NULL,
  title           VARCHAR(255),
  description     TEXT,
  image_url       TEXT,
  claim_id        INTEGER,
  gp_paid         NUMERIC(20,6) DEFAULT 0,
  vote_count      INTEGER DEFAULT 0,
  rank            INTEGER,
  prize_paid      NUMERIC(20,6) DEFAULT 0,
  is_disqualified BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_art_entries_contest ON art_entries(contest_id);
CREATE INDEX IF NOT EXISTS idx_art_entries_wallet ON art_entries(wallet);

CREATE TABLE IF NOT EXISTS art_votes (
  id          BIGSERIAL PRIMARY KEY,
  contest_id  BIGINT NOT NULL,
  entry_id    BIGINT NOT NULL,
  voter       VARCHAR(42) NOT NULL,
  gp_paid     NUMERIC(20,6) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_art_votes_contest_voter ON art_votes(contest_id, voter);
CREATE INDEX IF NOT EXISTS idx_art_votes_entry ON art_votes(entry_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- tiers.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_tiers (
  claim_id     INTEGER PRIMARY KEY,
  wallet       VARCHAR(42) NOT NULL,
  tier         INTEGER NOT NULL DEFAULT 0,
  upgraded_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_tiers_wallet ON territory_tiers(wallet);

CREATE TABLE IF NOT EXISTS territory_tier_log (
  id         BIGSERIAL PRIMARY KEY,
  claim_id   INTEGER NOT NULL,
  wallet     VARCHAR(42) NOT NULL,
  from_tier  INTEGER,
  to_tier    INTEGER,
  gp_spent   NUMERIC(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tier_log_wallet_created ON territory_tier_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tier_log_claim ON territory_tier_log(claim_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- staking.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gp_stakes (
  id            BIGSERIAL PRIMARY KEY,
  wallet        VARCHAR(42) NOT NULL,
  amount        NUMERIC(20,6) NOT NULL,
  apy_pct       NUMERIC(8,4) NOT NULL,
  lock_days     INTEGER NOT NULL,
  yield_earned  NUMERIC(20,6) DEFAULT 0,
  status        VARCHAR(32) DEFAULT 'active', -- active|ready|withdrawn|cancelled
  unlocks_at    TIMESTAMPTZ NOT NULL,
  withdrawn_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gp_stakes_wallet_status ON gp_stakes(wallet, status);
CREATE INDEX IF NOT EXISTS idx_gp_stakes_unlocks_at ON gp_stakes(unlocks_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- spells.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_spells (
  id                BIGSERIAL PRIMARY KEY,
  caster_wallet     VARCHAR(42) NOT NULL,
  target_claim_id   INTEGER NOT NULL,
  spell_type        VARCHAR(64) NOT NULL,
  gp_cost           NUMERIC(20,6) DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_spells_target_active ON territory_spells(target_claim_id, is_active);
CREATE INDEX IF NOT EXISTS idx_territory_spells_caster_created ON territory_spells(caster_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_territory_spells_expires ON territory_spells(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- polls.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gp_polls (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,
  gp_cost     NUMERIC(20,6) DEFAULT 0,
  duration_h  INTEGER NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  vote_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gp_polls_active_ends ON gp_polls(is_active, ends_at);
CREATE INDEX IF NOT EXISTS idx_gp_polls_wallet_created ON gp_polls(wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id     BIGINT NOT NULL,
  wallet      VARCHAR(42) NOT NULL,
  option_idx  INTEGER NOT NULL,
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_wallet ON poll_votes(wallet);

-- ─────────────────────────────────────────────────────────────────────────────
-- capsule.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_capsules (
  id                  BIGSERIAL PRIMARY KEY,
  wallet              VARCHAR(42) NOT NULL,
  nickname_snapshot   VARCHAR(255),
  message             TEXT NOT NULL,
  reveal_at           TIMESTAMPTZ NOT NULL,
  revealed_at         TIMESTAMPTZ,
  is_revealed         BOOLEAN DEFAULT FALSE,
  gp_paid             NUMERIC(20,6) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_time_capsules_wallet ON time_capsules(wallet);
CREATE INDEX IF NOT EXISTS idx_time_capsules_reveal ON time_capsules(reveal_at) WHERE is_revealed = FALSE;
CREATE INDEX IF NOT EXISTS idx_time_capsules_revealed_at ON time_capsules(revealed_at DESC) WHERE is_revealed = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- wager.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wager_pools (
  id              BIGSERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  icon            VARCHAR(32) DEFAULT '🎯',
  category        VARCHAR(64) DEFAULT 'weekly',
  min_bet_gp      NUMERIC(20,6) DEFAULT 10,
  max_bet_gp     NUMERIC(20,6),
  house_cut_pct   NUMERIC(6,2) DEFAULT 10,
  total_pot_gp    NUMERIC(20,6) DEFAULT 0,
  status          VARCHAR(32) DEFAULT 'open',  -- open|locked|settled|cancelled
  winner_wallet   VARCHAR(42),
  closes_at       TIMESTAMPTZ NOT NULL,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wager_pools_status ON wager_pools(status);
CREATE INDEX IF NOT EXISTS idx_wager_pools_closes_at ON wager_pools(closes_at);

CREATE TABLE IF NOT EXISTS wager_bets (
  id              BIGSERIAL PRIMARY KEY,
  pool_id         BIGINT NOT NULL,
  bettor_wallet   VARCHAR(42) NOT NULL,
  target_wallet   VARCHAR(42) NOT NULL,
  gp_amount       NUMERIC(20,6) NOT NULL,
  payout          NUMERIC(20,6) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wager_bets_pool ON wager_bets(pool_id);
CREATE INDEX IF NOT EXISTS idx_wager_bets_bettor ON wager_bets(bettor_wallet);
CREATE INDEX IF NOT EXISTS idx_wager_bets_target ON wager_bets(target_wallet);

-- ─────────────────────────────────────────────────────────────────────────────
-- tevt.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_events (
  id          BIGSERIAL PRIMARY KEY,
  claim_id    INTEGER NOT NULL,
  wallet      VARCHAR(42) NOT NULL,
  event_type  VARCHAR(64) NOT NULL,
  gp_cost     NUMERIC(20,6) DEFAULT 0,
  duration_h  INTEGER NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_events_claim_active ON territory_events(claim_id, is_active);
CREATE INDEX IF NOT EXISTS idx_territory_events_wallet ON territory_events(wallet);
CREATE INDEX IF NOT EXISTS idx_territory_events_expires ON territory_events(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- status.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_status (
  wallet      VARCHAR(42) PRIMARY KEY,
  status      TEXT NOT NULL,
  gp_paid     NUMERIC(20,6) DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_player_status_expires ON player_status(expires_at);

CREATE TABLE IF NOT EXISTS status_log (
  id         BIGSERIAL PRIMARY KEY,
  wallet     VARCHAR(42) NOT NULL,
  status     TEXT NOT NULL,
  gp_paid    NUMERIC(20,6) DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_log_wallet_created ON status_log(wallet, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- sponsor.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_sponsors (
  id              BIGSERIAL PRIMARY KEY,
  claim_id        INTEGER NOT NULL,
  sponsor_wallet  VARCHAR(42) NOT NULL,
  message         TEXT,
  gp_paid         NUMERIC(20,6) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_sponsors_claim ON territory_sponsors(claim_id);
CREATE INDEX IF NOT EXISTS idx_territory_sponsors_wallet ON territory_sponsors(sponsor_wallet);
CREATE INDEX IF NOT EXISTS idx_territory_sponsors_expires ON territory_sponsors(expires_at);
CREATE INDEX IF NOT EXISTS idx_territory_sponsors_active ON territory_sponsors(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- shield.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS territory_shields (
  id            BIGSERIAL PRIMARY KEY,
  claim_id      INTEGER NOT NULL UNIQUE,
  owner         VARCHAR(42) NOT NULL,
  duration_h    INTEGER NOT NULL,
  gp_spent      NUMERIC(20,6) DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  activated_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_territory_shields_owner ON territory_shields(owner);
CREATE INDEX IF NOT EXISTS idx_territory_shields_expires ON territory_shields(expires_at) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- raffle.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raffles (
  id              BIGSERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  icon            VARCHAR(32) DEFAULT '🎟️',
  ticket_cost_gp  NUMERIC(20,6) NOT NULL,
  max_tickets     INTEGER,
  tickets_sold    INTEGER DEFAULT 0,
  prize_desc      TEXT,
  prize_pool_gp   NUMERIC(20,6) DEFAULT 0,
  house_cut_pct   NUMERIC(6,2) DEFAULT 10,
  status          VARCHAR(32) DEFAULT 'open', -- open|drawing|completed|cancelled
  winner_wallet   VARCHAR(42),
  winner_ticket   INTEGER,
  ends_at         TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_raffles_status_ends ON raffles(status, ends_at);

CREATE TABLE IF NOT EXISTS raffle_entries (
  id          BIGSERIAL PRIMARY KEY,
  raffle_id   BIGINT NOT NULL,
  wallet      VARCHAR(42) NOT NULL,
  tickets     INTEGER NOT NULL DEFAULT 0,
  gp_spent    NUMERIC(20,6) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle ON raffle_entries(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_wallet ON raffle_entries(wallet);

-- ─────────────────────────────────────────────────────────────────────────────
-- donation.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donation_wall (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  amount_gp   NUMERIC(20,6) NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_donation_wall_wallet_created ON donation_wall(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_wall_created ON donation_wall(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- crafting.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crafting_recipes (
  id                    BIGSERIAL PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  category              VARCHAR(64),
  ingredients           JSONB NOT NULL,           -- [{item_type_id, quantity}, ...]
  gp_cost               NUMERIC(20,6) DEFAULT 0,
  output_item_type_id   INTEGER NOT NULL,
  output_qty            INTEGER DEFAULT 1,
  output_name           VARCHAR(255),
  success_rate          NUMERIC(6,4) DEFAULT 1.0,
  fail_refund_pct       NUMERIC(6,2) DEFAULT 0,
  is_active             BOOLEAN DEFAULT TRUE,
  is_seasonal           BOOLEAN DEFAULT FALSE,
  sort_order            INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crafting_recipes_active ON crafting_recipes(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_crafting_recipes_category ON crafting_recipes(category);

CREATE TABLE IF NOT EXISTS crafting_log (
  id           BIGSERIAL PRIMARY KEY,
  wallet       VARCHAR(42) NOT NULL,
  recipe_id    BIGINT NOT NULL,
  recipe_name  VARCHAR(255),
  gp_cost      NUMERIC(20,6) DEFAULT 0,
  gp_refunded  NUMERIC(20,6) DEFAULT 0,
  success      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crafting_log_wallet_created ON crafting_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crafting_log_recipe ON crafting_log(recipe_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- broadcasts.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gp_broadcasts (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  message     TEXT NOT NULL,
  gp_paid     NUMERIC(20,6) DEFAULT 0,
  duration_h  INTEGER NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  show_until  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gp_broadcasts_active_show ON gp_broadcasts(is_active, show_until);
CREATE INDEX IF NOT EXISTS idx_gp_broadcasts_wallet_created ON gp_broadcasts(wallet, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- beacon.js
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS map_beacons (
  id          BIGSERIAL PRIMARY KEY,
  wallet      VARCHAR(42) NOT NULL,
  x           NUMERIC(20,6) NOT NULL,
  y           NUMERIC(20,6) NOT NULL,
  message     TEXT,
  icon        VARCHAR(32),
  gp_paid     NUMERIC(20,6) DEFAULT 0,
  duration_h  INTEGER NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_map_beacons_active_expires ON map_beacons(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_map_beacons_wallet_created ON map_beacons(wallet, created_at DESC);

COMMIT;

INSERT INTO schema_migrations (filename) VALUES ('178_phantom_tables_pack.sql') ON CONFLICT DO NOTHING;

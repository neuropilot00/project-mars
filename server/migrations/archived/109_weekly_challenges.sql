-- Migration 109: Weekly Challenge System
-- Weekly time-boxed challenges with bigger rewards than daily missions.
-- Three types: personal (solo), collective (server-wide progress bar), competitive (leaderboard race).

CREATE TABLE IF NOT EXISTS weekly_challenge_defs (
  id            SERIAL PRIMARY KEY,
  key           VARCHAR(80)    NOT NULL UNIQUE,
  challenge_type VARCHAR(20)   NOT NULL DEFAULT 'personal',  -- personal | collective | competitive
  name_en       VARCHAR(200)   NOT NULL,
  name_ko       VARCHAR(200),
  name_ja       VARCHAR(200),
  name_zh       VARCHAR(200),
  desc_en       TEXT           NOT NULL,
  icon          VARCHAR(20)    NOT NULL DEFAULT '🎯',
  condition_type VARCHAR(60)   NOT NULL,   -- claim_count | gp_earn | gp_spend | battle_win | marketplace_buy | harvest_pp | stake_gp | burn_gp | territory_pixels
  target_value  INT            NOT NULL DEFAULT 10,           -- collective: server-wide target; personal: per-player target
  reward_gp     INT            NOT NULL DEFAULT 0,
  reward_item   VARCHAR(60),               -- optional item code from item_types
  reward_item_qty INT          NOT NULL DEFAULT 0,
  difficulty    VARCHAR(20)    NOT NULL DEFAULT 'normal',     -- easy | normal | hard | epic
  active        BOOLEAN        NOT NULL DEFAULT true,
  sort_order    INT            NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS weekly_challenge_instances (
  id            SERIAL PRIMARY KEY,
  challenge_def_id INT        NOT NULL REFERENCES weekly_challenge_defs(id),
  week_start    DATE           NOT NULL,   -- Monday of the challenge week
  week_end      DATE           NOT NULL,   -- Sunday
  collective_progress INT      NOT NULL DEFAULT 0,
  collective_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  UNIQUE (challenge_def_id, week_start)
);

CREATE TABLE IF NOT EXISTS weekly_challenge_progress (
  id            SERIAL PRIMARY KEY,
  instance_id   INT            NOT NULL REFERENCES weekly_challenge_instances(id) ON DELETE CASCADE,
  wallet        VARCHAR(100)   NOT NULL,
  progress      INT            NOT NULL DEFAULT 0,
  completed     BOOLEAN        NOT NULL DEFAULT false,
  reward_claimed BOOLEAN       NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  claimed_at    TIMESTAMPTZ,
  UNIQUE (instance_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_wcp_wallet   ON weekly_challenge_progress(wallet, completed);
CREATE INDEX IF NOT EXISTS idx_wcp_instance ON weekly_challenge_progress(instance_id, progress DESC);

-- ── Seed 12 challenge definitions ────────────────────────────────────────────
INSERT INTO weekly_challenge_defs
  (key, challenge_type, name_en, name_ko, desc_en, icon, condition_type, target_value, reward_gp, difficulty, sort_order)
VALUES
  -- Personal challenges
  ('weekly_claim_land',      'personal',    'Land Rush',          '영토 확장',       'Claim 3 new territories this week',                            '🌍', 'claim_count',      3,    200, 'easy',   1),
  ('weekly_battle_wins',     'personal',    'War Chief',          '전쟁 족장',       'Win 5 battles this week',                                      '⚔️', 'battle_win_count', 5,    300, 'normal', 2),
  ('weekly_marketplace_shop','personal',    'Merchant Prince',    '상인 왕자',       'Complete 3 marketplace purchases this week',                   '🛒', 'marketplace_buy',  3,    250, 'normal', 3),
  ('weekly_gp_stake',        'personal',    'Long Hodler',        '장기 보유자',     'Stake at least 500 GP this week',                             '💎', 'stake_gp',         500,  400, 'hard',   4),
  ('weekly_gp_burn',         'personal',    'Pyro Economist',     '불꽃 경제학자',   'Burn at least 200 GP on power-ups this week',                  '🔥', 'burn_gp',          200,  350, 'normal', 5),
  ('weekly_harvest',         'personal',    'Super Miner',        '슈퍼 광부',       'Harvest PP from territories 10 times this week',              '⛏️', 'harvest_pp',       10,   150, 'easy',   6),
  ('weekly_gp_earn',         'personal',    'Gold Fever',         '황금열',          'Earn 1000 GP from any source this week',                      '💰', 'gp_earn',          1000, 500, 'hard',   7),

  -- Collective challenges (server-wide progress bar)
  ('weekly_collective_battles', 'collective', 'Planet War',       '행성 전쟁',       'Server goal: 100 total battles fought this week',              '🌐', 'battle_win_count', 100,  300, 'normal', 10),
  ('weekly_collective_trades',  'collective', 'Market Frenzy',    '시장 광란',       'Server goal: 50 total marketplace trades this week',           '📈', 'marketplace_buy',  50,   250, 'normal', 11),
  ('weekly_collective_burns',   'collective', 'Great Burning',    '대소각',          'Server goal: 5000 GP burned collectively this week',           '🔥', 'burn_gp',          5000, 400, 'hard',   12),

  -- Competitive challenges (top 3 get rewards)
  ('weekly_top_gp_earner',   'competitive', 'GP Champion',        'GP 챔피언',       'Be the #1 GP earner this week for a bonus reward',            '🏆', 'gp_earn',          1,    1000, 'epic',  20),
  ('weekly_top_harvester',   'competitive', 'Mining King',        '광업왕',          'Harvest the most PP of anyone this week',                     '⛏️', 'harvest_pp',       1,    800,  'epic',  21)
ON CONFLICT (key) DO NOTHING;

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('weekly_challenges_enabled',   'true', 'Enable weekly challenge system',             'weekly'),
  ('weekly_challenge_reset_day',  '1',    'Day of week to reset (1=Monday, 0=Sunday)',  'weekly'),
  ('weekly_collective_bonus_mult','1.5',  'Bonus GP multiplier for collective winners', 'weekly'),
  ('weekly_top_reward_2nd_pct',   '60',   'Second place reward as % of first place',   'weekly'),
  ('weekly_top_reward_3rd_pct',   '40',   'Third place reward as % of first place',    'weekly')
ON CONFLICT (key) DO NOTHING;

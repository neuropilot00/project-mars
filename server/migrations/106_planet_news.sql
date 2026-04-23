-- Migration 106: Planet News Feed
-- Real-time feed of significant in-game events (battles, trades, achievements, lottery wins).
-- Makes the game world feel alive; drives FOMO and social discovery.

CREATE TABLE IF NOT EXISTS planet_news (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(40)   NOT NULL,   -- lottery_win | battle_won | territory_claimed | market_sale | achievement | big_trade | guild_event
  headline    TEXT          NOT NULL,
  wallet      VARCHAR(100),             -- primary actor
  wallet2     VARCHAR(100),             -- secondary actor (opponent, seller, etc.)
  amount      DECIMAL(20,6),            -- GP/PP amount
  meta        JSONB,                    -- flexible extra data
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planet_news_time ON planet_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planet_news_type ON planet_news(event_type, created_at DESC);

-- ── Settings ─────────────────────────────────────────────────────────────────
INSERT INTO game_settings (key, value, description, category) VALUES
  ('news_enabled',            'true', 'Enable planet news feed',                             'system'),
  ('news_max_items',          '50',   'Max news items returned per query',                   'system'),
  ('news_retention_days',     '30',   'Auto-delete news older than N days',                  'system'),
  ('news_min_trade_gp',       '100',  'Minimum GP for marketplace sale to appear in news',   'system'),
  ('news_min_transfer_gp',    '500',  'Minimum GP transfer amount to appear in news',        'system'),
  ('news_battle_enabled',     'true', 'Show naval battle wins in news feed',                 'system'),
  ('news_achievement_epic',   'true', 'Show epic/legendary achievement unlocks in news',     'system'),
  ('news_lottery_enabled',    'true', 'Show lottery winners in news feed',                   'system')
ON CONFLICT (key) DO NOTHING;

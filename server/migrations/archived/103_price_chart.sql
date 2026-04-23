-- Migration 103: Marketplace Price History Chart
-- Adds indexes for efficient sparkline queries and settings to control chart display.

-- Index for time-series queries (sparkline: last N sales for an item type)
CREATE INDEX IF NOT EXISTS idx_mkt_ph_type_time
  ON marketplace_price_history(item_type_id, enhancement_level, sold_at DESC);

-- Index for territory price history
CREATE INDEX IF NOT EXISTS idx_mkt_ph_claim_time
  ON marketplace_price_history(claim_id, sold_at DESC);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('mkt_chart_enabled',  'true', 'Show price history chart in marketplace item detail', 'marketplace'),
  ('mkt_chart_points',   '20',   'Number of historical sales to show in sparkline',     'marketplace'),
  ('mkt_stats_enabled',  'true', 'Show sold count / avg price badge on market cards',   'marketplace')
ON CONFLICT (key) DO NOTHING;

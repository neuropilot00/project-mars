-- Migration 101: Territory Marketplace UI
-- Backend support for the territory sell flow.
-- Adds user-facing territory listing API and fine-tunes settings.

-- Index for fast "user's unlocked claims" query (used in /api/user/my-territories)
CREATE INDEX IF NOT EXISTS idx_claims_owner_active
  ON claims(owner, deleted_at, marketplace_locked);

-- Settings
INSERT INTO game_settings (key, value, description, category) VALUES
  ('territory_sell_enabled',    'true', 'Allow players to list territories on marketplace',      'marketplace'),
  ('territory_sell_min_price',  '10',   'Minimum GP/PP price for territory listings',            'marketplace'),
  ('territory_sell_max_active', '3',    'Max active territory listings per wallet',              'marketplace')
ON CONFLICT (key) DO NOTHING;

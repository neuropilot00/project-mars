-- Marketplace: P2P fixed-price trading for items, cosmetics, and claims

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  seller VARCHAR(42) NOT NULL,
  listing_type VARCHAR(20) NOT NULL CHECK (listing_type IN ('item','cosmetic','claim')),
  -- For item/cosmetic listings
  item_instance_id INT REFERENCES item_instances(id) ON DELETE SET NULL,
  -- For claim listings
  claim_id INT REFERENCES claims(id) ON DELETE SET NULL,
  -- Pricing
  price DECIMAL(20,6) NOT NULL CHECK (price > 0),
  currency VARCHAR(4) NOT NULL DEFAULT 'GP' CHECK (currency IN ('GP','PP')),
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled','expired','moderated')),
  listed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Sale info
  buyer VARCHAR(42),
  sold_at TIMESTAMPTZ,
  -- Metadata (item name, icon, enhancement level snapshot, claim info, etc.)
  meta JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mkt_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_mkt_seller ON marketplace_listings(seller);
CREATE INDEX IF NOT EXISTS idx_mkt_type ON marketplace_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_mkt_expires ON marketplace_listings(expires_at);
CREATE INDEX IF NOT EXISTS idx_mkt_instance ON marketplace_listings(item_instance_id);
CREATE INDEX IF NOT EXISTS idx_mkt_claim ON marketplace_listings(claim_id);

-- Price history for analytics
CREATE TABLE IF NOT EXISTS marketplace_price_history (
  id SERIAL PRIMARY KEY,
  listing_type VARCHAR(20) NOT NULL,
  item_type_id INT,
  enhancement_level INT DEFAULT 0,
  claim_id INT,
  sale_price DECIMAL(20,6) NOT NULL,
  currency VARCHAR(4) NOT NULL DEFAULT 'GP',
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_ph_type ON marketplace_price_history(item_type_id, enhancement_level);

-- Marketplace settings
INSERT INTO settings (key, value, description, category) VALUES
  ('marketplace_enabled', 'true', 'Enable/disable the marketplace', 'marketplace'),
  ('marketplace_fee_pct', '5', 'Seller fee percentage on sales', 'marketplace'),
  ('marketplace_listing_fee_gp', '2', 'GP cost to list an item', 'marketplace'),
  ('marketplace_max_active_listings', '20', 'Max active listings per user', 'marketplace'),
  ('marketplace_default_expiry_hours', '168', 'Default listing duration in hours (168 = 7 days)', 'marketplace'),
  ('marketplace_min_price', '1', 'Minimum listing price', 'marketplace'),
  ('marketplace_max_price', '999999', 'Maximum listing price', 'marketplace'),
  ('marketplace_claim_sale_enabled', 'true', 'Allow territory/claim sales on marketplace', 'marketplace')
ON CONFLICT (key) DO NOTHING;

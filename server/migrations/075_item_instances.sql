-- Individual item instances for enhancement & marketplace trading
-- Coexists with user_items (quantity-based): only cosmetics get "materialized" into instances

CREATE TABLE IF NOT EXISTS item_instances (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) NOT NULL,
  item_type_id INT NOT NULL REFERENCES item_types(id),
  enhancement_level INT NOT NULL DEFAULT 0 CHECK (enhancement_level >= 0 AND enhancement_level <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_instances_wallet ON item_instances(wallet);
CREATE INDEX IF NOT EXISTS idx_item_instances_type ON item_instances(item_type_id);
CREATE INDEX IF NOT EXISTS idx_item_instances_level ON item_instances(enhancement_level);

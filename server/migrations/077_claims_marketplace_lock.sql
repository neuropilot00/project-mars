-- Escrow flag for claims listed on marketplace
-- Prevents hijack/transfer/deletion while listed for sale
ALTER TABLE claims ADD COLUMN IF NOT EXISTS marketplace_locked BOOLEAN DEFAULT false;

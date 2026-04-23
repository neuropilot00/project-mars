-- ============================================================
-- Migration 090: Auction System
--
-- ⚠️  users.id 없음 → wallet_address VARCHAR(42) 기반
-- ============================================================

-- ── 1. auctions 테이블 ──
CREATE TABLE IF NOT EXISTS auctions (
  id                    SERIAL PRIMARY KEY,
  seller_wallet         VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  item_type             VARCHAR(20) NOT NULL
                          CHECK (item_type IN ('cosmetic','item','claim','resource')),
  item_instance_id      INT REFERENCES item_instances(id) ON DELETE SET NULL,
  resource_code         VARCHAR(30),
  resource_quantity     BIGINT,
  claim_id              INT REFERENCES claims(id) ON DELETE SET NULL,
  start_price           INT NOT NULL CHECK (start_price > 0),
  currency              VARCHAR(10) DEFAULT 'GP' CHECK (currency IN ('GP','PP')),
  current_bid           INT NOT NULL DEFAULT 0,
  current_bidder_wallet VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  buyout_price          INT,
  listing_fee           INT NOT NULL DEFAULT 0,
  platform_fee_rate     DECIMAL(5,4) DEFAULT 0.05,
  status                VARCHAR(20) DEFAULT 'active'
                          CHECK (status IN ('active','settled','cancelled','no_bids')),
  starts_at             TIMESTAMP DEFAULT NOW(),
  ends_at               TIMESTAMP NOT NULL,
  snipe_extension_min   INT DEFAULT 5,
  settled_at            TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auctions_status   ON auctions(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_auctions_seller   ON auctions(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_auctions_type     ON auctions(item_type, status);

-- ── 2. bids 테이블 ──
CREATE TABLE IF NOT EXISTS bids (
  id           SERIAL PRIMARY KEY,
  auction_id   INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_wallet VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  bid_amount   INT NOT NULL CHECK (bid_amount > 0),
  is_winning   BOOLEAN DEFAULT FALSE,
  refunded     BOOLEAN DEFAULT FALSE,
  bid_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction  ON bids(auction_id, bid_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder   ON bids(bidder_wallet);

-- ── 3. claims 에스크로 (이미 077에서 추가됨, 안전하게 재선언) ──
ALTER TABLE claims ADD COLUMN IF NOT EXISTS auction_locked BOOLEAN DEFAULT FALSE;

-- ── 4. Settings ──
INSERT INTO settings (key, value, description) VALUES
  ('auction_enabled',            'true',  '옥션 기능 활성화'),
  ('auction_listing_fee_gp',     '5',     '옥션 등록비 GP'),
  ('auction_min_duration_hours', '1',     '최소 옥션 기간 (시간)'),
  ('auction_max_duration_hours', '168',   '최대 옥션 기간 (시간, 7일)'),
  ('auction_snipe_extension_min','5',     '마감 전 입찰 시 연장 분'),
  ('auction_min_increment_pct',  '5',     '최소 입찰 증가율 (%)'),
  ('auction_platform_fee_pct',   '5',     '플랫폼 수수료 (%)'),
  ('auction_max_active',         '5',     '유저당 최대 활성 옥션 수')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   ALTER TABLE claims DROP COLUMN IF EXISTS auction_locked;
--   DROP TABLE IF EXISTS bids;
--   DROP TABLE IF EXISTS auctions;
--   DELETE FROM settings WHERE key LIKE 'auction_%';
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- Migration 090: 옥션 시스템
-- GAME_BIBLE_V4 Part 5 § 1.6 기준
-- 실제 DB 패턴: wallet_address PK, gp_balance, item_types
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. auctions 테이블 ───

CREATE TABLE IF NOT EXISTS auctions (
  id               BIGSERIAL PRIMARY KEY,
  seller_wallet    VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,

  -- 경매 대상
  listing_type     VARCHAR(20) NOT NULL DEFAULT 'item',
  -- item / cosmetic / claim / resource / ship
  item_instance_id BIGINT,          -- 강화 코스메틱 인스턴스
  item_type_id     INT,             -- item_types.id
  claim_id         INT,             -- claims.id
  resource_id      INT,             -- resources.id
  resource_quantity BIGINT,
  ship_instance_id BIGINT,          -- ship_instances.id

  -- 가격
  start_price      DECIMAL(20,8) NOT NULL,
  currency         VARCHAR(5) NOT NULL DEFAULT 'GP', -- GP / PP
  current_price    DECIMAL(20,8) NOT NULL,
  buyout_price     DECIMAL(20,8),   -- 즉시 구매가 (NULL = 없음)
  min_bid_increment DECIMAL(20,8) DEFAULT 1,

  -- 상태
  status           VARCHAR(20) DEFAULT 'active',
  -- active / sold / cancelled / expired

  -- 스나이핑 방지: 마감 5분 전 입찰 시 5분 연장
  anti_snipe_min   INT DEFAULT 5,
  anti_snipe_extend_min INT DEFAULT 5,

  -- 타이밍
  starts_at        TIMESTAMPTZ DEFAULT NOW(),
  ends_at          TIMESTAMPTZ NOT NULL,
  sold_at          TIMESTAMPTZ,

  -- 낙찰 정보
  winner_wallet    VARCHAR(42) REFERENCES users(wallet_address) ON DELETE SET NULL,
  final_price      DECIMAL(20,8),
  fee_pct          DECIMAL(5,4) DEFAULT 0.05,  -- 수수료 (Merchant: 0.0325)

  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CHECK (status IN ('active','sold','cancelled','expired')),
  CHECK (currency IN ('GP','PP')),
  CHECK (listing_type IN ('item','cosmetic','claim','resource','ship'))
);

CREATE INDEX IF NOT EXISTS idx_auctions_status   ON auctions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_auctions_ends     ON auctions(ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_auctions_seller   ON auctions(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_auctions_type     ON auctions(listing_type, status);

-- ─── 2. bids 테이블 ───

CREATE TABLE IF NOT EXISTS bids (
  id               BIGSERIAL PRIMARY KEY,
  auction_id       BIGINT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_wallet    VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  amount           DECIMAL(20,8) NOT NULL,
  is_winning       BOOLEAN DEFAULT FALSE,
  is_refunded      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bids_auction   ON bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder    ON bids(bidder_wallet);
CREATE INDEX IF NOT EXISTS idx_bids_winning   ON bids(auction_id) WHERE is_winning = TRUE;
CREATE INDEX IF NOT EXISTS idx_bids_refund    ON bids(is_refunded) WHERE is_refunded = FALSE AND is_winning = FALSE;

-- ─── 3. Settings ───

INSERT INTO settings (category, key, value, description) VALUES
  ('auction', 'auction_enabled',          'true',  '옥션 시스템 활성화'),
  ('auction', 'auction_min_duration_hours','1',    '최소 경매 시간 (시간)'),
  ('auction', 'auction_max_duration_hours','72',   '최대 경매 시간 (시간)'),
  ('auction', 'auction_fee_pct',          '0.05',  '옥션 수수료 (5%)'),
  ('auction', 'auction_merchant_fee_pct', '0.0325','Merchant 직업 옥션 수수료 (35% 할인)'),
  ('auction', 'auction_anti_snipe_min',   '5',     '스나이핑 방지 연장 기준 (분)'),
  ('auction', 'auction_anti_snipe_extend','5',     '스나이핑 방지 연장 시간 (분)'),
  ('auction', 'auction_max_per_user',     '10',    '유저당 최대 활성 경매 수'),
  ('auction', 'auction_min_bid_gp',       '1',     '최소 입찰 증가액 GP'),
  ('auction', 'auction_min_bid_pp',       '0.01',  '최소 입찰 증가액 PP')
ON CONFLICT (key) DO NOTHING;

-- ─── 4. 완료 알림 ───

DO $$
BEGIN
  RAISE NOTICE '[M-090] auctions, bids 테이블 생성, settings 10개 추가 완료';
END $$;

COMMIT;

-- 검증:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('auctions','bids');
-- SELECT key, value FROM settings WHERE category = 'auction';

-- 274_auction_currency_bundle.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 v2 (docs/ECONOMY_V2_SHIP_F2P_2026-05-29.md) P3 — 경매장 GP↔PP P2P 통화 거래.
--   listing_type='currency' 매물: 판매자가 한 통화(bundle_currency, 예 PP)를 일정량(bundle_amount)
--   내놓고, 다른 통화(currency, 예 GP)로 입찰/즉구 받는다. 무입금 유저가 GP로 PP를 사는 다리.
--   운영자는 GP→PP 발행을 하지 않으며, 이는 순수 유저간 PP 이동(P2P)이다.
--   매수한 PP 는 redeemable_pp(환매 버킷)에 적립되지 않음(addBalance는 pp_balance만) → 비환매 유지.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bundle_currency TEXT;   -- 'PP' | 'GP' (파는 통화)
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bundle_amount NUMERIC;  -- 파는 통화 수량

-- listing_type CHECK 제약에 'currency' 허용 추가(기존 item/cosmetic/claim/resource/ship + currency).
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_listing_type_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_listing_type_check
  CHECK (listing_type::text = ANY (ARRAY['item','cosmetic','claim','resource','ship','currency']::text[]));

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'currency_auction_enabled', 'true',
   '경매장 GP↔PP 통화 번들 거래 on/off. 무입금 유저가 GP로 PP를 사는 P2P 다리.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('274_auction_currency_bundle.sql')
ON CONFLICT DO NOTHING;

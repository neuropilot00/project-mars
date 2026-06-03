-- ============================================================
-- Migration 304: transactions.type 컬럼 폭 확대 (마켓 등록 깨짐 핫픽스)
--
-- 버그: transactions.type 가 varchar(20)인데, transactions_type_check 제약과
--   코드(marketplace.js)는 'marketplace_listing_fee'(23자), 'marketplace_bid_refund'(22자)
--   같은 더 긴 타입을 INSERT 한다. → "value too long for type character varying(20)"로
--   마켓 등록(/api/marketplace/list)이 통째로 실패. 생산자-소비자 재료 순환의 핵심 링크가
--   깨져 있었음(채굴자가 재료를 시장에 못 올림).
--
-- 조치: type 컬럼을 varchar(40)으로 확대. CHECK 제약/코드 변경 불필요.
-- ============================================================

ALTER TABLE transactions ALTER COLUMN type TYPE VARCHAR(40);

INSERT INTO schema_migrations (filename) VALUES ('304_transactions_type_widen.sql') ON CONFLICT DO NOTHING;

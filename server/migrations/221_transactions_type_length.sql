-- Economy transaction type names now include values longer than the original
-- VARCHAR(20), e.g. marketplace_listing_fee and marketplace_bid_refund.
-- Without this, otherwise valid cash-like market/economy actions can fail while
-- writing their audit ledger row.
ALTER TABLE transactions
  ALTER COLUMN type TYPE VARCHAR(64);

INSERT INTO schema_migrations (filename)
VALUES ('221_transactions_type_length.sql')
ON CONFLICT DO NOTHING;

-- Chat polling uses channel + id cursor. Keep incremental reads bounded as chat grows.

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel, id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_wallet_recent ON chat_messages(LOWER(wallet), created_at DESC);

INSERT INTO schema_migrations(filename) VALUES('324_chat_poll_indexes.sql') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  wallet      TEXT NOT NULL,
  nickname    TEXT,
  channel     TEXT NOT NULL DEFAULT 'global',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_time ON chat_messages(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
INSERT INTO schema_migrations(filename) VALUES('212_chat.sql') ON CONFLICT DO NOTHING;

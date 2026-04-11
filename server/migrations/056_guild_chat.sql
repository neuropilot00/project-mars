-- 056: Guild Chat
-- Simple per-guild message feed. Polling-based (no websocket).

CREATE TABLE IF NOT EXISTS guild_messages (
  id SERIAL PRIMARY KEY,
  guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  nickname VARCHAR(50) DEFAULT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_messages_guild_time
  ON guild_messages(guild_id, created_at DESC);

-- Settings: rate limits + history cap
INSERT INTO settings (key, value) VALUES
  ('guild_chat_max_len',       '300'),   -- max characters per message
  ('guild_chat_history_limit', '100'),   -- messages returned per poll
  ('guild_chat_cooldown_sec',  '3')      -- min seconds between messages from same wallet
ON CONFLICT (key) DO NOTHING;

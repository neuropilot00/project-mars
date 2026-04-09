-- 046: Guild System

CREATE TABLE IF NOT EXISTS guilds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  tag VARCHAR(4) NOT NULL UNIQUE,
  leader_wallet VARCHAR(42) NOT NULL,
  description TEXT DEFAULT '',
  emblem_emoji VARCHAR(10) DEFAULT '🔴',
  member_count INT DEFAULT 1,
  total_pixels INT DEFAULT 0,
  gp_treasury DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  wallet VARCHAR(42) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, wallet),
  UNIQUE (wallet)
);

CREATE TABLE IF NOT EXISTS guild_invites (
  id SERIAL PRIMARY KEY,
  guild_id INT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  invited_wallet VARCHAR(42) NOT NULL,
  invited_by VARCHAR(42) NOT NULL,
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS guild_id INT;

CREATE INDEX IF NOT EXISTS idx_guilds_leader ON guilds(leader_wallet);
CREATE INDEX IF NOT EXISTS idx_guild_members_wallet ON guild_members(wallet);
CREATE INDEX IF NOT EXISTS idx_guild_invites_wallet ON guild_invites(invited_wallet, status);
CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id);

INSERT INTO settings (key, value) VALUES
  ('guild_create_cost_gp', '50'),
  ('guild_max_members', '20'),
  ('guild_invite_expire_hours', '72')
ON CONFLICT (key) DO NOTHING;

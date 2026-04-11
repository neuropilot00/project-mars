-- 055: Guild Customization (rename, description, custom pixel-art emblem)

-- Base64 data URL for custom emblem image (enforced max size in service layer)
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS emblem_image TEXT DEFAULT NULL;

-- Settings: costs + emblem constraints
INSERT INTO settings (key, value) VALUES
  ('guild_rename_cost_gp',       '100'),   -- GP cost to rename
  ('guild_desc_cost_gp',         '20'),    -- GP cost to change description
  ('guild_emblem_cost_gp',       '50'),    -- GP cost to upload/replace custom emblem
  ('guild_emblem_max_px',        '32'),    -- emblem resized to 32x32 (Lineage-style)
  ('guild_emblem_max_bytes',     '8192')   -- 8KB cap on base64 image payload
ON CONFLICT (key) DO NOTHING;

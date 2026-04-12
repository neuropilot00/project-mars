-- 063: Fix guild base settings from 046 — add category + description
--
-- Migration 046 inserted guild_create_cost_gp, guild_max_members,
-- guild_invite_expire_hours without category/description, so they
-- landed in the 'general' bucket and had no admin-panel descriptions.

UPDATE settings SET category = 'guilds', description = 'GP cost to create a new guild'
  WHERE key = 'guild_create_cost_gp';

UPDATE settings SET category = 'guilds', description = 'Max members per guild (base, before level bonuses)'
  WHERE key = 'guild_max_members';

UPDATE settings SET category = 'guilds', description = 'Hours before a guild invite expires'
  WHERE key = 'guild_invite_expire_hours';

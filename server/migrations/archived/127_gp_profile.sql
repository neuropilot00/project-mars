-- Migration 127: GP Profile Customization
-- Players spend GP to set/change their nickname, avatar color, and profile motto.
-- Pure GP sink: personalisation drives repeated spending.

-- Nickname history (audit + cooldown tracking)
CREATE TABLE IF NOT EXISTS profile_change_log (
  id           SERIAL PRIMARY KEY,
  wallet       TEXT NOT NULL,
  field        TEXT NOT NULL,   -- 'nickname' | 'avatar_color' | 'motto'
  old_value    TEXT,
  new_value    TEXT,
  gp_spent     INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_change_log_wallet ON profile_change_log(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_change_log_field  ON profile_change_log(wallet, field, created_at DESC);

-- Add motto + avatar_color columns to users (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS motto        VARCHAR(80)  DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(7)   DEFAULT '#FF7840';

-- Settings
INSERT INTO game_settings (key, value, category) VALUES
  ('profile_enabled',                'true',  'profile'),
  ('profile_nickname_first_gp',      '0',     'profile'),   -- first-time set is free
  ('profile_nickname_change_gp',     '100',   'profile'),   -- subsequent changes
  ('profile_nickname_cooldown_h',    '24',    'profile'),   -- hours between changes
  ('profile_nickname_max_length',    '20',    'profile'),
  ('profile_avatar_color_gp',        '50',    'profile'),
  ('profile_avatar_cooldown_h',      '6',     'profile'),
  ('profile_motto_first_gp',         '0',     'profile'),
  ('profile_motto_change_gp',        '30',    'profile'),
  ('profile_motto_cooldown_h',       '12',    'profile'),
  ('profile_motto_max_length',       '80',    'profile'),
  ('profile_nickname_blacklist',     '',      'profile')    -- comma-sep banned words
ON CONFLICT (key) DO NOTHING;

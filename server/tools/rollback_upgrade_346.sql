-- Disable new standard invitations/acceptance, preserving existing no-loss registrations.
-- Keep mode/catalog fields so historical matches cannot become destructive ordinary duels.
UPDATE settings SET value='false'::jsonb WHERE key='standard_duels_enabled';

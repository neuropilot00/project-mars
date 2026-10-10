-- Core fleet/social play is available from the first session. Preserve custom gates.
UPDATE settings SET value=jsonb_set(value,'{fleet}','1'::jsonb)
 WHERE key='base_tab_min_levels' AND jsonb_typeof(value)='object' AND value->>'fleet'='3';
UPDATE settings SET value=jsonb_set(value,'{guild}','1'::jsonb)
 WHERE key='base_tab_min_levels' AND jsonb_typeof(value)='object' AND value->>'guild'='8';
INSERT INTO schema_migrations(filename) VALUES('342_mobile_progression.sql') ON CONFLICT DO NOTHING;

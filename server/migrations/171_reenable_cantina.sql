-- Migration 171: Cantina (Arena) 미니게임 재활성화

INSERT INTO settings (category, key, value, description)
VALUES ('cantina', 'cantina_enabled', 'true', 'Cantina (Arena) 미니게임 활성화')
ON CONFLICT (key) DO UPDATE SET value = 'true';

INSERT INTO schema_migrations (filename) VALUES ('171_reenable_cantina.sql')
ON CONFLICT DO NOTHING;

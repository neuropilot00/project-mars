UPDATE crash_rounds SET status='crashed', crashed_at=NOW() WHERE status IN ('waiting','running');
INSERT INTO schema_migrations (filename) VALUES ('291_crash_round_cleanup.sql') ON CONFLICT DO NOTHING;

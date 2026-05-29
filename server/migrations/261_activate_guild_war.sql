-- 261_activate_guild_war.sql
-- ════════════════════════════════════════════════════════════════
-- 길드 공성전 라이브 활성화 — 유저 부재 시점에 전 기능 ON.
--   설계: docs/GUILD_TERRITORY_WAR_DESIGN_2026-05-29.md
--   선행 검증: mig 258/259/260 + DB e2e(공성→함대전→거버너 길드 이전→세금이 길드 금고).
--   되돌리기: 각 키를 다시 'false' 로 UPDATE 하면 즉시 기존 동작 복귀.
-- ════════════════════════════════════════════════════════════════

UPDATE settings SET value = 'true' WHERE key = 'siege_fleet_combat_enabled';       -- 공성을 실제 함대전으로 해결
UPDATE settings SET value = 'true' WHERE key = 'guild_governance_enabled';          -- 거버너 = 길드 (혈맹이 섹터 소유)
UPDATE settings SET value = 'true' WHERE key = 'siege_governor_canonical_enabled';  -- 공성 승자가 실제 세금/거버너(sectors 정본)
UPDATE settings SET value = 'true' WHERE key = 'sector_tax_to_guild_treasury';      -- 섹터 세수 → 길드 금고
UPDATE settings SET value = 'true' WHERE key = 'siege_full_loss_enabled';           -- 공성 패배 함선 영구 전사(EVE full-loss, 설계 확정)

-- 키가 없을 경우(구버전 DB) 시드로 보강
INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_fleet_combat_enabled', 'true', '공성을 실제 함대전으로 해결'),
  ('siege', 'guild_governance_enabled', 'true', '거버너 = 길드'),
  ('siege', 'siege_governor_canonical_enabled', 'true', '공성 승자가 정본 sectors 거버너/세금'),
  ('siege', 'sector_tax_to_guild_treasury', 'true', '섹터 세수 → 길드 금고'),
  ('siege', 'siege_full_loss_enabled', 'true', '공성 패배 함선 영구 전사')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('261_activate_guild_war.sql')
ON CONFLICT DO NOTHING;

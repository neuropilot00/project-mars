-- 259_guild_governance.sql
-- ════════════════════════════════════════════════════════════════
-- 거버너 = 길드 소유 (혈맹이 섹터를 먹는다). 추가(additive) 방식.
--   설계: docs/GUILD_TERRITORY_WAR_DESIGN_2026-05-29.md §10 + Codex/아키텍트 합의.
--   안전: governor_wallet 유지(대표 표시 + 무길드 호환), guild_governance_enabled 기본 false.
--         컬럼 추가 + backfill 뿐 — 기존 개인 거버너/공성 동작 무변경.
--   정본(canonical): sector_governance (공성 거버너). sectors.governor_wallet 은 표시용 미러로 강등 예정.
-- ════════════════════════════════════════════════════════════════

-- sector_governance: 거버너 길드 + 대표 멤버(표시용)
ALTER TABLE sector_governance ADD COLUMN IF NOT EXISTS governor_guild_id      INT REFERENCES guilds(id) ON DELETE SET NULL;
ALTER TABLE sector_governance ADD COLUMN IF NOT EXISTS governor_member_wallet VARCHAR(42); -- 현 대표(대장) 표시용, FK 안 검 (탈퇴 내성)
CREATE INDEX IF NOT EXISTS idx_sector_gov_guild ON sector_governance(governor_guild_id) WHERE governor_guild_id IS NOT NULL;

-- governor_sieges: 도전/수비/승리 길드
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS challenger_guild_id INT REFERENCES guilds(id) ON DELETE SET NULL;
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS defender_guild_id   INT REFERENCES guilds(id) ON DELETE SET NULL;
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS winner_guild_id     INT; -- 역사 기록용(길드 삭제돼도 보존)

-- 길드 섹터 세수 누적(금고 어뷰징 추적/회계 분리)
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS sector_tax_collected NUMERIC(20,8) DEFAULT 0;

-- ── Backfill: 기존 개인 거버너 → 그가 속한 길드로 승계 (무길드면 NULL 유지 = 기존 동작) ──
UPDATE sector_governance sg
   SET governor_guild_id = u.guild_id,
       governor_member_wallet = sg.governor_wallet
  FROM users u
 WHERE LOWER(u.wallet_address) = LOWER(sg.governor_wallet)
   AND u.guild_id IS NOT NULL
   AND sg.governor_guild_id IS NULL;

-- 설정값 (settings PK = key 단독, value = JSONB)
INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'guild_governance_enabled', 'false',
   '거버너를 길드 소유로 운용할지. true 면 공성 도전/수비/거버너 이전이 길드 단위. false 면 개인 지갑 기반(기존).'),
  ('siege', 'governor_auto_seed_enabled', 'true',
   '미점령(무주공산) 섹터에 한해 픽셀 최다 자동 거버너 시드 허용. 이미 거버너(길드/개인) 있으면 공성으로만 교체.'),
  ('siege', 'sector_tax_to_guild_treasury', 'true',
   '길드 거버너일 때 섹터 세수를 길드 금고(guilds.gp_treasury)로 적립할지.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('259_guild_governance.sql')
ON CONFLICT DO NOTHING;

-- 268_commander_siege.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 커맨더 공성 전투: 맹주(sov 1위)=수비 vs 최강 도전자(sov 2위)=공격.
--   양측 길드원이 다함대 합류(commitSiegeFleet/createSiegeBattleMulti/simulateBattleLive 무변경 재사용).
--   종료 시 resolveCommanderSiege 가 승자 길드를 mars_commander 에 명시 저장. getSovMap 이 우선 반영.
--   Codex 설계: governor_sieges 재사용 + siege_kind 분리, 시스템 섹터 '__commander__' 등록, 명시 저장소.
-- ════════════════════════════════════════════════════════════════

-- governor_sieges 에 종류 구분 (sector=일반 섹터 공성, commander=맹주 공성)
ALTER TABLE governor_sieges ADD COLUMN IF NOT EXISTS siege_kind TEXT DEFAULT 'sector';

-- 시스템 가상 섹터 — governor_sieges.sector_code FK(sector_definitions) 충족용
INSERT INTO sector_definitions (code, name_en, name_ko, name_ja, name_zh, sector_type)
VALUES ('__commander__', 'Mars Capital', '화성 수도', '火星首都', '火星首都', 'core')
ON CONFLICT (code) DO NOTHING;

-- 화성 맹주 명시 저장 (단일행 id=1). getSovMap 이 이 값을 sov 파생보다 우선.
CREATE TABLE IF NOT EXISTS mars_commander (
  id              INT PRIMARY KEY DEFAULT 1,
  guild_id        INT REFERENCES guilds(id) ON DELETE SET NULL,
  guild_tag       VARCHAR(8),
  guild_name      VARCHAR(50),
  elected_siege_id INTEGER,
  since           TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)
);
INSERT INTO mars_commander (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'commander_siege_enabled', 'true', '커맨더 공성(맹주전) 활성화'),
  ('siege', 'commander_full_loss_enabled', 'false', '맹주전 함선 영구전사(경제 충격 큼 — 기본 off, 별도)'),
  ('siege', 'commander_siege_notice_hours', '24', '맹주전 선언~결전 예고(시) — 양측 함대 합류 창')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('268_commander_siege.sql')
ON CONFLICT DO NOTHING;

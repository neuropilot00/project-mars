-- ============================================================
-- Migration 299: 길드 변절(배신) 시스템 — Phase 1 (시스템1 + 시스템3 백본)
--
-- EVE식 배신 루프: 길드원이 변절하며 금고 일부를 탈취(발행 아닌 carve) →
--   길드 제명 → 배신자 낙인(태그) → 남은 금고로 변절자에게 자동 현상금 →
--   재가입 쿨다운. 배신 → 낙인 → 현상금 → 사냥 → 함선 파괴 → GP 싱크 한 바퀴.
--
-- 기존 substrate 재사용: guilds.gp_treasury, guild_treasury_ledger, bounty_listings,
--   player_tags, server_chronicles. 이 마이그는 로그 테이블 + 설정 + 태그 정의만 추가.
-- ============================================================

-- 변절 로그 (재가입 쿨다운 + 감사)
CREATE TABLE IF NOT EXISTS guild_defections (
  id               BIGSERIAL PRIMARY KEY,
  guild_id         BIGINT NOT NULL,
  wallet           VARCHAR(42) NOT NULL,
  role_at_defect   VARCHAR(16) NOT NULL,
  stolen_gp        NUMERIC(20,6) NOT NULL DEFAULT 0,
  bounty_id        BIGINT,
  bounty_gp        NUMERIC(20,6) NOT NULL DEFAULT 0,
  defected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rejoin_allowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guild_defections_wallet ON guild_defections(wallet, rejoin_allowed_at DESC);
CREATE INDEX IF NOT EXISTS idx_guild_defections_guild  ON guild_defections(guild_id, defected_at DESC);

-- 배신자 낙인 태그 정의 (PvP발 태그 — 캠페인 전용이었던 grantTag를 PvP로 확장)
INSERT INTO tag_definitions (id, category, display_name_key, description_key, removable)
  VALUES ('guild_betrayer', 'infamy', 'tag_guild_betrayer', 'tag_guild_betrayer_desc', false)
  ON CONFLICT (id) DO NOTHING;

-- 설정 (settings.key 단독 UNIQUE 없음 → 없을 때만 INSERT)
INSERT INTO settings (category, key, value, description)
  SELECT v.category, v.key, v.value::jsonb, v.description FROM (VALUES
    ('guild', 'guild_defect_enabled', 'true', '길드 변절 기능 활성화'),
    ('guild', 'guild_defect_cut_officer_pct', '40', '간부 변절 시 금고 탈취율 % (간부는 금고 접근권 있어 더 큼)'),
    ('guild', 'guild_defect_cut_member_pct', '15', '일반 멤버 변절 시 금고 탈취율 %'),
    ('guild', 'guild_defect_bounty_pct_of_stolen', '50', '탈취액 대비 자동 현상금 % (남은 금고에서 funding)'),
    ('guild', 'guild_defect_rejoin_cooldown_hours', '72', '변절 후 길드 재가입 금지 시간')
  ) AS v(category, key, value, description)
  WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key);

INSERT INTO schema_migrations (filename) VALUES ('299_guild_defection.sql') ON CONFLICT DO NOTHING;

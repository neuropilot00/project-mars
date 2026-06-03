-- ============================================================
-- Migration 302: PvP 스파이/정찰 (배신 시스템 Phase 3 / 시스템2)
--
-- 그린필드 정보전: 적 함대 구성은 현재 숨겨져 있음(ships_alive 수만 노출).
--   정찰(scout) = GP 소각하고 표적의 전체 함대 구성/전투력을 노출(actionable intel).
--   탐지(detection) 시 표적에게 "누가 정찰했다" 통보 → 보복 → 전투 → 함선 파괴 → GP 싱크.
--   캠페인 스파이 태그(the_handler)는 정찰 비용 할인으로 PvP에 연결(이중첩자).
--
-- GP 소각(정찰 비용)은 경제 싱크에도 기여.
-- ============================================================

CREATE TABLE IF NOT EXISTS spy_reports (
  id             BIGSERIAL PRIMARY KEY,
  scout_wallet   VARCHAR(42) NOT NULL,
  target_wallet  VARCHAR(42) NOT NULL,
  intel          JSONB NOT NULL DEFAULT '{}',
  cost_gp        NUMERIC(20,6) NOT NULL DEFAULT 0,
  detected       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spy_reports_scout  ON spy_reports(scout_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spy_reports_target ON spy_reports(target_wallet, created_at DESC);

INSERT INTO settings (category, key, value, description)
  SELECT v.category, v.key, v.value::jsonb, v.description FROM (VALUES
    ('fleet', 'spy_enabled', 'true', 'PvP 정찰(스파이) 기능 활성화'),
    ('fleet', 'spy_scout_cost_gp', '500', '정찰 1회 GP 비용(소각 싱크)'),
    ('fleet', 'spy_detection_chance_pct', '35', '정찰 탐지(표적 통보) 확률 %'),
    ('fleet', 'spy_intel_ttl_hours', '12', '정찰 인텔 유효 시간(이후 stale)'),
    ('fleet', 'spy_double_agent_discount_pct', '50', '캠페인 스파이 태그(the_handler) 보유 시 정찰 비용 할인 %')
  ) AS v(category, key, value, description)
  WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.key = v.key);

INSERT INTO schema_migrations (filename) VALUES ('302_pvp_spy.sql') ON CONFLICT DO NOTHING;

-- 263_siege_multi_fleet.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 2 — 다(多)함대 공성: 혈맹원 여럿이 각자 함대를 같은 전장에 투입.
--   엔진(battleEngine)은 이미 진영당 N함대를 지원(participants ORDER BY side, 위치 배치).
--   기존 challenger_fleet_id/defender_fleet_id(단일)는 '대표 함대'로 유지(prepareSiegeBattles 게이트 호환).
--   실제 결전엔 siege_fleet_commits 의 모든 함대가 fleet_battle_participants 로 들어간다.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS siege_fleet_commits (
  id           SERIAL PRIMARY KEY,
  siege_id     INTEGER NOT NULL REFERENCES governor_sieges(id) ON DELETE CASCADE,
  wallet       VARCHAR(42) NOT NULL,
  fleet_id     BIGINT NOT NULL,
  side         VARCHAR(8) NOT NULL CHECK (side IN ('atk','def')),
  committed_at TIMESTAMPTZ DEFAULT NOW()
);
-- 한 지갑은 공성당 함대 1개만(측 변경/함대 교체는 upsert). 한 함대는 공성당 1회만.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_siege_commit_wallet ON siege_fleet_commits(siege_id, wallet);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_siege_commit_fleet  ON siege_fleet_commits(siege_id, fleet_id);
CREATE INDEX IF NOT EXISTS idx_siege_commit_side ON siege_fleet_commits(siege_id, side);

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_max_fleets_per_side', '20', '공성 결전에서 한 진영 최대 합류 함대 수')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('263_siege_multi_fleet.sql')
ON CONFLICT DO NOTHING;

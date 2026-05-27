-- Migration 237: 영토 컨디션(HP)/등급/감쇠 시스템
-- ───────────────────────────────────────────────────────────────────────────
-- 영토에 condition(0~100, HP 개념)과 grade(F~S)를 부여.
--   - 매일 감쇠(territory_decay_per_day): 관리 안 하면 condition↓ → grade↓.
--   - TEND(정비): GP 소모해 condition 회복(GP 싱크 + 리텐션 루프).
--   - grade 가 높을수록 수확 PP↑ + 레어 드롭률↑ (등급 보상).
-- 기존 hold_bonus_pct(장기보유)와 별개. 기본 ON.

ALTER TABLE claims ADD COLUMN IF NOT EXISTS condition NUMERIC(5,2) NOT NULL DEFAULT 100;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS grade VARCHAR(2) NOT NULL DEFAULT 'B';
ALTER TABLE claims ADD COLUMN IF NOT EXISTS last_tended_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_claims_condition ON claims (condition) WHERE deleted_at IS NULL;

INSERT INTO settings (category, key, value, description) VALUES
  ('territory', 'territory_condition_enabled', 'true', '영토 컨디션/등급/감쇠 시스템 활성화'),
  ('territory', 'territory_decay_per_day',     '3',    '관리 안 한 영토의 일일 condition 감쇠량'),
  ('territory', 'territory_tend_cost_gp',      '50',   'TEND(정비) 1회 GP 비용'),
  ('territory', 'territory_tend_restore',      '25',   'TEND 1회 condition 회복량'),
  ('territory', 'territory_tend_cooldown_min', '60',   'TEND 최소 간격(분)'),
  ('territory', 'territory_grade_harvest_bonus', '{"S":1.5,"A":1.25,"B":1.1,"C":1.0,"D":0.85,"F":0.6}', '등급별 수확 PP 배수'),
  ('territory', 'territory_grade_rare_bonus',    '{"S":1.5,"A":1.3,"B":1.15,"C":1.0,"D":0.9,"F":0.75}', '등급별 레어 드롭 배수')
ON CONFLICT (key) DO NOTHING;

-- 기존 영토 등급 초기화(condition 100 → grade S 로 시작점 부여; 이후 감쇠로 자연 하락)
UPDATE claims SET grade = 'S', condition = 100, last_tended_at = NOW() WHERE deleted_at IS NULL;

INSERT INTO schema_migrations (filename) VALUES ('237_territory_condition_grade.sql') ON CONFLICT DO NOTHING;

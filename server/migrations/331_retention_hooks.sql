-- 331_retention_hooks.sql
-- Phase3 리텐션 훅 2종.
--   (A) 주간 누적 챌린지: 이번 주(UTC 월요일~) 누적 클레임/채굴/격침 카운트가 목표 도달 시
--       GP 직접지급(carve, 환금불가) 보상 1회 수령. 진행도는 별도 카운터 테이블 없이
--       weekly_challenge_progress(수령 멱등 ledger)만 두고, 실제 진행 수치는 조회 시점에
--       claims/transactions/ship_wrecks를 lazy 집계해 계산(다른 도메인 경로에 훅 박지 않음).
--   (B) 정시 섹터 서지: 설정 시간창 동안 회전 섹터의 채굴/시즌점수 배율 안내(읽기 전용 데이터).
--       실제 배율 적용은 mining/season 도메인 파일 소관 → 본 도메인은 서지 상태만 노출.
--
-- 주간 경계: date_trunc('week', CURRENT_DATE AT TIME ZONE 'UTC')::date (Postgres week = 월요일).
-- 보상=carve(발행 0, 환금불가 GP). redeemable_pp 미발행.

-- ── (A) 주간 챌린지 수령 ledger (멱등 핵심) ──────────────────────
--   진행 카운트 자체는 저장하지 않는다. "이번 주, 이 metric을 수령했는가"만 기록.
--   UNIQUE(wallet, week_start, metric) + FOR UPDATE 로 이중 수령 차단.
CREATE TABLE IF NOT EXISTS weekly_challenge_progress (
  id            BIGSERIAL PRIMARY KEY,
  wallet        VARCHAR(42) NOT NULL,
  week_start    DATE        NOT NULL,
  metric        VARCHAR(20) NOT NULL,   -- 'claim' | 'harvest' | 'kill'
  count         INT         NOT NULL DEFAULT 0,  -- 수령 시점 스냅샷(감사용)
  claimed       BOOLEAN     NOT NULL DEFAULT FALSE,
  reward_gp     BIGINT      NOT NULL DEFAULT 0,
  claimed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (wallet, week_start, metric)
);

CREATE INDEX IF NOT EXISTS idx_weekly_challenge_wallet ON weekly_challenge_progress(wallet, week_start);

-- ── 설정 시드 (JSONB value; 불린 'true'/'false', 숫자 '10') ──────
INSERT INTO settings (category, key, value, description) VALUES
  ('retention', 'weekly_challenge_enabled', 'true',  '주간 누적 챌린지 활성화'),
  -- 목표 카운트 (이번 주 누적)
  ('retention', 'weekly_challenge_claim_target',   '5',  '주간 챌린지: 클레임 목표 횟수'),
  ('retention', 'weekly_challenge_harvest_target', '20', '주간 챌린지: 채굴 목표 횟수'),
  ('retention', 'weekly_challenge_kill_target',    '3',  '주간 챌린지: 격침 목표 횟수'),
  -- 보상 GP (carve, 환금불가)
  ('retention', 'weekly_challenge_claim_reward_gp',   '300', '주간 챌린지: 클레임 목표 달성 GP 보상'),
  ('retention', 'weekly_challenge_harvest_reward_gp', '400', '주간 챌린지: 채굴 목표 달성 GP 보상'),
  ('retention', 'weekly_challenge_kill_reward_gp',    '500', '주간 챌린지: 격침 목표 달성 GP 보상'),
  -- (B) 정시 섹터 서지
  ('retention', 'weekly_surge_enabled',      'true', '정시 섹터 서지 활성화'),
  ('retention', 'weekly_surge_multiplier',   '2.5',  '서지 시간창 채굴/시즌점수 배율(안내용)'),
  ('retention', 'weekly_surge_window_hours', '2',    '서지 지속 시간(시간 단위)'),
  ('retention', 'weekly_surge_period_hours', '6',    '서지 발생 주기(시간 단위, 이 주기 시작마다 window_hours 동안 활성)'),
  ('retention', 'weekly_surge_sectors',      '["frontier","mid","core"]', '서지 회전 대상 섹터 코드 목록(주기마다 순환)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('331_retention_hooks.sql') ON CONFLICT DO NOTHING;

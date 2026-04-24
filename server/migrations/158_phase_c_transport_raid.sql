-- ════════════════════════════════════════════════════════════════════
-- Migration 158 — Phase C: 섹터 간 운송 + 화물 강탈 + Merchant 보너스
--
-- 배경:
--   섹터 시스템(M-156)으로 섹터 간 경제가 분리됐지만 물리적 이동 수단이 없음.
--   Phase C는 운송 업으로 (1) 섹터 경제를 연결, (2) 위험/보상 PvP 레이어
--   (raid), (3) merchant 직업의 실질적 가치 제공을 목표로 한다.
--
-- 변경:
--   1) transport_jobs 테이블 — 섹터 간 운송 작업 (in_transit/completed/raided)
--   2) transport_raids 테이블 — 강탈 시도 로그
--   3) merchant job_buffs 확장 (transport_speed, transport_reward)
--   4) 13개 admin 편집 가능 settings (transport/raid 조율)
--
-- 모두 idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. transport_jobs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_jobs (
  id                SERIAL PRIMARY KEY,
  carrier_wallet    VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  origin_sector_id  INT NOT NULL REFERENCES sectors(id),
  dest_sector_id    INT NOT NULL REFERENCES sectors(id),
  cargo_type        VARCHAR(30) NOT NULL DEFAULT 'gp',
  -- 'gp' | 'item' | 'resource' (현재 MVP는 gp만 구현)
  cargo_value       INT NOT NULL DEFAULT 0,
  cargo_meta        JSONB DEFAULT '{}',
  status            VARCHAR(20) NOT NULL DEFAULT 'in_transit',
  -- 'in_transit' | 'completed' | 'raided' | 'cancelled'
  reward_gp         INT DEFAULT 0,             -- 도착 보상 (계산 후 저장)
  merchant_bonus    BOOLEAN DEFAULT FALSE,     -- merchant 버프 적용 여부
  started_at        TIMESTAMP DEFAULT NOW(),
  arrives_at        TIMESTAMP NOT NULL,
  completed_at      TIMESTAMP,
  raided_by         VARCHAR(42) REFERENCES users(wallet_address),
  raided_at         TIMESTAMP,
  raid_loot_gp      INT DEFAULT 0,
  CHECK (origin_sector_id <> dest_sector_id),
  CHECK (cargo_value >= 0),
  CHECK (status IN ('in_transit','completed','raided','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_transport_carrier
  ON transport_jobs(carrier_wallet, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_transport_active
  ON transport_jobs(status, arrives_at) WHERE status = 'in_transit';
CREATE INDEX IF NOT EXISTS idx_transport_dest
  ON transport_jobs(dest_sector_id, status);

-- ── 2. transport_raids ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_raids (
  id                SERIAL PRIMARY KEY,
  transport_id      INT NOT NULL REFERENCES transport_jobs(id) ON DELETE CASCADE,
  raider_wallet     VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  success           BOOLEAN NOT NULL,
  loot_gp           INT DEFAULT 0,
  fight_seed        VARCHAR(64),
  fight_roll        INT,                -- 0-999 deterministic roll
  success_threshold INT,                -- success if roll < threshold
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raids_transport
  ON transport_raids(transport_id);
CREATE INDEX IF NOT EXISTS idx_raids_raider
  ON transport_raids(raider_wallet, created_at DESC);

-- 한 transport job은 한 번만 강탈 시도 가능 (성공하면 raided, 실패하면 재시도 불가)
CREATE UNIQUE INDEX IF NOT EXISTS uq_raid_per_transport
  ON transport_raids(transport_id);

-- ── 3. merchant 직업 버프 확장 ─────────────────────────────────────
-- 기존 merchant_cross_sector_fee (0.85) 외에 transport 관련 버프 추가
INSERT INTO job_buffs (job_id, buff_key, buff_value, description)
SELECT j.id, v.buff_key, v.buff_value, v.description
  FROM jobs j,
       (VALUES
         ('merchant_transport_speed',  0.7000,  '운송 소요시간 × 0.7 (30% 빠름)'),
         ('merchant_transport_reward', 1.3000,  '운송 보상 GP × 1.3 (30% 추가)'),
         ('merchant_raid_resistance',  0.6000,  '운송 중 강탈 성공률 × 0.6 (merchant 방어)')
       ) AS v(buff_key, buff_value, description)
 WHERE j.code = 'merchant'
   AND NOT EXISTS (
     SELECT 1 FROM job_buffs jb
      WHERE jb.job_id = j.id AND jb.buff_key = v.buff_key
   );

-- ── 4. settings (모두 admin 조율 가능) ─────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  -- Transport (운송)
  ('transport', 'transport_enabled', 'true',
   '섹터 간 운송 시스템 전역 토글'),

  ('transport', 'transport_base_duration_minutes', '15',
   '운송 기본 소요시간 (분). 거리와 별개의 고정 시간'),

  ('transport', 'transport_distance_multiplier', '0.25',
   '운송 시간 거리 계수: 1 unit 거리(섹터 중심점)당 +N분'),

  ('transport', 'transport_reward_pct_of_cargo', '10',
   '도착 시 보상 GP (화물 GP의 %). 거리 보너스는 별도'),

  ('transport', 'transport_reward_distance_bonus_pct', '5',
   '장거리 보너스: 거리 unit당 보상 +%'),

  ('transport', 'transport_min_cargo_gp', '50',
   '운송 가능 최소 화물 GP'),

  ('transport', 'transport_max_cargo_gp', '5000',
   '운송 가능 최대 화물 GP'),

  ('transport', 'transport_max_concurrent_per_user', '3',
   '유저당 동시 in_transit 최대 건수'),

  ('transport', 'transport_entry_level_check', 'true',
   '출발/도착 섹터 진입 레벨 제한을 운송에도 적용'),

  -- Raid (강탈)
  ('raid', 'transport_raid_enabled', 'true',
   '화물 강탈 시스템 전역 토글'),

  ('raid', 'transport_raid_success_base_pct', '35',
   '강탈 성공률 기본값 (%). merchant 방어 버프 미적용 기준'),

  ('raid', 'transport_raid_loot_pct', '30',
   '강탈 성공 시 화물의 %를 강탈자에게. 나머지는 소실'),

  ('raid', 'transport_raid_cooldown_minutes', '10',
   '유저당 강탈 시도 쿨다운 (분)'),

  ('raid', 'transport_raid_min_progress_pct', '20',
   '운송 진행도 %이 이 값 이상이어야 강탈 가능 (출발 직후 보호)'),

  ('raid', 'transport_raid_max_progress_pct', '90',
   '운송 진행도 %이 이 값 이하여야 강탈 가능 (도착 직전 보호)'),

  ('raid', 'transport_raid_self_exempt', 'true',
   '자기 자신의 운송은 강탈 불가'),

  ('raid', 'transport_raid_guild_exempt', 'true',
   '같은 길드 멤버의 운송은 강탈 불가')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- ROLLBACK SQL:
--   DROP TABLE IF EXISTS transport_raids;
--   DROP TABLE IF EXISTS transport_jobs;
--   DELETE FROM job_buffs WHERE buff_key IN (
--     'merchant_transport_speed','merchant_transport_reward','merchant_raid_resistance');
--   DELETE FROM settings WHERE key LIKE 'transport_%' OR key LIKE 'transport_raid_%';
-- ════════════════════════════════════════════════════════════════════

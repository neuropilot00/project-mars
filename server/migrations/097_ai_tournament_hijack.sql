-- ═══════════════════════════════════════════════════════════════
-- Migration 097: Phase C - AI/Tournament/Hijack
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. AI NPC 함대 식별용 ─────────────────────────────────────
-- users 테이블에 is_ai 플래그 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_difficulty VARCHAR(16);   -- easy|normal|hard|elite
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_respawn_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_ai ON users(is_ai) WHERE is_ai = true;

-- ── 2. 토너먼트 ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tournaments (
  id                  BIGSERIAL PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  description         TEXT,
  
  status              VARCHAR(16) DEFAULT 'registering',  
  -- registering: 참가 신청 중
  -- ready: 정원 찼음, 시작 대기
  -- running: 진행 중
  -- completed: 완료
  -- cancelled
  
  max_participants    INTEGER DEFAULT 8,
  min_participants    INTEGER DEFAULT 4,
  current_participants INTEGER DEFAULT 0,
  current_round       SMALLINT DEFAULT 0,
  total_rounds        SMALLINT DEFAULT 3,  -- 8강이면 3라운드
  
  entry_fee_gp        INTEGER DEFAULT 0,
  prize_pool_gp       INTEGER DEFAULT 0,
  reward_1st_gp       INTEGER DEFAULT 1000,
  reward_2nd_gp       INTEGER DEFAULT 500,
  reward_3rd_gp       INTEGER DEFAULT 250,
  
  registration_deadline TIMESTAMPTZ,
  start_at            TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  winner_wallet       VARCHAR(42) REFERENCES users(wallet_address),
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (status IN ('registering','ready','running','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- 참가자
CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  wallet_address  VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  fleet_id        BIGINT NOT NULL REFERENCES fleets(id),
  seed            INTEGER,              -- 브래킷 시드 (0~N)
  
  current_round   SMALLINT DEFAULT 0,
  eliminated_at_round SMALLINT,
  final_rank      INTEGER,
  
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (tournament_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_eliminated 
  ON tournament_participants(tournament_id, eliminated_at_round);

-- 매치 (브래킷)
CREATE TABLE IF NOT EXISTS tournament_matches (
  id              BIGSERIAL PRIMARY KEY,
  tournament_id   BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round           SMALLINT NOT NULL,
  match_index     SMALLINT NOT NULL,       -- 해당 라운드 내 매치 순서
  
  p1_wallet       VARCHAR(42) REFERENCES users(wallet_address),
  p2_wallet       VARCHAR(42) REFERENCES users(wallet_address),
  p1_fleet_id     BIGINT REFERENCES fleets(id),
  p2_fleet_id     BIGINT REFERENCES fleets(id),
  
  battle_id       BIGINT REFERENCES fleet_battles(id),
  winner_wallet   VARCHAR(42) REFERENCES users(wallet_address),
  
  next_match_id   BIGINT REFERENCES tournament_matches(id),  -- 승자가 진출할 매치
  
  status          VARCHAR(16) DEFAULT 'pending',
  -- pending: 대기 중 (p1 or p2 미정)
  -- ready: 양쪽 참가자 확정
  -- running: 전투 중
  -- completed
  -- bye: 부전승
  
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  
  CHECK (status IN ('pending','ready','running','completed','bye'))
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tourney 
  ON tournament_matches(tournament_id, round, match_index);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_ready
  ON tournament_matches(status, scheduled_at) WHERE status IN ('ready','pending');


-- ── 3. Hijack 2단 전투 상세 ────────────────────────────────────
-- 기존 hijack_battles (Migration 093) 구조 확장

-- Phase 1에서 사용 가능한 함선 크기 제한 강화
-- (기존 컬럼 allowed_size_classes_phase1 활용)

-- hijack 진행 상태 타임스탬프
ALTER TABLE hijack_battles 
  ADD COLUMN IF NOT EXISTS phase1_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase1_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase1_winner VARCHAR(8),
  ADD COLUMN IF NOT EXISTS phase2_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase2_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase2_winner VARCHAR(8);


-- ── 4. AI 봇 설정 ──────────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('ai', 'ai_enabled', 'true', 'AI NPC 함대 시스템 활성화'),
  ('ai', 'ai_fleet_count_per_faction', '3', '파벌당 AI 함대 수'),
  ('ai', 'ai_respawn_hours', '2', 'AI 함대 패배 후 재생성 시간 (시간)'),
  ('ai', 'ai_wallet_prefix', '"0xAI00"', 'AI 지갑 주소 접두사'),
  ('tournament', 'auto_match_interval_seconds', '60', '토너먼트 매치 자동 진행 주기(초)')
ON CONFLICT (key) DO NOTHING;


-- ── 5. 편의 뷰 ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_tournament_bracket AS
SELECT 
  tm.tournament_id,
  tm.round,
  tm.match_index,
  tm.id AS match_id,
  tm.status,
  tm.battle_id,
  tm.winner_wallet,
  tm.p1_wallet, u1.nickname AS p1_nickname,
  tm.p2_wallet, u2.nickname AS p2_nickname,
  tm.p1_fleet_id, f1.name AS p1_fleet_name,
  tm.p2_fleet_id, f2.name AS p2_fleet_name,
  fb.winner_side AS battle_winner_side,
  fb.duration_seconds
FROM tournament_matches tm
LEFT JOIN users u1 ON u1.wallet_address = tm.p1_wallet
LEFT JOIN users u2 ON u2.wallet_address = tm.p2_wallet
LEFT JOIN fleets f1 ON f1.id = tm.p1_fleet_id
LEFT JOIN fleets f2 ON f2.id = tm.p2_fleet_id
LEFT JOIN fleet_battles fb ON fb.id = tm.battle_id
ORDER BY tm.tournament_id, tm.round, tm.match_index;

COMMIT;

-- 검증:
-- \d tournaments
-- \d tournament_participants
-- \d tournament_matches  
-- \d hijack_battles
-- SELECT * FROM v_tournament_bracket LIMIT 1;

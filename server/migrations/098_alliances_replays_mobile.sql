-- ═══════════════════════════════════════════════════════════════
-- Migration 098: Phase D - Team Battles & Replay Sharing
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. 동맹/팀 시스템 ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alliances (
  id              BIGSERIAL PRIMARY KEY,
  name            VARCHAR(60) UNIQUE NOT NULL,
  tag             VARCHAR(6) UNIQUE,  -- 짧은 태그 (예: [MCC])
  description     TEXT,
  leader_wallet   VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  faction_code    VARCHAR(8) REFERENCES factions(code),
  color_primary   VARCHAR(8) DEFAULT '#4fc3f7',
  
  member_count    INTEGER DEFAULT 1,
  max_members     INTEGER DEFAULT 20,
  
  battles_won     INTEGER DEFAULT 0,
  battles_lost    INTEGER DEFAULT 0,
  alliance_gp     INTEGER DEFAULT 0,  -- 동맹 금고
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  disbanded_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alliances_name_lower ON alliances(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_alliances_tag ON alliances(tag);

CREATE TABLE IF NOT EXISTS alliance_members (
  alliance_id      BIGINT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  wallet_address   VARCHAR(42) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  role             VARCHAR(16) DEFAULT 'member',  -- leader, officer, member
  joined_at        TIMESTAMPTZ DEFAULT NOW(),
  left_at          TIMESTAMPTZ,
  contribution     INTEGER DEFAULT 0,
  PRIMARY KEY (alliance_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_alliance_members_wallet ON alliance_members(wallet_address);

-- 한 유저는 한 동맹만 active 가능
CREATE UNIQUE INDEX IF NOT EXISTS idx_alliance_members_one_active 
  ON alliance_members(wallet_address) WHERE left_at IS NULL;


-- ── 2. 팀 전투 (동맹전) ───────────────────────────────────────

-- fleet_battles 테이블은 이미 만들어진 상태. team_id 컬럼만 추가.
ALTER TABLE fleet_battle_participants
  ADD COLUMN IF NOT EXISTS team_id SMALLINT,       -- 1,2,3,4 (팀 번호)
  ADD COLUMN IF NOT EXISTS alliance_id BIGINT REFERENCES alliances(id);

-- 팀 전투 메타 (fleet_battles에 team_battle 플래그)
ALTER TABLE fleet_battles
  ADD COLUMN IF NOT EXISTS is_team_battle BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_count SMALLINT;


-- ── 3. 리플레이 공유 ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS battle_replays (
  id               BIGSERIAL PRIMARY KEY,
  battle_id        BIGINT NOT NULL REFERENCES fleet_battles(id) ON DELETE CASCADE,
  share_token      VARCHAR(32) UNIQUE NOT NULL,    -- URL 단축용 랜덤 토큰
  shared_by        VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
  
  title            VARCHAR(100),
  description      TEXT,
  thumbnail_url    TEXT,          -- 프리뷰 이미지 URL (데이터 URL or 외부)
  
  view_count       INTEGER DEFAULT 0,
  is_featured      BOOLEAN DEFAULT false,
  is_public        BOOLEAN DEFAULT true,
  
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ   -- NULL이면 영구
);

CREATE INDEX IF NOT EXISTS idx_replays_token ON battle_replays(share_token);
CREATE INDEX IF NOT EXISTS idx_replays_battle ON battle_replays(battle_id);
CREATE INDEX IF NOT EXISTS idx_replays_featured ON battle_replays(is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replays_shared_by ON battle_replays(shared_by, created_at DESC);

-- 리플레이 조회 로그 (view_count 집계용)
CREATE TABLE IF NOT EXISTS replay_views (
  id          BIGSERIAL PRIMARY KEY,
  replay_id   BIGINT NOT NULL REFERENCES battle_replays(id) ON DELETE CASCADE,
  viewer_ip   VARCHAR(45),
  viewer_ua   VARCHAR(200),
  viewed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replay_views_replay ON replay_views(replay_id, viewed_at);


-- ── 4. 모바일 사용자 설정 ─────────────────────────────────────

-- 디바이스별 UI 설정 저장
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}';
  -- 예: { mobile_reduced_effects: true, haptics: true, touch_controls_preset: 'thumbstick' }


-- ── 5. 편의 설정 ───────────────────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('alliance', 'max_alliance_members', '20',  '동맹 최대 인원'),
  ('alliance', 'alliance_creation_fee_gp', '5000',  '동맹 창설 비용 GP'),
  ('replay',   'default_expire_days', '30',   '리플레이 기본 만료일 (일)'),
  ('replay',   'max_replays_per_user', '50',  '유저당 최대 공유 리플레이 수')
ON CONFLICT (key) DO NOTHING;


-- ── 6. 동맹 요약 뷰 ────────────────────────────────────────────

CREATE OR REPLACE VIEW v_alliance_summary AS
SELECT 
  a.id,
  a.name, a.tag, a.description,
  a.leader_wallet, u.nickname AS leader_nickname,
  a.faction_code,
  fa.name_ko AS faction_name,
  fa.color_primary,
  a.member_count, a.max_members,
  a.battles_won, a.battles_lost,
  a.alliance_gp,
  a.created_at,
  -- 총 함선 수
  (SELECT COUNT(s.id) 
   FROM alliance_members am
   JOIN ships s ON s.owner_wallet = am.wallet_address
   WHERE am.alliance_id = a.id AND am.left_at IS NULL AND s.is_alive = true
  ) AS total_ships_alive
FROM alliances a
LEFT JOIN users u ON u.wallet_address = a.leader_wallet
LEFT JOIN factions fa ON fa.code = a.faction_code
WHERE a.disbanded_at IS NULL;


COMMIT;

-- 검증:
-- \d alliances
-- \d alliance_members
-- \d battle_replays
-- SELECT * FROM v_alliance_summary LIMIT 3;

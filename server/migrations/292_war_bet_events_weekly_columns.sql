-- ============================================================
-- Migration 292: war_bet_events 누락 컬럼 보강 (gamblingAuto weekly_top 지원)
--
-- 증상: [gamblingAuto] resolve loop: column "created_at" does not exist
--       [gamblingAuto] betting create: column "title_ko" of relation "war_bet_events" does not exist
-- 원인: 087 CREATE TABLE에는 title_ko/title_en/option_c_label/total_bet_c/created_at가 없음.
--       gamblingAuto.js(weekly_top 파벌 경쟁)는 이 컬럼들을 SELECT/INSERT 함.
-- 방어적으로 IF NOT EXISTS로 모두 추가한다 (로컬에 이미 있어도 안전).
-- ============================================================

ALTER TABLE war_bet_events ADD COLUMN IF NOT EXISTS title_ko        VARCHAR(255);
ALTER TABLE war_bet_events ADD COLUMN IF NOT EXISTS title_en        VARCHAR(255);
ALTER TABLE war_bet_events ADD COLUMN IF NOT EXISTS option_c_label  VARCHAR(100);
ALTER TABLE war_bet_events ADD COLUMN IF NOT EXISTS total_bet_c     BIGINT DEFAULT 0;
ALTER TABLE war_bet_events ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();

-- weekly_top 파벌 경쟁 이벤트는 외부 siege/guild_war 참조가 없어 event_id=NULL로 생성됨.
-- 087 원본의 event_id NOT NULL 제약을 풀어 NULL 허용 (gamblingAuto.createEvent event_ref_id:null).
ALTER TABLE war_bet_events ALTER COLUMN event_id DROP NOT NULL;

-- created_at 백필 (기존 행은 opens_at 기준으로 채움)
UPDATE war_bet_events SET created_at = COALESCE(created_at, opens_at, NOW()) WHERE created_at IS NULL;

-- weekly_top 조회 인덱스 (event_type + status + closes_at 정렬)
CREATE INDEX IF NOT EXISTS idx_war_bet_events_weekly
  ON war_bet_events(event_type, status, closes_at);

INSERT INTO schema_migrations (filename) VALUES ('292_war_bet_events_weekly_columns.sql') ON CONFLICT DO NOTHING;

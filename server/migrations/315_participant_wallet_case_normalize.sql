-- ============================================================
-- Migration 315: fleet_battle_participants 지갑 케이스 정규화 트리거 (전수 수정)
--
-- 문제: fleet_battle_participants.wallet_address는 users.wallet_address FK(대소문자 구분).
--   AI/NPC 계정 일부가 users에 mixed-case(0xAI00cvH...)로 저장돼 있는데, 여러 전투 경로
--   (phaseC ai/fight, alliance 연합전, tournament, siegeFleetBridge, worldEvents, hijack)가
--   참가자 지갑을 .toLowerCase()해 INSERT → FK 불일치로 500. users PK는 NO ACTION FK 68개라
--   데이터 일괄 소문자화가 불가.
--
-- 해법: BEFORE INSERT 트리거로, 정확히 일치하는 users 행이 없으면 LOWER() 일치하는 users의
--   실제 케이스로 wallet_address를 바꿔 FK를 통과시킨다(전 경로 + 미래 코드까지 한 곳에서 커버).
--   진짜 미존재 지갑은 그대로 둬 FK가 정상적으로 거부한다.
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_fbp_wallet_case() RETURNS trigger AS $$
BEGIN
  IF NEW.wallet_address IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM users u WHERE u.wallet_address = NEW.wallet_address) THEN
    SELECT u.wallet_address INTO NEW.wallet_address
      FROM users u WHERE LOWER(u.wallet_address) = LOWER(NEW.wallet_address) LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fbp_wallet_case ON fleet_battle_participants;
CREATE TRIGGER trg_fbp_wallet_case
  BEFORE INSERT ON fleet_battle_participants
  FOR EACH ROW EXECUTE FUNCTION normalize_fbp_wallet_case();

INSERT INTO schema_migrations (filename) VALUES ('315_participant_wallet_case_normalize.sql') ON CONFLICT DO NOTHING;

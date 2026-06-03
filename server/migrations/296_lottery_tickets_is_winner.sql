-- ============================================================
-- Migration 296: 복권 추첨 깨짐 핫픽스 — lottery_tickets.is_winner 컬럼 추가
--
-- 배경: 프로덕션 로그에서 매 추첨마다 발생하던 에러
--   ERROR: column "is_winner" of relation "lottery_tickets" does not exist
--   STATEMENT: UPDATE lottery_tickets SET is_winner = true WHERE round_id=$1 AND ticket_number=$2
--
--   lottery 서비스(server/services/lottery.js drawRound)는 당첨 티켓을 표시하려
--   is_winner 에 쓰지만, 이 컬럼은 어떤 마이그레이션에도 없었다(179가 만든 최소
--   스키마엔 id/round_id/wallet/ticket_number/created_at 뿐). 이 에러가 추첨
--   트랜잭션 전체를 ROLLBACK 시켜 당첨금 지급·라운드 완료·다음 라운드 생성까지
--   무효화 → 라운드가 영구히 안 닫히고 스케줄러가 매 틱 재시도했다.
--
-- 조치: is_winner 컬럼을 추가한다. (코드의 컬럼명 오타 3건은 lottery.js에서 별도 수정:
--   winner_ticket→winning_ticket_number, purchased_at→created_at, SUM(house_gp)→0)
-- ============================================================

ALTER TABLE lottery_tickets ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (filename) VALUES ('296_lottery_tickets_is_winner.sql') ON CONFLICT DO NOTHING;

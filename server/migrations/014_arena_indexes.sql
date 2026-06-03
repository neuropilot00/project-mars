-- Arena performance indexes
-- (배포 안전 v7.368) 이 인덱스 대상 중 일부(crash_rounds/crash_bets/mines_games)는
-- 더 뒤 마이그(019+)에서 생성된다. fresh 배포에서 014가 먼저 돌면 "relation does not
-- exist"로 전체 체인이 멈춘다 → 테이블 존재 시에만 인덱스를 만들도록 가드.
-- 대상 테이블이 아직 없으면 성능 인덱스는 이후 운영에서 보강된다(기능 정확성엔 영향 없음).
DO $$
BEGIN
  IF to_regclass('public.crash_rounds') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_crash_rounds_status ON crash_rounds (status);
  END IF;
  IF to_regclass('public.crash_bets') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_crash_bets_round_id ON crash_bets (round_id);
    CREATE INDEX IF NOT EXISTS idx_crash_bets_wallet ON crash_bets (wallet);
  END IF;
  IF to_regclass('public.mines_games') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_mines_games_wallet_status ON mines_games (wallet, status);
  END IF;
  IF to_regclass('public.transactions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_transactions_type_created ON transactions (type, created_at);
  END IF;
  IF to_regclass('public.claims') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims (created_at);
  END IF;
  IF to_regclass('public.pixels') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_pixels_owner ON pixels (owner);
  END IF;
END $$;

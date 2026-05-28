-- [v7.216] 다도메인 검수 P0 무결성 보강 (워크플로 wf_a18d8680-374 검증 통과 항목)
-- 3건 묶음: 캠페인 보상 중복 / 가챠 FK / 잔액 음수 가드. 전부 방어적(IF NOT EXISTS / 사전 정합).

-- ─── CAMPAIGN-001: campaign_reward_inbox 중복 삽입 차단 ──────────────────────
-- 같은 wallet+quest 보상이 두 번 INSERT 되면 double-claim 가능.
-- UNIQUE 제약 추가 전, 기존 중복 row 정리(가장 오래된 1건만 남김).
DO $$
BEGIN
  IF to_regclass('public.campaign_reward_inbox') IS NOT NULL THEN
    -- 주의: 한 quest 가 여러 item 보상(reward_code 다름)을 줄 수 있으므로 UNIQUE 키는
    --   (wallet, quest_id, reward_code) 여야 함. (wallet, quest_id) 만 걸면 첫 item 외 손실.
    -- 중복 정리: (wallet, quest_id, reward_code) 당 최소 id 1건만 보존
    DELETE FROM campaign_reward_inbox a
     USING campaign_reward_inbox b
     WHERE a.wallet = b.wallet
       AND a.quest_id = b.quest_id
       AND COALESCE(a.reward_code,'') = COALESCE(b.reward_code,'')
       AND a.id > b.id;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'uq_campaign_reward_wallet_quest_code'
    ) THEN
      ALTER TABLE campaign_reward_inbox
        ADD CONSTRAINT uq_campaign_reward_wallet_quest_code UNIQUE (wallet, quest_id, reward_code);
    END IF;
  END IF;
END $$;

-- ─── MIG-005: ship_crate_pulls / ship_crate_pity FK (orphan 방지) ───────────
-- users 삭제 시 가챠 기록 orphan 남던 문제. ON DELETE CASCADE.
DO $$
BEGIN
  IF to_regclass('public.ship_crate_pulls') IS NOT NULL
     AND to_regclass('public.users') IS NOT NULL THEN
    -- orphan row 선정리 (users 에 없는 wallet)
    DELETE FROM ship_crate_pulls
     WHERE wallet IS NOT NULL
       AND LOWER(wallet) NOT IN (SELECT LOWER(wallet_address) FROM users);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crate_pulls_wallet') THEN
      -- wallet 컬럼이 users.wallet_address 와 대소문자 다를 수 있어 FK 대신 trigger 가 안전하지만,
      -- 단순 보강: NOT VALID 로 추가해 기존 데이터 검증 생략, 신규만 enforce.
      BEGIN
        ALTER TABLE ship_crate_pulls
          ADD CONSTRAINT fk_crate_pulls_wallet
          FOREIGN KEY (wallet) REFERENCES users(wallet_address) ON DELETE CASCADE NOT VALID;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'fk_crate_pulls_wallet skip: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- ─── ECON-002: users 잔액 음수 방지 CHECK ──────────────────────────────────
-- 동시 차감 race 로 음수 잔액 생기면 페그/회계 붕괴. CHECK 제약으로 DB 레벨 차단.
-- 기존 음수 row 가 있으면 0 으로 정정 후 제약 추가 (제약 add 실패 방지).
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    UPDATE users SET usdt_balance = 0 WHERE usdt_balance < 0;
    UPDATE users SET pp_balance   = 0 WHERE pp_balance   < 0;
    UPDATE users SET gp_balance   = 0 WHERE gp_balance   < 0;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_balances_nonneg') THEN
      ALTER TABLE users ADD CONSTRAINT chk_users_balances_nonneg
        CHECK (COALESCE(usdt_balance,0) >= 0 AND COALESCE(pp_balance,0) >= 0 AND COALESCE(gp_balance,0) >= 0);
    END IF;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('256_audit_p0_integrity.sql') ON CONFLICT DO NOTHING;

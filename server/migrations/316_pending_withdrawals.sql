-- ============================================================
-- Migration 316: pending_withdrawals — 출금 예약/정산 원장 (P0 정산 desync 차단)
--
-- 문제(적대 검수 P0): 기존 /withdraw 는 DB usdt_balance 차감 + DB withdrawal_nonce++ 후
--   서명만 반환했다. 컨트랙트 withdrawNonce[user] 는 유저가 온체인 withdraw 를 성공시켜야만
--   증가하므로, 유저가 서명을 제출 안 하거나(브라우저 닫음/가스부족/deadline 만료/revert) 하면:
--     (1) DB 잔액은 이미 증발(환불 경로 없음)
--     (2) DB nonce 와 컨트랙트 nonce 가 영구 desync → 이후 모든 출금이 nonce 불일치로 revert
--
-- 해법: 출금을 "예약"으로 처리.
--   - 서명 nonce 는 DB 가 아니라 온체인 withdrawNonce(eth_call)에서 읽는다(진실 원천 = desync 불가).
--   - 예약 시 잔액/담보를 reserve(차감)하고 pending row 를 남긴다.
--   - 미만료 pending 이 있으면 새 서명을 발급하지 않고 기존 서명을 재발급(중복 차감 방지).
--   - Withdrawn 이벤트 관측 시 status='settled'(차감 확정).
--   - deadline+grace 경과 & 온체인 nonce 미증가(=미실행) 확인 시 자동 환불(status='expired').
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_withdrawals (
  id            BIGSERIAL PRIMARY KEY,
  wallet_address TEXT      NOT NULL,
  chain         TEXT       NOT NULL,
  nonce         BIGINT     NOT NULL,                  -- 서명에 쓴 온체인 nonce
  gross         NUMERIC    NOT NULL,                  -- 유저 잔액에서 차감한 요청 전액
  net           NUMERIC    NOT NULL,                  -- 온체인 전송액(=gross-fee), 담보 차감액과 동일
  fee           NUMERIC    NOT NULL DEFAULT 0,        -- 표시/회계용 수수료(담보 잔류분)
  amount_units  TEXT       NOT NULL,                  -- net 의 토큰 base-unit 문자열(컨트랙트 amount 인자)
  deadline      BIGINT     NOT NULL,                  -- 서명 만료 unix seconds
  signature     TEXT       NOT NULL,
  status        TEXT       NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at    TIMESTAMPTZ,
  CONSTRAINT pending_withdrawals_status_chk CHECK (status IN ('pending','settled','expired')),
  CONSTRAINT pending_withdrawals_gross_chk  CHECK (gross >= 0),
  CONSTRAINT pending_withdrawals_net_chk    CHECK (net  >= 0)
);

-- 한 유저당 open(pending) 출금은 (chain,nonce) 하나만 — 같은 nonce 이중 발급 차단.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_wd_open
  ON pending_withdrawals (chain, wallet_address, nonce)
  WHERE status = 'pending';

-- open 행 빠른 조회(재발급/유동성 예약 합산/리코실리어).
CREATE INDEX IF NOT EXISTS idx_pending_wd_open_lookup
  ON pending_withdrawals (wallet_address, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_wd_recon
  ON pending_withdrawals (status, deadline)
  WHERE status = 'pending';

INSERT INTO schema_migrations (filename) VALUES ('316_pending_withdrawals.sql') ON CONFLICT DO NOTHING;

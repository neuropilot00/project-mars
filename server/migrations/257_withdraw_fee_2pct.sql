-- [v7.217 ECON-005] USDT 출금 수수료 0 → 2%.
-- swap(PP→USDT) 은 5% 수수료, withdraw(USDT 출금) 은 0% 라 담보가 수수료 없이 빠져나가던 비대칭.
-- 2% 부과로 담보 유출 억제 + 페그 강화. fee 분은 체인 전송 안 하고 담보(collateral)에 잔류.
-- api.js withdraw 핸들러가 settings.withdraw_fee_percent 를 읽어 net=요청액*(1-fee%) 만 체인 서명.
-- 운영자 조정: 0~20% 범위 (코드에서 clamp). 사용자 결정 = 2%.

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'withdraw_fee_percent', '2', 'Fee % on USDT withdrawal (담보 유출 방지, 0~20). net=요청액*(1-fee%)만 체인 전송.')
ON CONFLICT (key) DO UPDATE SET value = '2', description = EXCLUDED.description;

INSERT INTO schema_migrations (filename) VALUES ('257_withdraw_fee_2pct.sql') ON CONFLICT DO NOTHING;

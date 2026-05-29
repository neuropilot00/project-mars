-- 271_redeemable_pp_gating.sql
-- ════════════════════════════════════════════════════════════════
-- 경제 정책 (docs/ECONOMY_TOKEN_POLICY_2026-05-29.md) — "담보-룸 소프트 환매" W2-6.
--
-- 목표: PP→USDT 환매를 "입금 연동 잔액(redeemable_pp)"으로만 제한한다.
--   채굴·가챠·추천·캠페인으로 얻은 PP는 USDT 직행 불가(GP 환전만 가능) →
--   봇이 일일 채굴 cap 을 멀티계정으로 긁어 USDT 로 탈출하는 차익 구멍을 닫는다.
--
-- 솔벤시 하드 가드는 여전히 treasury room(담보) 가드(mig 230)다.
--   redeemable_pp 게이팅은 그 위에 얹는 봇-차익 차단 레이어이며 담보 불변식을 약화시키지 않는다.
--   (redeemable 로직에 빈틈이 있어도 swap UPDATE 의 `pp_balance >= $1` + room 가드가 미담보 발행을 막음.)
--
-- 불변식: 0 ≤ users.redeemable_pp ≤ users.pp_balance (항상).
-- ════════════════════════════════════════════════════════════════

-- ── redeemable_pp 컬럼 ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS redeemable_pp NUMERIC NOT NULL DEFAULT 0;

-- 백필: 프리런칭(USDT 0, 입금 0)이므로 기존 유저 PP 는 전부 채굴/가챠(=비환매).
--   따라서 redeemable_pp = 0 이 정확하다. 향후 입금이 redeemable_pp 를 적립.
--   (혹시 모를 음수/초과 방어: 0..pp_balance 로 clamp)
UPDATE users SET redeemable_pp = LEAST(GREATEST(redeemable_pp, 0), pp_balance);

-- ── 불변식 중앙 강제 트리거 ──
-- PP 차감 사이트가 16곳(shop/claim/exchange/hijack/mission 등) 산재해 있어, 각 사이트마다
-- redeemable_pp 클램프를 넣으면 누락 위험이 크다. DB 트리거로 BEFORE INSERT/UPDATE 시점에
-- redeemable_pp ≤ pp_balance 를 단일 지점에서 강제한다(모든 현재/미래 writer 자동 커버).
--   의미: PP 를 어디서든 소비해 잔액이 줄면 redeemable_pp 도 같이 줄어든다(LEAST 시맨틱).
--   순수 채굴/가챠 유저는 redeemable_pp 가 한 번도 적립되지 않아 항상 0 → USDT 환매 전면 차단.
CREATE OR REPLACE FUNCTION clamp_redeemable_pp() RETURNS trigger AS $$
BEGIN
  IF NEW.redeemable_pp IS NULL THEN NEW.redeemable_pp := 0; END IF;
  IF NEW.redeemable_pp < 0 THEN NEW.redeemable_pp := 0; END IF;
  IF NEW.pp_balance IS NOT NULL AND NEW.redeemable_pp > NEW.pp_balance THEN
    NEW.redeemable_pp := GREATEST(NEW.pp_balance, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clamp_redeemable_pp ON users;
CREATE TRIGGER trg_clamp_redeemable_pp
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION clamp_redeemable_pp();

-- ── 설정값 (JSONB) ──
INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'redeemable_pp_gating_enabled', 'true',
   'PP→USDT 환매를 redeemable_pp(입금 연동 잔액)로 제한. 채굴/가챠 PP는 GP 환전만 가능. 프리런칭 기본 on(기존 PP는 비환매라 동작 변화 없음).'),
  ('economy', 'redemption_weekly_cap_enabled', 'false',
   '주간 환매 한도 게이트. 런칭 후 입금 흐름 확인 뒤 on — 입금 0일 때 30%=0 잠금 footgun 회피.'),
  ('economy', 'redemption_weekly_cap_pct', '30',
   '주간 신규입금(USDT) 대비 환매 허용 %. 환매 부채를 매출에 자동 연동.'),
  ('economy', 'redemption_weekly_cap_floor_usdt', '100',
   '주간 환매 절대 바닥(USDT). 입금 정체 시 전면 잠금 방지. cap = max(floor, 입금*pct%).'),
  ('economy', 'redemption_daily_limit_usdt', '0',
   '유저별 일일 환매 한도(USDT). 0 = 무제한.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('271_redeemable_pp_gating.sql')
ON CONFLICT DO NOTHING;

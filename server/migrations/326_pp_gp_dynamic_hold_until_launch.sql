-- ============================================================
-- Migration 326: 동적 PP→GP 환율 — 런칭 전까지 중립 보류(EVE 충실 운영)
--
-- 배경: 동적 밴딩(mig233/234, exchangeRate.js)은 EVE식 수급 밴딩이 맞다. 그러나 양방향 밴드가
--   "양방향으로" 숨쉬려면 target(pp_to_gp_exchange_daily_vol_target)이 실제 24h 환전량과 맞아야 한다.
--   현재 target=1000 PP/24h 는 추정치라, 소규모/프리런칭 볼륨(D≪1000)에선
--     deltaFrac = -step * (D-target)/target  > 0  →  rate 가 ceil(20)로 영구 드리프트
--   = PP당 GP 2배 발행 = GP 인플레(밴드 의도와 정반대). min_activity=50 은 50 PP 미만만 동결.
--
-- EVE 정석: 인플레는 환율 캡이 아니라 싱크(full-loss/수리/건조/카지노 엣지)로 잡고, 환율은
--   "실제 시장 볼륨"이 생긴 뒤 양방향으로 자유 변동시킨다. 따라서 볼륨이 없는 지금은 밴드를 돌리지
--   않고 중립 고정(10)으로 보류한다. 양방향 밴드 설정(floor/ceil/step/target)은 그대로 보존.
--
-- 이번 변경:
--   1) pp_to_gp_dynamic_enabled = false  (밴드 스케줄러 no-op, 천장 드리프트 차단)
--   2) pp_to_gp_exchange_rate = 10        (프리런칭 중 이미 드리프트했을 값을 base 로 리셋)
--   floor/ceil/step/target/min_activity 는 의도적으로 건드리지 않는다(런칭 시 재튜닝 대상).
--
-- ── 런칭 후 EVE식 양방향 활성화 절차 (이 마이그로 하지 않음 — 실데이터 필요) ──
--   a) 1~2주 실운영하며 24h PP→GP 환전량 관측:
--        SELECT date_trunc('day',created_at) d, SUM(pp_amount)
--          FROM transactions WHERE type='pp_to_gp_exchange'
--          GROUP BY 1 ORDER BY 1 DESC;
--      (밴드 변동 이력은 pp_gp_rate_history 참조)
--   b) pp_to_gp_exchange_daily_vol_target = 관측 24h 중앙값으로 설정(추정 1000 금지).
--   c) pp_to_gp_exchange_min_activity   = target 의 ~20~30% (저활동 드리프트 방지, 코드 주석 권고).
--   d) pp_to_gp_dynamic_enabled = true  → 이후 밴드가 [floor,ceil] 안에서 양방향 자가균형(EVE식).
--   * 인플레가 우려되면 ceil 을 낮추기보다 싱크(수리/건조/엣지)를 조이는 것이 EVE 정석.
-- ============================================================

UPDATE settings SET value = 'false' WHERE key = 'pp_to_gp_dynamic_enabled';
UPDATE settings SET value = '10'    WHERE key = 'pp_to_gp_exchange_rate';

INSERT INTO schema_migrations (filename) VALUES ('326_pp_gp_dynamic_hold_until_launch.sql') ON CONFLICT DO NOTHING;

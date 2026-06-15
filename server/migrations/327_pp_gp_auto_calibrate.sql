-- ============================================================
-- Migration 327: 동적 PP→GP 환율 자가보정(self-calibration) — 무인 EVE 운영
--
-- mig326 은 target 추정치(1000) 위험 때문에 동적을 임시 OFF 했다. 327 은 운영자가 target/min_activity 를
-- 손으로 잡지 않아도 되게 exchangeRate.js 가 스스로 보정하도록 만들고 다시 ON 한다.
--
-- 동작(exchangeRate.js recomputeRate, 1h 스케줄):
--   1) 부트스트랩 게이트: 최근 window_days 중 활동일(일 환전량>0)이 min_active_days 미만이면
--      실시장이 아직 없다고 보고 환율을 base(중립 10)로 "유지"만 한다 → 저볼륨 천장 드리프트(GP 인플레)
--      원천 차단. (mig326 가 막던 문제를 로직 차원에서 영구 해소.)
--   2) 실데이터 충분: target = 최근 일별 환전량의 중앙값(스파이크 강건), min_activity = target×frac.
--      그 위에서 24h 수요 D 와 비교해 [floor,ceil] 안에서 ±step 양방향 밴딩(EVE식 수급 변동).
--      산출한 target/min_activity 는 settings 에 기록되어 어드민에서 가시.
--
-- => 운영자 개입 0. 볼륨이 생기면 자동으로 실볼륨에 맞춰 양방향 밴드가 가동되고, 없으면 중립 유지.
--    인플레가 우려되면 ceil 을 낮추기보다 싱크(수리/건조/엣지)를 조이는 것이 EVE 정석(환율은 시장에).
-- ============================================================

-- 자가보정 ON + 동적 재활성(부트스트랩 게이트가 있어 저볼륨에서도 안전)
INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'pp_to_gp_auto_calibrate',          'true', '동적 PP→GP target/min_activity 자가보정(ON이면 수동 튜닝 불필요)'),
  ('economy', 'pp_to_gp_rate_base',               '10',   '부트스트랩(실볼륨 부족) 중 유지할 중립 환율'),
  ('economy', 'pp_to_gp_calib_window_days',       '14',   '자가보정 관측 윈도우(일)'),
  ('economy', 'pp_to_gp_calib_min_active_days',   '5',    '양방향 밴딩 시작에 필요한 최소 활동일수(미만=중립 유지)'),
  ('economy', 'pp_to_gp_calib_min_activity_frac', '0.25', 'min_activity = target × 이 비율(저활동 노이즈 드리프트 방지)')
ON CONFLICT (key) DO NOTHING;

-- 자가보정 게이트가 저볼륨을 막으므로 동적 재활성. rate 는 base(10)에서 시작.
UPDATE settings SET value = 'true' WHERE key = 'pp_to_gp_dynamic_enabled';
UPDATE settings SET value = '10'   WHERE key = 'pp_to_gp_exchange_rate';

INSERT INTO schema_migrations (filename) VALUES ('327_pp_gp_auto_calibrate.sql') ON CONFLICT DO NOTHING;

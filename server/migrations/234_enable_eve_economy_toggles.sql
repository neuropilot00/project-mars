-- Migration 234: EVE 경제 토글 ON (운영자 결정) — full-loss + 동적환율 라이브화
-- ───────────────────────────────────────────────────────────────────────────
-- 운영자 지시: "언제 유저가 들어와도 실제와 동일한 상태여야 한다" → 기본 OFF 였던
-- 두 경제 기능을 프로덕션 포함 ON 으로 고정(배포 시 settings 갱신).
--   1) hijack_ship_loss_enabled: 하이젝 격침 함선 영구파괴(EVE full-loss 수요엔진).
--      재건조 경로(조선소/가챠/마켓) 존재 → dead-end 없음.
--   2) pp_to_gp_dynamic_enabled: PP→GP 환율 수급 밴딩(±2% step, [5,20] 밴드).
-- ⚠️ pp_to_gp_exchange_daily_vol_target(기본 1000)은 현 유저 규모 대비 클 수 있어
--    저활동 시 rate 가 ceil(20)로 서서히 상향될 수 있음. 실거래량 확인 후 admin 에서 target 튜닝 권장.

UPDATE settings SET value = 'true' WHERE key = 'hijack_ship_loss_enabled';
UPDATE settings SET value = 'true' WHERE key = 'pp_to_gp_dynamic_enabled';

-- 저활동 드리프트 방지: 24h 환전량이 이 값 미만이면 환율 유지(신호 없음).
-- 소규모 초기 경제 보호. 운영자는 실거래량 관찰 후 target/min_activity 를 함께 튜닝.
INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'pp_to_gp_exchange_min_activity', '50', '24h 환전량이 이 미만이면 동적환율 유지(저활동 드리프트 방지)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('234_enable_eve_economy_toggles.sql') ON CONFLICT DO NOTHING;

-- ============================================================
-- Migration 313: 승리 슬롯 — Sink 기반 (순발행 0, 반인플레 유지)
--
-- 전투 승리 시 슬롯을 돌려 추가 GP를 받되, 그 GP는 신규 발행이 아니라 victory_slot_pool에서
-- 차감(carve). 풀은 함선 수리 GP 싱크의 일부를 소각 대신 적립해 채운다 → 소각될 GP를 승자에게
-- 재분배(EVE식 순환). 풀이 비면 슬롯 보상도 줄어든다(상한 = 풀 잔액).
-- ============================================================

CREATE TABLE IF NOT EXISTS victory_slot_pool (
  id      INT PRIMARY KEY DEFAULT 1,
  pool_gp NUMERIC NOT NULL DEFAULT 0,
  CONSTRAINT victory_slot_pool_single CHECK (id = 1)
);
INSERT INTO victory_slot_pool (id, pool_gp) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- 전투당 1회 스핀 (중복 방지)
CREATE TABLE IF NOT EXISTS victory_slot_claims (
  battle_id  BIGINT NOT NULL,
  wallet     VARCHAR(100) NOT NULL,
  payout_gp  NUMERIC NOT NULL DEFAULT 0,
  multiplier NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (battle_id, wallet)
);

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'victory_slot_enabled', 'true', '승리 슬롯 활성화'),
  ('fleet', 'victory_slot_repair_feed_pct', '20', '함선 수리 GP의 N%를 소각 대신 승리 슬롯 풀에 적립'),
  ('fleet', 'victory_slot_base_gp', '50', '슬롯 기본 베팅 단위(배수 곱 전)'),
  ('fleet', 'victory_slot_weights', '[{"m":0,"w":18},{"m":1,"w":40},{"m":2,"w":24},{"m":3,"w":12},{"m":5,"w":5},{"m":10,"w":1}]', '슬롯 배수 가중치(m=배수, w=가중치). 0=꽝')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('313_victory_slot.sql') ON CONFLICT DO NOTHING;

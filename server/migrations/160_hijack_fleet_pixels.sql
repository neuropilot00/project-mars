-- Migration 160: Hijack Fleet Battle — Pixel Transfer Support
-- 함대전 하이젝 시 이겼을 때 픽셀 이전을 위한 컬럼 추가

ALTER TABLE hijack_battles
  ADD COLUMN IF NOT EXISTS pending_pixels JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pp_paid        NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_claim_id   INT REFERENCES claims(id);

-- 설정: fleet_hijack_enabled (false = 기존 랜덤 전투 방식)
INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'fleet_hijack_enabled', 'true',  '함대전 하이젝 활성화 (true = 함대전, false = 기존 랜덤 방식)')
ON CONFLICT (key) DO NOTHING;

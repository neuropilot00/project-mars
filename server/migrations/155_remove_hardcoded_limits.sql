-- ════════════════════════════════════════════════════════════════════
-- Migration 155 — 하드코딩 제거: settings로 이전
--
-- 이전에 코드에 박혀있던 매직 넘버를 settings 테이블로 옮긴다.
-- (CLAUDE.md 원칙: 게임 밸런스 값은 모두 settings + admin 편집 가능)
--
-- + Production DB 안전망: users.level 컬럼이 일부 환경에 없을 수 있어
--   idempotent하게 보장 (job.js가 더 이상 참조 안 하지만 다른 코드 대비)
-- ════════════════════════════════════════════════════════════════════

-- ── users.level 안전망 ─────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;

-- ── 새 settings (모두 admin 편집 가능) ─────────────────────────────
INSERT INTO settings (category, key, value, description) VALUES
  -- Commander Actions: reinforce 함선 수 상한
  ('commander', 'commander_action_reinforce_max_count', '20',
   'Commander Action "reinforce"로 한 번에 합성 가능한 함선 최대 수'),

  -- Resource Crafting: 한 작업당 수량 상한
  ('crafting', 'resource_craft_max_quantity_per_job', '50',
   '제작 작업 1건당 최대 수량 (재료 차감 폭주 방지)'),

  -- Resource Crafting: 기본 제작 시간 (resources 테이블에 craft_time_seconds 없을 때 fallback)
  ('crafting', 'resource_craft_default_seconds', '600',
   '제작 시간 기본값 (초). resources.craft_time_seconds 누락 시 fallback'),

  -- Resource Crafting: 취소 시 재료 환불 %
  ('crafting', 'resource_craft_cancel_refund_pct', '50',
   '제작 작업 취소 시 재료 환불율 (0-100)')
ON CONFLICT (key) DO NOTHING;

-- Migration 161: hijack_battles에 attack_cost 컬럼 추가
-- 함대전 하이젝에서 패배 시 90% 환불 계산에 필요

ALTER TABLE hijack_battles
  ADD COLUMN IF NOT EXISTS attack_cost NUMERIC(12,4) DEFAULT 0;

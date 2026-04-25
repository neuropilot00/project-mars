-- Migration 186: Rank auto-recalc settings
-- 사용자 신고: "레벨업 기준 다 통과한 상태인데 레벨업이 안되고 있음"
-- 원인: XP 누적 후 rank_level 자동 재계산 트리거 부재 (admin/recalc-ranks 수동 호출만)
-- 해결: services/rank.js + lazy trigger + 5분 스케줄러. 본 마이그레이션은 settings 시드만.

INSERT INTO settings (category, key, value, description) VALUES
  ('rank', 'rank_auto_recalc_enabled', 'true',
     '레벨 자동 재계산 마스터 토글 (true/false). off 면 admin 수동 호출만 동작.'),
  ('rank', 'rank_recalc_interval_seconds', '300',
     '주기적 batch 재계산 간격 (초). 기본 5분.'),
  ('rank', 'rank_recalc_lookback_hours', '24',
     'batch 시 최근 N시간 내 로그인한 유저만 처리 (full-table scan 회피).'),
  ('rank', 'rank_recalc_batch_size', '500',
     '한 batch 당 처리 최대 유저 수.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('186_rank_auto_recalc.sql') ON CONFLICT DO NOTHING;

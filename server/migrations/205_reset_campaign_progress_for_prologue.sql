-- ═══════════════════════════════════════════════════════════
-- 205: Campaign 진행도 전체 리셋 — Ch0 (prologue) 추가 대응
-- ═══════════════════════════════════════════════════════════
-- 배경: prologue_shared.json 이 새로 추가되어 모든 루트의 시작점이
-- chapterNumber 0 (mcc_prologue / fsp_prologue / cv_prologue) 로 바뀌었다.
-- 기존 플레이어 진행도는 prologue 없이 Ch1부터 시작된 것이므로
-- 스토리 연속성이 깨진다.
--
-- 해결: player_campaign_progress, campaign_sessions, player_lore_flags,
-- player_branch_modifiers 를 전부 리셋하여 모든 유저가 Ch0부터 재시작.
-- ═══════════════════════════════════════════════════════════

-- 1. 진행 중 / 완료된 세션 전부 제거
TRUNCATE TABLE campaign_sessions RESTART IDENTITY CASCADE;

-- 2. 챕터 진행 기록 전부 제거
TRUNCATE TABLE player_campaign_progress RESTART IDENTITY CASCADE;

-- 3. 스토리 분기 플래그 전부 제거 (Ch0 이전에 쌓인 것들이므로 무효)
TRUNCATE TABLE player_lore_flags RESTART IDENTITY CASCADE;

-- 4. 분기 수정자 전부 제거
TRUNCATE TABLE player_branch_modifiers RESTART IDENTITY CASCADE;

-- ─── 완료 메시지 (psql 에서 직접 실행 시 확인용) ───────────────
DO $$
BEGIN
  RAISE NOTICE 'Migration 205: Campaign progress reset complete. All players will restart from Ch0 (Prologue).';
END $$;

INSERT INTO schema_migrations (filename)
VALUES ('205_reset_campaign_progress_for_prologue.sql')
ON CONFLICT DO NOTHING;

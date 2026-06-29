-- 332_newplayer_combat_grace.sql
-- 신규 유저 full-loss 유예(combat grace) 설정 시드.
--   full-loss(격침 함선 영구소멸)는 게임 정체성이라 전역 제거하지 않는다(베테랑은 그대로 영구파괴).
--   다만 보호 대상(온보딩 미완료 OR rank_level ≤ max_rank OR 계정 생성 ≤ max_age_days)의 격침함은
--   영구소멸 대신 "대파"(current_hp=1, 수리 가능 상태)로 생존시켜 신규가 첫 전투에서 함대를 통째로
--   잃고 이탈하는 마찰을 제거한다. 되돌릴 수 있는 개선 — admin Settings 에서 OFF/조정 가능.
--
--   구현: server/services/battleRewards.js#applyNewPlayerCombatGrace
--     함선 영구파괴는 battleEngine.applyBattleResults(읽기전용)에서 보상 분배보다 먼저 일어나므로,
--     battleRewards 가 이번 전투에서 방금 파괴된 보호 대상 함선을 보상 트랜잭션 안에서 되살리고
--     (current_hp=1, is_alive=true, destroyed_at=NULL), 해당 ship_wrecks 킬보드 행을 제거해
--     유령 킬을 막는다. 대상 범위는 이번 battle 의 참가 함대로 한정된다.
--
--   기존 hijack 신규 보호(hijack_newbie_protection_*)와 일관 — 단 combat grace 는 전투를 차단하지
--   않고 손실을 대파로 전환하며, 레벨 기준으로 users.rank_level(진행도 표준 컬럼)을 사용한다.

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'newplayer_combat_grace_enabled', 'true',
     '신규 유저 격침 함선 full-loss 유예 ON/OFF (영구소멸 대신 대파로 생존)'),
  ('fleet', 'newplayer_combat_grace_max_rank', '0',
     '이 rank_level 이하 유저는 combat grace 보호 (0=비활성, 기본). rank_level 기본=1이라 >0으로 두면 전 유저 보호되어 full-loss 무력화 — 주의'),
  ('fleet', 'newplayer_combat_grace_max_age_days', '3',
     '계정 생성 N일 이내 유저는 combat grace 보호 (0=비활성)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key IN (
--     'newplayer_combat_grace_enabled',
--     'newplayer_combat_grace_max_rank',
--     'newplayer_combat_grace_max_age_days'
--   );
-- ============================================================

INSERT INTO schema_migrations (filename) VALUES ('332_newplayer_combat_grace.sql') ON CONFLICT DO NOTHING;

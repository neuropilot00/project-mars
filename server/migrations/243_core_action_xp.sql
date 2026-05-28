-- Migration 243: 코어 행동 → XP (진행감을 핵심 활동과 연결) — 게임성 검수 반영
-- 전투 승/패, 함선 건조에 XP 부여(기존엔 채굴/클레임/일일미션/캠페인만 XP였음).
-- NPC/AI 전투는 battleRewards 의 _isAi 가드로 보상/XP 모두 제외(인플레 없음).

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'battle_win_xp',  '15', '함대전 승리 시 XP'),
  ('fleet', 'battle_loss_xp', '5',  '함대전 패배 시 XP(참여 보상)'),
  ('fleet', 'ship_build_xp',  '10', '함선 건조 착수 시 XP')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('243_core_action_xp.sql') ON CONFLICT DO NOTHING;

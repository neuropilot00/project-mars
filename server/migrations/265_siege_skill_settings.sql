-- 265_siege_skill_settings.sql
-- ════════════════════════════════════════════════════════════════
-- Phase 3 — 실시간 수동 스킬(beam/missile) 서버 권위 설정.
--   충전: 살아있는 ATK 함선 수 × per_ship/틱. 100% 에서 발동, 발동 후 0 리셋(쿨다운=재충전).
--   데미지: 발동 함대 ATK 합 × mult. (battleEngine.simulateBattleLive / _applySkill, 기본값 코드에 있음)
-- ════════════════════════════════════════════════════════════════

INSERT INTO settings (category, key, value, description) VALUES
  ('siege', 'siege_beam_dmg_mult', '8', 'beam(주포) 데미지 = 발동 함대 ATK 합 × 이 값 (단일 우선 표적)'),
  ('siege', 'siege_missile_dmg_mult', '4', 'missile(미사일) 데미지 = ATK 합 × 이 값 (최대 6척 분산)'),
  ('siege', 'siege_beam_charge_per_ship', '0.4', 'beam 충전/틱 = 살아있는 ATK 함선 수 × 이 값'),
  ('siege', 'siege_missile_charge_per_ship', '0.6', 'missile 충전/틱 = 살아있는 ATK 함선 수 × 이 값')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename)
VALUES ('265_siege_skill_settings.sql')
ON CONFLICT DO NOTHING;

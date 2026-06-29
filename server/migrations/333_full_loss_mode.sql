-- 333_full_loss_mode.sql
-- full-loss(격침 함선 영구소멸)의 정책을 단일 마스터 설정으로 통제 — 전부 admin 에서 되돌림 가능.
--   기존 hijack_ship_loss_enabled / siege_full_loss_enabled / 일반전 무조건 영구파괴 위에 마스터 게이트를 얹는다.
--
--   full_loss_mode:
--     "always"   = 현행(기본). 기존 플래그/일반전 영구파괴 그대로.
--     "off"      = 어디서도 영구파괴 없음. 격침함은 비파괴(15% HP 보존 → 조선소 수리 연계).
--     "seasonal" = full_loss_season_active=true 인 동안만 영구파괴(전쟁 시즌). 비활성이면 off 와 동일.
--     "optin"    = 실유저 양측이 모두 full_loss_optin=true 인 PvP 에서만 영구파괴. AI/판별불가는 비파괴.
--
--   적용: server/services/battleEngine.js#applyBattleResults 에서 permanentLossActive 로 모든 분기 게이트.
--   기본값 always 라 이 마이그레이션만으로는 동작 변화 없음(EVE 정체성 보존). 시즌제/옵트인 전환은 admin 설정으로.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_loss_optin BOOLEAN NOT NULL DEFAULT false;

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'full_loss_mode', '"always"',
     '함선 영구손실 마스터 모드: always(현행) | off(영구파괴 없음) | seasonal(시즌 토글) | optin(양측 동의 PvP만)'),
  ('fleet', 'full_loss_season_active', 'false',
     'full_loss_mode=seasonal 일 때 현재 전쟁 시즌이 활성인지(true=영구파괴 ON). admin/시즌 스케줄러가 토글')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ROLLBACK SQL:
--   DELETE FROM settings WHERE key IN ('full_loss_mode','full_loss_season_active');
--   ALTER TABLE users DROP COLUMN IF EXISTS full_loss_optin;
-- ============================================================

INSERT INTO schema_migrations (filename) VALUES ('333_full_loss_mode.sql') ON CONFLICT DO NOTHING;

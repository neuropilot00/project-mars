-- Migration 244: 첫 입금 보너스 (첫 결제 후크) — 상용화 게임성 검수 반영
-- 첫 USDT 입금 시 추가 PP 보너스(기존 deposit_pp_bonus 위에). PP만 추가(담보 불변식 무관).
-- 기본 20% — 운영자가 admin 에서 조정. (USDT 입금은 컨트랙트 배포 후 개시되므로 현재 효과 0, 런칭 대비)

INSERT INTO settings (category, key, value, description) VALUES
  ('economy', 'first_deposit_bonus_pct', '20', '첫 입금 시 추가 PP 보너스(%) — 첫 결제 후크. 0=off')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('244_first_deposit_bonus.sql') ON CONFLICT DO NOTHING;

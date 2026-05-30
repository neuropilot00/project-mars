-- 281_assembly_overdrive.sql
-- P3 합체 필살기(overdrive) 밸런스 settings. 서버 권위 충전/데미지.
INSERT INTO settings (category, key, value, description) VALUES
  ('assembly', 'assembly_overdrive_dmg_mult', '5', '합체 필살기 데미지 배율 (발동 함대 살아있는 ATK 합 × 배율)'),
  ('assembly', 'assembly_overdrive_charge_per_ship', '0.5', '합체체 보유 시 ATK함선당 틱 충전량')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('281_assembly_overdrive.sql') ON CONFLICT DO NOTHING;

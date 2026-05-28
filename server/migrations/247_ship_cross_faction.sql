-- 247_ship_cross_faction.sql
-- 가챠가 다른 진영 함선도 줄 수 있게 한다. 사용은 못해도 마켓에 팔 수 있어 cross-faction 거래 시장이 자연 생성됨.
-- · ships.fleet_id 를 NULL 허용으로 변경 → 다른 진영 함선은 "창고(fleet_id NULL)"에 두어 함대/전투에 자동 미포함.
-- · 마켓 등록은 owner_wallet 기준이라 fleet_id 무관, 자유 거래 가능.

ALTER TABLE ships ALTER COLUMN fleet_id DROP NOT NULL;

-- 가챠 다른 진영 함선 확률(%) — 0=비활성, 100=항상 cross. admin 조정 가능.
INSERT INTO settings (category, key, value, description) VALUES
  ('shop', 'crate_cross_faction_pct', '18', '가챠에서 다른 진영 함선이 나올 확률(%). 사용 불가, 마켓 거래만 가능 — cross-faction 시장 유동성 생성.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('247_ship_cross_faction.sql') ON CONFLICT DO NOTHING;

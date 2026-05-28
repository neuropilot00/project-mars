-- 251_ships_quality_column.sql
-- 가챠로 받은 함선의 각인 품질(common~legendary)을 ships 행 자체에 저장.
-- 기존엔 ship_crate_pulls 로그에만 있어서 보유 함선 목록 UI 에서 quality 배지 표시가 불가했음.
-- 빌드된 함선이나 캠페인 보상은 NULL (none). gacha pull 만 채워짐.

ALTER TABLE ships ADD COLUMN IF NOT EXISTS quality TEXT;

-- 기존 가챠 풀 이력에서 매칭되는 함선에 quality 백필(있는 한도에서).
UPDATE ships s
   SET quality = p.quality
  FROM ship_crate_pulls p
 WHERE p.ship_type_code = s.ship_type_code
   AND LOWER(p.wallet) = LOWER(s.owner_wallet)
   AND p.quality IS NOT NULL
   AND s.quality IS NULL
   AND s.built_at <= p.created_at + INTERVAL '3 minutes'
   AND s.built_at >= p.created_at - INTERVAL '3 minutes';

INSERT INTO schema_migrations (filename) VALUES ('251_ships_quality_column.sql') ON CONFLICT DO NOTHING;

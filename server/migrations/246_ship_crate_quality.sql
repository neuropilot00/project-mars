-- 246_ship_crate_quality.sql
-- 가챠 개봉 시 함선이 랜덤 "각인 품질(quality)"을 받아 보너스 스탯(bonus_atk/def/hp/speed)이 굴려진다.
-- → 같은 함급이라도 강화된 개체가 나올 수 있어 결제 동기 부여. 품질 등급을 풀 로그에 기록.
ALTER TABLE ship_crate_pulls ADD COLUMN IF NOT EXISTS quality TEXT;

INSERT INTO schema_migrations (filename) VALUES ('246_ship_crate_quality.sql') ON CONFLICT DO NOTHING;

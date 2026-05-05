-- Migration 215: 전투 결과 리포트 통계 컬럼
-- fleet_battles에 상세 통계 추가, CPI 컬럼 추가

ALTER TABLE fleet_battles
  ADD COLUMN IF NOT EXISTS atk_damage_dealt BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS def_damage_dealt BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atk_flagship_survived BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS def_flagship_survived BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_ticks INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS performance_rating_atk VARCHAR(2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS performance_rating_def VARCHAR(2) DEFAULT NULL;

-- fleets 테이블에 CPI (Combat Power Index) 컬럼 추가
ALTER TABLE fleets
  ADD COLUMN IF NOT EXISTS cpi NUMERIC(12,2) DEFAULT 0;

-- ships 테이블에 kills 카운터 추가 (전투별 기여 추적용)
ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS total_kills INT DEFAULT 0;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_fleet_battles_ended_at ON fleet_battles(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_battles_atk_wallet ON fleet_battle_participants(wallet_address, side);

INSERT INTO schema_migrations (filename) VALUES ('215_battle_report_stats.sql') ON CONFLICT DO NOTHING;

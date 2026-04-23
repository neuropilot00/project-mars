-- ═══════════════════════════════════════════════════════════════
-- Migration 095: Fleet Combat - Performance & Activation
-- ═══════════════════════════════════════════════════════════════
-- 대규모 전투 대비 성능 인덱스 + 최종 활성화
-- 이 마이그레이션이 실행되면 함대전 시스템이 "준비 완료" 상태
--   (실제 활성화는 settings.fleet_combat_enabled='true'로 수동 전환)
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. 대용량 쿼리 최적화 인덱스 ──────────────────────────────

-- 함대 내 생존 함선 조회 (전투 중 가장 빈번)
CREATE INDEX IF NOT EXISTS idx_ships_alive_by_type 
  ON ships(fleet_id, ship_type_code) 
  WHERE is_alive = true;

-- 유저별 함선 집계 (프로필 화면)
CREATE INDEX IF NOT EXISTS idx_ships_owner_type_alive
  ON ships(owner_wallet, ship_type_code)
  WHERE is_alive = true;

-- 전투 참여 활성 함대
CREATE INDEX IF NOT EXISTS idx_fleet_battle_participants_active
  ON fleet_battle_participants(battle_id, side, ships_alive)
  WHERE ships_alive > 0;

-- 진행 중 전투 스캔 (tick loop)
CREATE INDEX IF NOT EXISTS idx_fleet_battles_active
  ON fleet_battles(battle_started_at)
  WHERE status = 'active';


-- ── 2. 전투 이벤트 파티션 준비 (로그 폭증 대비) ──────────────

-- 일단 일반 인덱스만. 나중에 로그가 많아지면 PARTITION BY RANGE 전환
CREATE INDEX IF NOT EXISTS idx_battle_events_wallet
  ON fleet_battle_events(actor_wallet, created_at DESC)
  WHERE actor_wallet IS NOT NULL;


-- ── 3. 자주 쓰는 뷰 ───────────────────────────────────────────

-- 유저별 함대 요약
CREATE OR REPLACE VIEW v_player_fleet_summary AS
SELECT 
  f.owner_wallet,
  COUNT(DISTINCT f.id)                                         AS fleet_count,
  COUNT(s.id) FILTER (WHERE s.is_alive)                        AS ships_alive,
  COUNT(s.id) FILTER (WHERE NOT s.is_alive)                    AS ships_lost_total,
  COUNT(s.id) FILTER (WHERE s.is_flagship AND s.is_alive)      AS flagships,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.is_capital)      AS capital_ships,
  COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive), 0)     AS total_hp,
  COALESCE(SUM(s.damage_dealt), 0)                             AS total_damage_dealt,
  COALESCE(SUM(s.kills_dealt), 0)                              AS total_kills
FROM fleets f
LEFT JOIN ships s ON s.fleet_id = f.id
LEFT JOIN ship_types st ON st.code = s.ship_type_code
GROUP BY f.owner_wallet;

-- 함대별 구성 요약
CREATE OR REPLACE VIEW v_fleet_composition AS
SELECT 
  f.id                                                          AS fleet_id,
  f.name                                                        AS fleet_name,
  f.owner_wallet,
  f.formation,
  f.movement,
  f.is_in_battle,
  COUNT(s.id) FILTER (WHERE s.is_alive)                         AS ships_alive,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='frigate')    AS frigate_count,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='destroyer')  AS destroyer_count,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='cruiser')    AS cruiser_count,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='battleship') AS battleship_count,
  COUNT(s.id) FILTER (WHERE s.is_alive AND st.size_class='titan')      AS titan_count,
  COALESCE(SUM(s.current_hp) FILTER (WHERE s.is_alive), 0)      AS total_hp,
  COALESCE(SUM(s.max_hp)     FILTER (WHERE s.is_alive), 0)      AS total_max_hp
FROM fleets f
LEFT JOIN ships s ON s.fleet_id = f.id
LEFT JOIN ship_types st ON st.code = s.ship_type_code
GROUP BY f.id, f.name, f.owner_wallet, f.formation, f.movement, f.is_in_battle;

-- Titan 서버 현황 (UI에 "Titan 2/3" 표시용)
CREATE OR REPLACE VIEW v_titan_status AS
SELECT 
  st.code                  AS ship_type_code,
  st.faction_code,
  st.name_ko,
  st.max_per_server,
  COUNT(s.id) FILTER (WHERE s.is_alive) AS current_count,
  st.max_per_server - COUNT(s.id) FILTER (WHERE s.is_alive) AS slots_remaining
FROM ship_types st
LEFT JOIN ships s ON s.ship_type_code = st.code
WHERE st.size_class = 'titan'
GROUP BY st.code, st.faction_code, st.name_ko, st.max_per_server
ORDER BY st.sort_order;


-- ── 4. 함대전 시스템 활성화 플래그 (수동) ────────────────────

-- ⚠️ 함대전 시스템은 기본적으로 비활성화 상태
-- 관리자가 준비 완료 시 UPDATE settings SET value='true' WHERE ... 실행

UPDATE settings SET value = 'false'
WHERE category='fleet' AND key='fleet_combat_enabled';


-- ── 5. 최종 확인용 메타 레코드 ────────────────────────────────

INSERT INTO settings (category, key, value, description) VALUES
  ('fleet', 'system_version',     '"1.0.0"',                    'Fleet combat system version'),
  ('fleet', 'migrations_applied', '"089,090,091,092,093,094,095"', 'Applied fleet combat migrations'),
  ('fleet', 'ready_for_testing',  'true',                     'System ready for internal testing')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 전체 시스템 검증
-- ═══════════════════════════════════════════════════════════════
-- 
-- -- 1. 파벌 3개 존재
-- SELECT code, name_ko FROM factions ORDER BY sort_order;
-- 
-- -- 2. 함선 22종 존재
-- SELECT faction_code, COUNT(*) FROM ship_types GROUP BY faction_code;
-- 
-- -- 3. 광물 13종 (9 + 4 신규)
-- SELECT tier, COUNT(*) FROM resources WHERE tier IS NOT NULL GROUP BY tier ORDER BY tier;
-- 
-- -- 4. 함대전 테이블 존재
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('fleets','ships','fleet_battles','fleet_battle_participants',
--                      'fleet_battle_events','hijack_battles','ship_build_jobs',
--                      'hijack_stats','fleet_gp_activity')
-- ORDER BY table_name;
-- 
-- -- 5. 트리거 작동
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE trigger_schema='public' AND trigger_name LIKE 'trg_ships%';
-- 
-- -- 6. 뷰 작동
-- SELECT * FROM v_titan_status;
-- 
-- -- 7. 함대전 설정
-- SELECT key, value FROM settings WHERE category='fleet' ORDER BY key;

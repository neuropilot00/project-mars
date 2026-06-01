-- ============================================================
-- Migration 295: 건조 완성 실패 시 전액 환불 상태('refunded') 지원
--
-- 배경: 경제 재시뮬(ECONOMY_RESIM_FLEET_2026-05-31) 중 잠복 버그 발견.
--   completeBuildJob()은 startBuild 시점에 이미 GP/광물을 차감한 큐 작업을
--   완성시킨다. 함선 INSERT가 영구 조건(Titan 서버 한도 / 유저 함선 한도
--   트리거)으로 throw 하면 트랜잭션이 ROLLBACK 되어 작업이 'building' 으로
--   되돌아가고, 스케줄러(processCompletedJobs)가 매 틱 같은 작업을 재시도하며
--   좀비화한다. 이때 차감된 GP는 영구 잠긴다(환불 경로 없음).
--
-- 조치: 완성 실패를 '시스템 장애 → 전액 환불'로 처리한다. 작업을 'refunded'
--   상태로 닫아 재시도를 멈추고, GP/광물을 ship_build_fail_refund_pct(기본
--   100%)만큼 환불한다. 이를 위해 status CHECK 제약에 'refunded'를 추가한다.
--
-- 주의: settings.key 에는 단독 UNIQUE 제약이 없어 일부 키에 중복 행이 있다.
--   ON CONFLICT 대신 "없을 때만 INSERT" 패턴을 쓴다.
-- ============================================================

-- 1) status CHECK 제약에 'refunded' 추가
ALTER TABLE ship_build_jobs DROP CONSTRAINT IF EXISTS ship_build_jobs_status_check;
ALTER TABLE ship_build_jobs ADD CONSTRAINT ship_build_jobs_status_check
  CHECK (status::text = ANY (ARRAY['building','completed','cancelled','refunded']::text[]));

-- 2) 완성 실패 환불율 설정 (기본 100% — 시스템 장애 보상)
INSERT INTO settings (category, key, value, description)
  SELECT 'fleet', 'ship_build_fail_refund_pct', '100',
         '건조 완성 실패(시스템 장애) 시 GP/광물 환불율 %. 기본 100.'
  WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='ship_build_fail_refund_pct');

INSERT INTO schema_migrations (filename) VALUES ('295_ship_build_refunded_status.sql') ON CONFLICT DO NOTHING;

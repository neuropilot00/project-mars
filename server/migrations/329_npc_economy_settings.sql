-- 329_npc_economy_settings.sql
-- NPC 경제 운영자(콜드스타트 죽은 시장 방지) 설정 시드.
--   AI(is_ai)가 마켓에 자원을 주기적 등록 → 신규가 MARKET 열었을 때 "텅 빔" 대신 살아있는 거래.
--   carve-safe(팔리면 GP 구매자→NPC). 재미검증 아님 — 세계를 살아있게 보이게 하는 장치.
--   끄려면 admin Settings 에서 npc_economy_enabled=false.
--   서비스: server/services/npcEconomy.js, 스케줄러: server/index.js (10분, leader, 게이트=npc_economy_enabled).

INSERT INTO settings (category, key, value, description) VALUES
  ('npc', 'npc_economy_enabled', 'true', 'NPC 마켓 운영 ON/OFF (콜드스타트 시장 채우기)'),
  ('npc', 'npc_market_target_listings', '10', 'NPC 활성 마켓 리스팅 유지 목표 수'),
  ('npc', 'npc_market_per_tick', '4', '틱(10분)당 NPC 마켓 리스팅 최대 생성 수')
ON CONFLICT (key) DO NOTHING;

-- NPC↔NPC 전투(killboard/전투피드 채움)도 함께 ON. 기존 prod 값이 false 면 admin 에서 별도 flip 필요
-- (이 UPDATE 는 키가 이미 있을 때만 동작; 운영자가 원치 않으면 admin 에서 다시 false).
UPDATE settings SET value = 'true' WHERE key = 'npc_arena_enabled';

INSERT INTO schema_migrations (filename) VALUES ('329_npc_economy_settings.sql') ON CONFLICT DO NOTHING;

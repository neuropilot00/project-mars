-- Migration 190: AI 전략 활성화 토글 (services/aiStrategy.js)
-- v4.7 — Phase 4: hijack 외 battle (PvP/Siege/Event) 양쪽에 자동 진형/기동 명령 INSERT.
-- 파벌별 doctrine: MCC=screen+advance / FSP=sphere+rally / CV=wedge+flank.

INSERT INTO settings (category, key, value, description) VALUES
  ('battle', 'ai_strategy_enabled', 'true',
     'PvP/Siege battle 양쪽에 자동 AI 진형/기동 명령 INSERT (battleScheduler hook). hijack 은 사용자 manual.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('190_ai_strategy.sql') ON CONFLICT DO NOTHING;

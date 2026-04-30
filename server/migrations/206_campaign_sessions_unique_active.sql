-- ═══════════════════════════════════════════════════════════
-- 206: campaign_sessions 활성 세션 중복 차단
-- ═══════════════════════════════════════════════════════════
-- AUDIT M2: startChapter() 가 active 세션을 abandon 후 새로 만들지만, 동시 호출 시
-- (wallet, chapter_id, status='active') 가 중복 생성될 수 있다. 부분 UNIQUE 인덱스로 차단.
--
-- 기존 데이터 정리: 같은 (wallet, chapter_id) 에 active 가 2개 이상 있으면 가장 최신만 남기고
-- 나머지는 abandoned 로 표시한다.

UPDATE campaign_sessions cs
SET status = 'abandoned', updated_at = NOW()
WHERE cs.status = 'active'
  AND EXISTS (
    SELECT 1 FROM campaign_sessions cs2
    WHERE cs2.wallet = cs.wallet
      AND cs2.chapter_id = cs.chapter_id
      AND cs2.status = 'active'
      AND (cs2.created_at > cs.created_at
           OR (cs2.created_at = cs.created_at AND cs2.session_id > cs.session_id))
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaign_sessions_active
  ON campaign_sessions(wallet, chapter_id)
  WHERE status = 'active';

INSERT INTO schema_migrations (filename) VALUES ('206_campaign_sessions_unique_active.sql')
ON CONFLICT DO NOTHING;

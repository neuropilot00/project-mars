-- One persistent completion record per season, including seasons with no winners.
-- No historical rewards, balances, claims or amounts are modified.
-- The migration runner wraps this file in BEGIN/COMMIT. Lock in finalizer order.
LOCK TABLE seasons IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE season_rewards IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS season_reward_finalizations (
  season_id INTEGER PRIMARY KEY REFERENCES seasons(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('completed', 'legacy_rewards_present', 'legacy_closed')),
  reward_rows INTEGER NOT NULL CHECK (reward_rows >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actual existing rights are evidence, not permission to recreate them. Already
-- closed past seasons with no rights are conservatively recorded as legacy_closed;
-- this does not claim a historical payout occurred. Future queued seasons stay open.
INSERT INTO season_reward_finalizations (season_id, source, reward_rows)
SELECT s.id,
       CASE WHEN COUNT(r.id) > 0 THEN 'legacy_rewards_present' ELSE 'legacy_closed' END,
       COUNT(r.id)::integer
  FROM seasons s LEFT JOIN season_rewards r ON r.season_id = s.id
 GROUP BY s.id
HAVING COUNT(r.id) > 0 OR (s.active IS NOT TRUE AND s.ends_at <= NOW())
ON CONFLICT (season_id) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('359_season_reward_finalizations.sql') ON CONFLICT DO NOTHING;

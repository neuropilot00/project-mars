-- OCCUPY MARS — production KPI check for week-1 funnel / economy
-- Run:
--   psql "$DATABASE_URL" -f docs/ops/PROD_KPI_CHECK_WEEK1_FUNNEL.sql
-- Purpose:
--   Quick operator snapshot for acquisition, onboarding, first territory,
--   D1/D3/D7 retention, season pass premium conversion, and key economy sinks.

-- 1) Active season snapshot
WITH active_season AS (
  SELECT id, name, starts_at, ends_at
  FROM seasons
  WHERE active = true
  ORDER BY id DESC
  LIMIT 1
)
SELECT * FROM active_season;

-- 2) Core funnel headline — last 7d / 30d signups
WITH windows AS (
  SELECT 'last_7d'::text AS window_name, now() - interval '7 days' AS since
  UNION ALL
  SELECT 'last_30d', now() - interval '30 days'
),
base_users AS (
  SELECT
    w.window_name,
    u.wallet_address,
    u.created_at,
    u.last_login_at,
    o.completed AS onboarding_completed,
    o.reward_claimed,
    o.completed_at,
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.owner = u.wallet_address
        AND c.claimed_at >= u.created_at
        AND c.claimed_at <  u.created_at + interval '1 day'
    ) AS first_claim_1d,
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.owner = u.wallet_address
        AND c.claimed_at >= u.created_at
        AND c.claimed_at <  u.created_at + interval '7 day'
    ) AS first_claim_7d,
    EXISTS (
      SELECT 1
      FROM season_pass_progress spp
      JOIN seasons s ON s.id = spp.season_id
      WHERE spp.wallet = u.wallet_address
        AND spp.is_premium = true
        AND spp.purchased_at IS NOT NULL
        AND spp.purchased_at >= u.created_at
        AND spp.purchased_at <  u.created_at + interval '7 day'
        AND s.active = true
    ) AS season_pass_premium_7d,
    CASE
      WHEN u.created_at <= now() - interval '1 day'
      THEN (u.last_login_at IS NOT NULL AND u.last_login_at >= u.created_at + interval '1 day')
      ELSE NULL
    END AS retained_d1,
    CASE
      WHEN u.created_at <= now() - interval '3 day'
      THEN (u.last_login_at IS NOT NULL AND u.last_login_at >= u.created_at + interval '3 day')
      ELSE NULL
    END AS retained_d3,
    CASE
      WHEN u.created_at <= now() - interval '7 day'
      THEN (u.last_login_at IS NOT NULL AND u.last_login_at >= u.created_at + interval '7 day')
      ELSE NULL
    END AS retained_d7
  FROM windows w
  LEFT JOIN users u
    ON u.created_at >= w.since
  LEFT JOIN user_onboarding o
    ON o.wallet_address = u.wallet_address
)
SELECT
  window_name,
  COUNT(wallet_address) AS signups,
  COUNT(wallet_address) FILTER (WHERE onboarding_completed IS TRUE) AS onboarding_completed_users,
  ROUND(100.0 * COUNT(wallet_address) FILTER (WHERE onboarding_completed IS TRUE) / NULLIF(COUNT(wallet_address), 0), 1) AS onboarding_completed_rate_pct,
  COUNT(wallet_address) FILTER (WHERE reward_claimed IS TRUE) AS onboarding_reward_claimed_users,
  COUNT(wallet_address) FILTER (WHERE first_claim_1d) AS first_claim_1d_users,
  ROUND(100.0 * COUNT(wallet_address) FILTER (WHERE first_claim_1d) / NULLIF(COUNT(wallet_address), 0), 1) AS first_claim_1d_rate_pct,
  COUNT(wallet_address) FILTER (WHERE first_claim_7d) AS first_claim_7d_users,
  ROUND(100.0 * COUNT(wallet_address) FILTER (WHERE first_claim_7d) / NULLIF(COUNT(wallet_address), 0), 1) AS first_claim_7d_rate_pct,
  COUNT(wallet_address) FILTER (WHERE season_pass_premium_7d) AS season_pass_premium_7d_users,
  ROUND(100.0 * COUNT(wallet_address) FILTER (WHERE season_pass_premium_7d) / NULLIF(COUNT(wallet_address), 0), 1) AS season_pass_premium_7d_rate_pct,
  COUNT(retained_d1) FILTER (WHERE retained_d1 IS NOT NULL) AS matured_d1_users,
  COUNT(*) FILTER (WHERE retained_d1 IS TRUE) AS retained_d1_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retained_d1 IS TRUE) / NULLIF(COUNT(retained_d1) FILTER (WHERE retained_d1 IS NOT NULL), 0), 1) AS retained_d1_rate_pct,
  COUNT(retained_d3) FILTER (WHERE retained_d3 IS NOT NULL) AS matured_d3_users,
  COUNT(*) FILTER (WHERE retained_d3 IS TRUE) AS retained_d3_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retained_d3 IS TRUE) / NULLIF(COUNT(retained_d3) FILTER (WHERE retained_d3 IS NOT NULL), 0), 1) AS retained_d3_rate_pct,
  COUNT(retained_d7) FILTER (WHERE retained_d7 IS NOT NULL) AS matured_d7_users,
  COUNT(*) FILTER (WHERE retained_d7 IS TRUE) AS retained_d7_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE retained_d7 IS TRUE) / NULLIF(COUNT(retained_d7) FILTER (WHERE retained_d7 IS NOT NULL), 0), 1) AS retained_d7_rate_pct
FROM base_users
GROUP BY window_name
ORDER BY CASE window_name WHEN 'last_7d' THEN 1 ELSE 2 END;

-- 3) PP -> GP exchange usage snapshot
WITH windows AS (
  SELECT 'last_7d'::text AS window_name, now() - interval '7 days' AS since
  UNION ALL
  SELECT 'last_30d', now() - interval '30 days'
)
SELECT
  w.window_name,
  COUNT(t.id) AS exchange_txs,
  COUNT(DISTINCT COALESCE(t.from_wallet, t.to_wallet)) AS exchange_users,
  COALESCE(SUM(t.pp_amount), 0) AS total_pp_spent,
  COALESCE(SUM((t.meta->>'gp_received')::numeric), 0) AS total_gp_received,
  ROUND(COALESCE(AVG(t.pp_amount), 0), 3) AS avg_pp_per_tx
FROM windows w
LEFT JOIN transactions t
  ON t.type = 'pp_to_gp_exchange'
 AND t.created_at >= w.since
GROUP BY w.window_name
ORDER BY CASE w.window_name WHEN 'last_7d' THEN 1 ELSE 2 END;

-- 4) Current active season engagement snapshot
WITH active_season AS (
  SELECT id, name
  FROM seasons
  WHERE active = true
  ORDER BY id DESC
  LIMIT 1
)
SELECT
  s.id AS season_id,
  s.name AS season_name,
  COUNT(*) AS progress_rows,
  COUNT(DISTINCT spp.wallet) AS engaged_wallets,
  COUNT(DISTINCT spp.wallet) FILTER (WHERE spp.is_premium) AS premium_wallets,
  ROUND(100.0 * COUNT(DISTINCT spp.wallet) FILTER (WHERE spp.is_premium) / NULLIF(COUNT(DISTINCT spp.wallet), 0), 1) AS premium_share_pct,
  ROUND(AVG(spp.pass_xp), 1) AS avg_pass_xp,
  ROUND(AVG(spp.current_tier), 1) AS avg_current_tier,
  MAX(spp.current_tier) AS max_current_tier
FROM active_season s
LEFT JOIN season_pass_progress spp
  ON spp.season_id = s.id
GROUP BY s.id, s.name;

-- 5) Economy sinks / feature usage checkpoint — last 30d
WITH since AS (
  SELECT now() - interval '30 days' AS ts
)
SELECT
  'ship_build_jobs' AS metric,
  COUNT(*)::numeric AS events,
  COUNT(DISTINCT wallet_address)::numeric AS unique_users,
  COALESCE(SUM(gp_cost), 0)::numeric AS total_gp_sink
FROM ship_build_jobs, since
WHERE started_at >= since.ts
UNION ALL
SELECT
  'expeditions' AS metric,
  COUNT(*)::numeric AS events,
  COUNT(DISTINCT wallet)::numeric AS unique_users,
  COALESCE(SUM(gp_spent), 0)::numeric AS total_gp_sink
FROM expeditions, since
WHERE created_at >= since.ts
UNION ALL
SELECT
  'territory_monuments' AS metric,
  COUNT(*)::numeric AS events,
  COUNT(DISTINCT owner)::numeric AS unique_users,
  COALESCE(SUM(gp_spent), 0)::numeric AS total_gp_sink
FROM territory_monuments, since
WHERE created_at >= since.ts
UNION ALL
SELECT
  'season_pass_premium' AS metric,
  COUNT(*)::numeric AS events,
  COUNT(DISTINCT wallet)::numeric AS unique_users,
  COALESCE(SUM(150), 0)::numeric AS total_gp_sink
FROM season_pass_progress, since
WHERE is_premium = true
  AND purchased_at IS NOT NULL
  AND purchased_at >= since.ts
ORDER BY metric;

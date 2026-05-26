-- OCCUPY MARS — dashboard cohort queries
-- Run:
--   psql "$DATABASE_URL" -f docs/ops/DASHBOARD_COHORTS_RETENTION_AND_CONVERSION.sql
-- Purpose:
--   Daily cohort dashboard for D1/D3/D7 retention, onboarding completion,
--   first territory conversion, and season pass premium conversion.

-- 1) Daily signup cohort dashboard (last 30 signup days)
WITH signup_cohorts AS (
  SELECT
    u.wallet_address,
    u.created_at,
    (u.created_at AT TIME ZONE 'UTC')::date AS signup_date,
    u.last_login_at,
    o.completed AS onboarding_completed,
    o.reward_claimed,
    first_claim.first_claim_at,
    premium.first_premium_at
  FROM users u
  LEFT JOIN user_onboarding o
    ON o.wallet_address = u.wallet_address
  LEFT JOIN LATERAL (
    SELECT MIN(c.claimed_at) AS first_claim_at
    FROM claims c
    WHERE c.owner = u.wallet_address
  ) first_claim ON true
  LEFT JOIN LATERAL (
    SELECT MIN(spp.purchased_at) AS first_premium_at
    FROM season_pass_progress spp
    WHERE spp.wallet = u.wallet_address
      AND spp.is_premium = true
      AND spp.purchased_at IS NOT NULL
  ) premium ON true
  WHERE u.created_at >= date_trunc('day', now()) - interval '30 day'
)
SELECT
  signup_date,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE onboarding_completed IS TRUE) AS onboarding_completed_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE onboarding_completed IS TRUE) / NULLIF(COUNT(*), 0), 1) AS onboarding_completed_rate_pct,
  COUNT(*) FILTER (WHERE reward_claimed IS TRUE) AS onboarding_reward_claimed_users,
  COUNT(*) FILTER (
    WHERE first_claim_at IS NOT NULL
      AND first_claim_at < created_at + interval '1 day'
  ) AS first_claim_1d_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE first_claim_at IS NOT NULL
      AND first_claim_at < created_at + interval '1 day'
  ) / NULLIF(COUNT(*), 0), 1) AS first_claim_1d_rate_pct,
  COUNT(*) FILTER (
    WHERE first_claim_at IS NOT NULL
      AND first_claim_at < created_at + interval '7 day'
  ) AS first_claim_7d_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE first_claim_at IS NOT NULL
      AND first_claim_at < created_at + interval '7 day'
  ) / NULLIF(COUNT(*), 0), 1) AS first_claim_7d_rate_pct,
  COUNT(*) FILTER (
    WHERE first_premium_at IS NOT NULL
      AND first_premium_at < created_at + interval '7 day'
  ) AS season_pass_premium_7d_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE first_premium_at IS NOT NULL
      AND first_premium_at < created_at + interval '7 day'
  ) / NULLIF(COUNT(*), 0), 1) AS season_pass_premium_7d_rate_pct,
  COUNT(*) FILTER (WHERE created_at <= now() - interval '1 day') AS matured_d1_users,
  COUNT(*) FILTER (
    WHERE created_at <= now() - interval '1 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '1 day'
  ) AS retained_d1_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE created_at <= now() - interval '1 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '1 day'
  ) / NULLIF(COUNT(*) FILTER (WHERE created_at <= now() - interval '1 day'), 0), 1) AS retained_d1_rate_pct,
  COUNT(*) FILTER (WHERE created_at <= now() - interval '3 day') AS matured_d3_users,
  COUNT(*) FILTER (
    WHERE created_at <= now() - interval '3 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '3 day'
  ) AS retained_d3_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE created_at <= now() - interval '3 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '3 day'
  ) / NULLIF(COUNT(*) FILTER (WHERE created_at <= now() - interval '3 day'), 0), 1) AS retained_d3_rate_pct,
  COUNT(*) FILTER (WHERE created_at <= now() - interval '7 day') AS matured_d7_users,
  COUNT(*) FILTER (
    WHERE created_at <= now() - interval '7 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '7 day'
  ) AS retained_d7_users,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE created_at <= now() - interval '7 day'
      AND last_login_at IS NOT NULL
      AND last_login_at >= created_at + interval '7 day'
  ) / NULLIF(COUNT(*) FILTER (WHERE created_at <= now() - interval '7 day'), 0), 1) AS retained_d7_rate_pct
FROM signup_cohorts
GROUP BY signup_date
ORDER BY signup_date DESC;

-- 2) Lag bucket dashboard — first territory conversion speed
WITH first_claims AS (
  SELECT
    u.wallet_address,
    (u.created_at AT TIME ZONE 'UTC')::date AS signup_date,
    u.created_at,
    MIN(c.claimed_at) AS first_claim_at
  FROM users u
  LEFT JOIN claims c
    ON c.owner = u.wallet_address
  WHERE u.created_at >= date_trunc('day', now()) - interval '30 day'
  GROUP BY u.wallet_address, signup_date, u.created_at
)
SELECT
  signup_date,
  COUNT(*) AS signups,
  COUNT(*) FILTER (WHERE first_claim_at IS NULL) AS never_claimed,
  COUNT(*) FILTER (WHERE first_claim_at < created_at + interval '1 day') AS claim_lt_1d,
  COUNT(*) FILTER (WHERE first_claim_at >= created_at + interval '1 day' AND first_claim_at < created_at + interval '3 day') AS claim_1d_to_3d,
  COUNT(*) FILTER (WHERE first_claim_at >= created_at + interval '3 day' AND first_claim_at < created_at + interval '7 day') AS claim_3d_to_7d,
  COUNT(*) FILTER (WHERE first_claim_at >= created_at + interval '7 day') AS claim_gt_7d
FROM first_claims
GROUP BY signup_date
ORDER BY signup_date DESC;

-- 3) Active season premium depth dashboard
WITH active_season AS (
  SELECT id, name
  FROM seasons
  WHERE active = true
  ORDER BY id DESC
  LIMIT 1
),
season_users AS (
  SELECT
    spp.wallet,
    spp.pass_xp,
    spp.current_tier,
    spp.is_premium,
    spp.purchased_at
  FROM season_pass_progress spp
  JOIN active_season s
    ON s.id = spp.season_id
)
SELECT
  CASE
    WHEN current_tier = 0 THEN 'tier_0'
    WHEN current_tier BETWEEN 1 AND 4 THEN 'tier_1_4'
    WHEN current_tier BETWEEN 5 AND 9 THEN 'tier_5_9'
    WHEN current_tier BETWEEN 10 AND 19 THEN 'tier_10_19'
    ELSE 'tier_20_plus'
  END AS tier_bucket,
  COUNT(*) AS users,
  COUNT(*) FILTER (WHERE is_premium) AS premium_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_premium) / NULLIF(COUNT(*), 0), 1) AS premium_share_pct,
  ROUND(AVG(pass_xp), 1) AS avg_pass_xp
FROM season_users
GROUP BY 1
ORDER BY 1;

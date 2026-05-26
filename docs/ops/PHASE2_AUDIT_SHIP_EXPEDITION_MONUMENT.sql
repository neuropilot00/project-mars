-- OCCUPY MARS — economy phase 2 usage audit
-- Run:
--   psql "$DATABASE_URL" -f docs/ops/PHASE2_AUDIT_SHIP_EXPEDITION_MONUMENT.sql
-- Purpose:
--   Audit real usage and GP sink pressure for ships, expeditions, and monuments.

-- 1) Phase 2 adoption summary — last 7d / 30d / all_time
WITH windows AS (
  SELECT 'last_7d'::text AS window_name, now() - interval '7 days' AS since
  UNION ALL
  SELECT 'last_30d', now() - interval '30 days'
  UNION ALL
  SELECT 'all_time', timestamp '1970-01-01'
),
ship_rollup AS (
  SELECT
    w.window_name,
    COUNT(sbj.id) AS ship_build_events,
    COUNT(DISTINCT sbj.wallet_address) AS ship_build_users,
    COALESCE(SUM(sbj.gp_cost), 0) AS ship_gp_spent
  FROM windows w
  LEFT JOIN ship_build_jobs sbj
    ON sbj.started_at >= w.since
  GROUP BY w.window_name
),
expedition_rollup AS (
  SELECT
    w.window_name,
    COUNT(e.id) AS expedition_events,
    COUNT(DISTINCT e.wallet) AS expedition_users,
    COALESCE(SUM(e.gp_spent), 0) AS expedition_gp_spent
  FROM windows w
  LEFT JOIN expeditions e
    ON e.created_at >= w.since
  GROUP BY w.window_name
),
monument_rollup AS (
  SELECT
    w.window_name,
    COUNT(tm.id) AS monument_events,
    COUNT(DISTINCT tm.owner) AS monument_users,
    COALESCE(SUM(tm.gp_spent), 0) AS monument_gp_spent
  FROM windows w
  LEFT JOIN territory_monuments tm
    ON tm.created_at >= w.since
  GROUP BY w.window_name
)
SELECT
  s.window_name,
  s.ship_build_events,
  s.ship_build_users,
  s.ship_gp_spent,
  e.expedition_events,
  e.expedition_users,
  e.expedition_gp_spent,
  m.monument_events,
  m.monument_users,
  m.monument_gp_spent
FROM ship_rollup s
JOIN expedition_rollup e USING (window_name)
JOIN monument_rollup m USING (window_name)
ORDER BY CASE s.window_name WHEN 'last_7d' THEN 1 WHEN 'last_30d' THEN 2 ELSE 3 END;

-- 2) Ship build mix by type
SELECT
  sbj.ship_type_code,
  st.faction_code,
  st.role,
  st.tier,
  COUNT(*) AS builds,
  COUNT(DISTINCT sbj.wallet_address) AS unique_builders,
  COALESCE(SUM(sbj.gp_cost), 0) AS total_gp_spent,
  ROUND(AVG(sbj.gp_cost), 1) AS avg_gp_cost,
  MIN(sbj.started_at) AS first_seen_at,
  MAX(COALESCE(sbj.completed_at, sbj.completes_at, sbj.started_at)) AS last_seen_at
FROM ship_build_jobs sbj
LEFT JOIN ship_types st
  ON st.code = sbj.ship_type_code
GROUP BY sbj.ship_type_code, st.faction_code, st.role, st.tier
ORDER BY builds DESC, total_gp_spent DESC, sbj.ship_type_code;

-- 3) Ship build user concentration
SELECT
  sbj.wallet_address,
  COUNT(*) AS builds,
  COALESCE(SUM(sbj.gp_cost), 0) AS total_gp_spent,
  ROUND(AVG(sbj.gp_cost), 1) AS avg_gp_cost,
  MIN(sbj.started_at) AS first_build_at,
  MAX(COALESCE(sbj.completed_at, sbj.completes_at, sbj.started_at)) AS last_build_at
FROM ship_build_jobs sbj
GROUP BY sbj.wallet_address
ORDER BY total_gp_spent DESC, builds DESC, sbj.wallet_address
LIMIT 20;

-- 4) Ship build status / throughput
SELECT
  status,
  COUNT(*) AS jobs,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed_jobs,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, completes_at) - started_at)) / 3600.0), 2) AS avg_hours_to_finish,
  MIN(started_at) AS first_job_at,
  MAX(COALESCE(completed_at, completes_at, started_at)) AS last_job_at
FROM ship_build_jobs
GROUP BY status
ORDER BY jobs DESC, status;

-- 5) Expedition usage / reward profile
SELECT
  COALESCE(expedition_type, 'none') AS expedition_type,
  COALESCE(status, 'none') AS status,
  COALESCE(reward_type, 'none') AS reward_type,
  COUNT(*) AS runs,
  COUNT(DISTINCT wallet) AS unique_users,
  COALESCE(SUM(gp_spent), 0) AS total_gp_spent,
  COALESCE(SUM(reward_amount), 0) AS total_reward_amount,
  MIN(created_at) AS first_run_at,
  MAX(created_at) AS last_run_at
FROM expeditions
GROUP BY 1, 2, 3
ORDER BY runs DESC, expedition_type, status, reward_type;

-- 6) Monument usage profile
SELECT
  COALESCE(monument_type, 'none') AS monument_type,
  COUNT(*) AS monuments_built,
  COUNT(DISTINCT owner) AS unique_builders,
  COALESCE(SUM(gp_spent), 0) AS total_gp_spent,
  COUNT(*) FILTER (WHERE is_active) AS active_monuments,
  COUNT(*) FILTER (WHERE destroyed_at IS NOT NULL) AS destroyed_monuments,
  MIN(created_at) AS first_built_at,
  MAX(created_at) AS last_built_at
FROM territory_monuments
GROUP BY 1
ORDER BY monuments_built DESC, monument_type;

-- 7) Combined sink share across phase 2 systems
WITH ship_totals AS (
  SELECT COALESCE(SUM(gp_cost), 0)::numeric AS gp_spent FROM ship_build_jobs
),
expedition_totals AS (
  SELECT COALESCE(SUM(gp_spent), 0)::numeric AS gp_spent FROM expeditions
),
monument_totals AS (
  SELECT COALESCE(SUM(gp_spent), 0)::numeric AS gp_spent FROM territory_monuments
),
combined AS (
  SELECT 'ship_build'::text AS system, gp_spent FROM ship_totals
  UNION ALL
  SELECT 'expedition', gp_spent FROM expedition_totals
  UNION ALL
  SELECT 'monument', gp_spent FROM monument_totals
),
base AS (
  SELECT SUM(gp_spent) AS total_gp_spent FROM combined
)
SELECT
  c.system,
  c.gp_spent,
  ROUND(100.0 * c.gp_spent / NULLIF(b.total_gp_spent, 0), 1) AS sink_share_pct
FROM combined c
CROSS JOIN base b
ORDER BY c.gp_spent DESC, c.system;

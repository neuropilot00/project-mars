-- ═══════════════════════════════════════════════════════════════
-- Migration 106: Admin Economy 모니터링
-- 바이블 COMPLETE_BIBLE PART 5 § 9 기준
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. 경제 건전성 뷰 ───
-- transactions 테이블 없으면 users 잔액 기반으로 fallback

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    -- transactions 테이블 있으면 일별 집계 뷰
    EXECUTE $SQL$
      CREATE OR REPLACE VIEW economy_health AS
      SELECT
        DATE(created_at) AS date,
        SUM(CASE WHEN amount > 0 AND currency = 'PP' THEN amount ELSE 0 END)        AS pp_issued,
        SUM(CASE WHEN amount < 0 AND currency = 'PP' THEN ABS(amount) ELSE 0 END)   AS pp_burned,
        ROUND(
          SUM(CASE WHEN amount < 0 AND currency='PP' THEN ABS(amount) ELSE 0 END) /
          NULLIF(SUM(CASE WHEN amount > 0 AND currency='PP' THEN amount ELSE 0 END), 0),
          4
        ) AS pp_sink_ratio,
        SUM(CASE WHEN amount > 0 AND currency = 'GP' THEN amount ELSE 0 END)        AS gp_issued,
        SUM(CASE WHEN amount < 0 AND currency = 'GP' THEN ABS(amount) ELSE 0 END)   AS gp_burned,
        COUNT(DISTINCT user_id)                                                      AS active_users
      FROM transactions
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    $SQL$;
  ELSE
    -- fallback: users 잔액 스냅샷 기반 현황 뷰
    EXECUTE $SQL$
      CREATE OR REPLACE VIEW economy_health AS
      SELECT
        NOW()::DATE                             AS date,
        COALESCE(SUM(pp_balance), 0)::BIGINT    AS total_pp_in_circulation,
        COALESCE(SUM(gp_balance), 0)::BIGINT    AS total_gp_in_circulation,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours') AS active_users_24h,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')   AS active_users_7d,
        COUNT(*)                                                               AS total_users
      FROM users
    $SQL$;
  END IF;
END $$;

-- ─── 2. 직업 분포 뷰 ───

CREATE OR REPLACE VIEW admin_job_distribution AS
SELECT
  COALESCE(j.code, 'none') AS job_code,
  COALESCE(j.name_ko, '미선택') AS job_name_ko,
  j.icon_emoji,
  COUNT(u.wallet_address) AS user_count,
  ROUND(COUNT(u.wallet_address) * 100.0 / NULLIF(
    (SELECT COUNT(*) FROM users), 0
  ), 2) AS pct
FROM users u
LEFT JOIN jobs j ON j.id = u.current_job_id
GROUP BY j.code, j.name_ko, j.icon_emoji
ORDER BY user_count DESC;

-- ─── 3. 온보딩 퍼널 뷰 ───

CREATE OR REPLACE VIEW admin_onboarding_funnel AS
SELECT
  step_name,
  total,
  ROUND(total * 100.0 / NULLIF(total_started, 0), 1) AS completion_rate_pct
FROM (
  SELECT
    'started'   AS step_name, COUNT(*) AS total,
    (SELECT COUNT(*) FROM user_onboarding) AS total_started
  FROM user_onboarding
  UNION ALL
  SELECT 'step_1_done', COUNT(*), (SELECT COUNT(*) FROM user_onboarding)
  FROM user_onboarding WHERE current_step >= 2
  UNION ALL
  SELECT 'step_2_done', COUNT(*), (SELECT COUNT(*) FROM user_onboarding)
  FROM user_onboarding WHERE current_step >= 3
  UNION ALL
  SELECT 'step_3_done', COUNT(*), (SELECT COUNT(*) FROM user_onboarding)
  FROM user_onboarding WHERE current_step >= 4
  UNION ALL
  SELECT 'completed', COUNT(*), (SELECT COUNT(*) FROM user_onboarding)
  FROM user_onboarding WHERE completed = true
  UNION ALL
  SELECT 'skipped', COUNT(*), (SELECT COUNT(*) FROM user_onboarding)
  FROM user_onboarding WHERE skipped = true
) t
ORDER BY
  CASE step_name
    WHEN 'started' THEN 1 WHEN 'step_1_done' THEN 2 WHEN 'step_2_done' THEN 3
    WHEN 'step_3_done' THEN 4 WHEN 'completed' THEN 5 WHEN 'skipped' THEN 6
  END;

-- ─── 4. 자원 유통량 뷰 ───

CREATE OR REPLACE VIEW admin_resource_circulation AS
SELECT
  r.code, r.name_ko, r.icon_emoji, r.rarity,
  COALESCE(SUM(i.quantity), 0) AS total_in_inventory,
  COUNT(DISTINCT i.wallet_address) AS holders
FROM resources r
LEFT JOIN user_resource_inventory i ON i.resource_id = r.id
WHERE r.is_active = true
GROUP BY r.code, r.name_ko, r.icon_emoji, r.rarity
ORDER BY total_in_inventory DESC;

-- user_resource_inventory 없으면 user_items로 fallback
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_resource_inventory') THEN
    CREATE OR REPLACE VIEW admin_resource_circulation AS
    SELECT
      r.code, r.name_ko, r.icon_emoji, r.rarity,
      COALESCE(SUM(ui.quantity), 0) AS total_in_inventory,
      COUNT(DISTINCT ui.wallet_address) AS holders
    FROM resources r
    LEFT JOIN user_items ui ON ui.item_code = r.code
    WHERE r.is_active = true
    GROUP BY r.code, r.name_ko, r.icon_emoji, r.rarity
    ORDER BY total_in_inventory DESC;
  END IF;
END $$;

-- ─── 5. 완료 알림 ───

DO $$
BEGIN
  RAISE NOTICE '[migration 106] economy_health, admin_job_distribution, admin_onboarding_funnel views created';
END $$;

COMMIT;

-- 검증:
-- SELECT * FROM economy_health LIMIT 7;
-- SELECT * FROM admin_job_distribution;
-- SELECT * FROM admin_onboarding_funnel;

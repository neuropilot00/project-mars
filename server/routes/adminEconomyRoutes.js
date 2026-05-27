// server/routes/adminEconomyRoutes.js
// ═══════════════════════════════════════════════════════════════
// Admin Economy & 신규 탭 API
// 바이블 COMPLETE_BIBLE PART 5 § 9 기준
//
// 신규 7개 탭:
//   GET /api/admin/economy/overview    — ECONOMY 탭 (PP/GP 현황)
//   GET /api/admin/economy/history     — 일별 경제 추이
//   GET /api/admin/jobs                — JOBS 탭 (직업 분포 + 버프)
//   PUT /api/admin/jobs/:code/buff     — 직업 버프 수치 수정
//   GET /api/admin/resources           — RESOURCES 탭 (자원 유통)
//   GET /api/admin/siege               — SIEGE 탭 (진행 중 Siege)
//   GET /api/admin/chronicle           — CHRONICLE 탭 (목록 + 통계)
//   POST /api/admin/chronicle/test-webhook — Webhook 테스트
//   GET /api/admin/betting             — BETTING 탭 (이벤트 목록)
//   POST /api/admin/betting/:id/resolve — 베팅 결과 확정
//   GET /api/admin/onboarding          — ONBOARDING 탭 (퍼널)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ── Admin 인증 미들웨어 ──
const requireAdmin = (req, res, next) => {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

function handleErr(res, err, context) {
  console.error(`[adminEconomy] ${context}:`, err.message);
  res.status(500).json({ error: 'SERVER_ERROR', detail: err.message });
}

// ═══════════════════════════════════════════════════════════════
// ECONOMY 탭 (20번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/economy/overview
 * 경제 현황 요약 (실시간)
 */
router.get('/economy/overview', requireAdmin, async (req, res) => {
  try {
    const [userStats, jobStats, bettingStats, weatherStats] = await Promise.all([
      // 유저/잔액 현황
      pool.query(`
        SELECT
          COUNT(*) AS total_users,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours') AS dau,
          COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') AS wau,
          COALESCE(SUM(pp_balance), 0) AS total_pp,
          COALESCE(SUM(gp_balance), 0) AS total_gp,
          COALESCE(AVG(pp_balance) FILTER (WHERE pp_balance > 0), 0) AS avg_pp,
          COALESCE(AVG(gp_balance) FILTER (WHERE gp_balance > 0), 0) AS avg_gp
        FROM users
      `),
      // 직업 분포 요약
      pool.query(`SELECT * FROM admin_job_distribution`).catch(() => ({ rows: [] })),
      // 활성 베팅 이벤트
      pool.query(`
        SELECT COUNT(*) AS active_events,
               COALESCE(SUM(total_bet_a + total_bet_b + COALESCE(total_bet_c,0)),0) AS total_gp_in_bets
        FROM war_bet_events WHERE status = 'open'
      `).catch(() => ({ rows: [{ active_events: 0, total_gp_in_bets: 0 }] })),
      // 활성 날씨 이벤트
      pool.query(`
        SELECT COUNT(*) AS active_weather,
               COUNT(*) FILTER (WHERE status='forecast') AS upcoming_weather
        FROM mars_weather WHERE ends_at > NOW()
      `).catch(() => ({ rows: [{ active_weather: 0, upcoming_weather: 0 }] })),
    ]);

    res.json({
      users: userStats.rows[0],
      job_distribution: jobStats.rows,
      betting: bettingStats.rows[0],
      weather: weatherStats.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) { handleErr(res, err, 'economy/overview'); }
});

/**
 * GET /api/admin/economy/history?days=14
 * 일별 경제 추이
 */
router.get('/economy/history', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, parseInt(req.query.days) || 14);
    const { rows } = await pool.query(
      `SELECT * FROM economy_health LIMIT $1`, [days]
    ).catch(() => ({ rows: [] }));

    // economy_health 없으면 최근 가입 통계로 대체
    if (!rows.length) {
      const { rows: fallback } = await pool.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS new_users
        FROM users
        WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [days]);
      return res.json({ history: fallback, type: 'new_users_fallback' });
    }

    res.json({ history: rows, type: 'economy_health' });
  } catch (err) { handleErr(res, err, 'economy/history'); }
});

// ═══════════════════════════════════════════════════════════════
// JOBS 탭 (16번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/jobs
 * 직업 분포 + 버프 수치
 */
router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const [distribution, buffs] = await Promise.all([
      pool.query(`SELECT * FROM admin_job_distribution`).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT j.code, j.name_ko, j.icon_emoji,
               jb.buff_key, jb.buff_value, jb.description
        FROM jobs j
        JOIN job_buffs jb ON jb.job_id = j.id
        WHERE j.is_active = true
        ORDER BY j.sort_order, jb.buff_key
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({ distribution: distribution.rows, buffs: buffs.rows });
  } catch (err) { handleErr(res, err, 'jobs'); }
});

/**
 * PUT /api/admin/jobs/:code/buff
 * 직업 버프 수치 수정
 * Body: { buff_key, buff_value }
 */
router.put('/jobs/:code/buff', requireAdmin, async (req, res) => {
  try {
    const { code } = req.params;
    const { buff_key, buff_value } = req.body || {};
    if (!buff_key || buff_value === undefined) {
      return res.status(400).json({ error: 'BUFF_KEY_AND_VALUE_REQUIRED' });
    }

    const { rowCount } = await pool.query(`
      UPDATE job_buffs jb
      SET buff_value = $3, updated_at = NOW()
      FROM jobs j
      WHERE jb.job_id = j.id AND j.code = $1 AND jb.buff_key = $2
    `, [code, buff_key, buff_value]);

    if (!rowCount) return res.status(404).json({ error: 'BUFF_NOT_FOUND' });

    // 캐시 무효화 (jobBuffCache)
    try {
      const jobService = require('../services/job');
      // 전체 캐시 무효화는 지원하지 않으므로 서버 재시작 안내
    } catch { }

    res.json({ success: true, code, buff_key, buff_value });
  } catch (err) { handleErr(res, err, 'jobs/buff'); }
});

// ═══════════════════════════════════════════════════════════════
// RESOURCES 탭 (17번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/resources
 * 자원 유통량 현황
 */
router.get('/resources', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM admin_resource_circulation`
    ).catch(() => ({ rows: [] }));

    res.json({ resources: rows });
  } catch (err) { handleErr(res, err, 'resources'); }
});

// ═══════════════════════════════════════════════════════════════
// SIEGE 탭 (18번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/siege
 * 진행 중 Siege 현황
 */
router.get('/siege', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT gs.*,
             s.name_ko AS sector_name,
             a.nickname AS challenger_nickname,
             d.nickname AS defender_nickname
      FROM governor_sieges gs
      LEFT JOIN sectors s ON s.id = gs.sector_id
      LEFT JOIN users a ON a.wallet_address = gs.challenger_wallet
      LEFT JOIN users d ON d.wallet_address = gs.defender_wallet
      WHERE gs.status IN ('declared','active','pending')
      ORDER BY gs.created_at DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    res.json({ sieges: rows });
  } catch (err) { handleErr(res, err, 'siege'); }
});

// ═══════════════════════════════════════════════════════════════
// CHRONICLE 탭 (19번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/chronicle?limit=50
 * Chronicle 목록 + 통계
 */
router.get('/chronicle', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const [recent, stats] = await Promise.all([
      pool.query(`
        SELECT c.*, u.nickname AS actor_nickname
        FROM server_chronicles c
        LEFT JOIN users u ON u.wallet_address = c.actor_wallet
        ORDER BY c.occurred_at DESC
        LIMIT $1
      `, [limit]),
      pool.query(`
        SELECT
          event_type,
          COUNT(*) AS count,
          MAX(occurred_at) AS last_occurred
        FROM server_chronicles
        WHERE occurred_at >= NOW() - INTERVAL '7 days'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 20
      `),
    ]);

    res.json({ chronicles: recent.rows, stats: stats.rows });
  } catch (err) { handleErr(res, err, 'chronicle'); }
});

/**
 * POST /api/admin/chronicle/test-webhook
 * Discord Webhook 테스트
 */
router.post('/chronicle/test-webhook', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'discord_webhook_url'`
    );
    const webhookUrl = rows[0]?.value?.replace(/^"|"$/g, '');
    if (!webhookUrl) return res.status(400).json({ error: 'NO_WEBHOOK_URL' });

    const payload = {
      embeds: [{
        title: '🔔 Webhook 테스트',
        description: 'Admin에서 발송한 테스트 메시지입니다.',
        color: 0x4fc3f7,
        timestamp: new Date().toISOString(),
      }]
    };

    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return res.status(500).json({ error: 'NODE_FETCH_NOT_AVAILABLE' });

    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    res.json({ success: r.ok, status: r.status });
  } catch (err) { handleErr(res, err, 'chronicle/webhook'); }
});

// ═══════════════════════════════════════════════════════════════
// BETTING 탭 (21번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/betting
 * 베팅 이벤트 전체 목록
 */
router.get('/betting', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,
             (SELECT COUNT(*) FROM war_bets WHERE event_id = e.id) AS bet_count
      FROM war_bet_events e
      ORDER BY e.created_at DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    res.json({ events: rows });
  } catch (err) { handleErr(res, err, 'betting'); }
});

/**
 * POST /api/admin/betting/:id/resolve
 * 베팅 이벤트 결과 확정
 */
router.post('/betting/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { winner_option } = req.body || {};
    if (!winner_option) return res.status(400).json({ error: 'WINNER_OPTION_REQUIRED' });

    const bettingService = require('../services/warBetting');
    const result = await bettingService.resolveEvent(id, winner_option);
    res.json(result);
  } catch (err) { handleErr(res, err, 'betting/resolve'); }
});

// ═══════════════════════════════════════════════════════════════
// ONBOARDING 탭 (22번째)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/onboarding
 * 온보딩 완료율 + 단계별 이탈률
 */
router.get('/onboarding', requireAdmin, async (req, res) => {
  try {
    const [funnel, recent] = await Promise.all([
      pool.query(`SELECT * FROM admin_onboarding_funnel`).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT
          DATE(created_at) AS date,
          COUNT(*) AS started,
          COUNT(*) FILTER (WHERE completed = true) AS completed,
          COUNT(*) FILTER (WHERE skipped = true) AS skipped
        FROM user_onboarding
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({ funnel: funnel.rows, daily: recent.rows });
  } catch (err) { handleErr(res, err, 'onboarding'); }
});

// ═══════════════════════════════════════════════════════════════
// P5-6 TERRITORY ECONOMY ADMIN
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/territory/economy
 * 영토 생산 경제 대시보드 (재료 발행량, 수확 빈도, 섹터별 분포)
 */
router.get('/territory/economy', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const [materialIssued, harvestStats, topClaims, sectorBreakdown, suspiciousHarvesters] = await Promise.all([
      // 기간 내 재료 지급량 (meta.resourceDrops 기반)
      pool.query(`
        SELECT
          drop_item->>'code' AS resource_code,
          SUM((drop_item->>'quantity')::int) AS total_quantity,
          COUNT(DISTINCT from_wallet) AS unique_harvesters
        FROM transactions,
             jsonb_array_elements(COALESCE(meta->'resourceDrops','[]'::jsonb)) AS drop_item
        WHERE type IN ('mining','instant_harvest')
          AND created_at > NOW() - ($1 || ' days')::INTERVAL
        GROUP BY resource_code
        ORDER BY total_quantity DESC
        LIMIT 30
      `, [days]).catch(() => ({ rows: [] })),

      // 전체 수확 통계
      pool.query(`
        SELECT
          COUNT(*) AS total_harvests,
          COUNT(DISTINCT from_wallet) AS unique_harvesters,
          SUM(pp_amount) AS total_pp_issued,
          AVG(pp_amount) AS avg_pp_per_harvest,
          MAX(pp_amount) AS max_pp_harvest
        FROM transactions
        WHERE type IN ('mining','instant_harvest')
          AND created_at > NOW() - ($1 || ' days')::INTERVAL
      `, [days]).catch(() => ({ rows: [{}] })),

      // 상위 생산 클레임 (픽셀 수 기준 — 섹터 정보 포함)
      pool.query(`
        SELECT c.id AS claim_id, c.owner,
               COUNT(p.lat) AS pixel_count,
               COALESCE(s.tier,'frontier') AS sector_type,
               COALESCE(s.name,'Uncharted') AS sector_name,
               (c.image_url IS NOT NULL) AS has_image
        FROM claims c
        LEFT JOIN pixels p ON p.claim_id = c.id
        LEFT JOIN sectors s ON s.id = p.sector_id
        WHERE c.deleted_at IS NULL AND c.owner IS NOT NULL
        GROUP BY c.id, c.owner, s.tier, s.name, c.image_url
        ORDER BY COUNT(p.lat) DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      // 섹터별 수확 활동
      pool.query(`
        SELECT
          COALESCE(s.tier,'frontier') AS sector_type,
          COALESCE(s.name,'Uncharted') AS sector_name,
          COUNT(DISTINCT c.owner) AS active_owners,
          COUNT(DISTINCT c.id) AS claim_count,
          COUNT(p.lat) AS pixel_count
        FROM pixels p
        JOIN claims c ON c.id = p.claim_id AND c.deleted_at IS NULL
        LEFT JOIN sectors s ON s.id = p.sector_id
        GROUP BY s.tier, s.name
        ORDER BY s.tier, COUNT(p.lat) DESC
        LIMIT 40
      `).catch(() => ({ rows: [] })),

      // 의심스러운 수확 빈도 (같은 지갑이 24시간 내 5회 이상)
      pool.query(`
        SELECT
          from_wallet AS wallet,
          COUNT(*) AS harvest_count,
          MIN(created_at) AS first_harvest,
          MAX(created_at) AS last_harvest,
          SUM(pp_amount) AS total_pp
        FROM transactions
        WHERE type IN ('mining','instant_harvest')
          AND created_at > NOW() - ($1 || ' days')::INTERVAL
        GROUP BY from_wallet
        HAVING COUNT(*) > 5
        ORDER BY harvest_count DESC
        LIMIT 20
      `, [days]).catch(() => ({ rows: [] })),
    ]);

    // Compute material burn (resources used in ship builds)
    const materialBurn = await pool.query(`
      SELECT
        mat_key AS resource_code,
        SUM((mat_val::text)::int) AS total_used,
        COUNT(*) AS build_count
      FROM ship_build_jobs,
           jsonb_each_text(COALESCE(minerals_used, '{}'::jsonb)) AS m(mat_key, mat_val)
      WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
      GROUP BY mat_key
      ORDER BY total_used DESC
      LIMIT 20
    `, [days]).catch(() => ({ rows: [] }));

    res.json({
      period: { days },
      materialIssued: materialIssued.rows,
      materialBurn: materialBurn.rows,
      harvestStats: harvestStats.rows[0] || {},
      topClaims: topClaims.rows,
      sectorBreakdown: sectorBreakdown.rows,
      suspiciousHarvesters: suspiciousHarvesters.rows,
    });
  } catch (err) { handleErr(res, err, 'territory/economy'); }
});

/**
 * GET /api/admin/territory/upgrades
 * 영토 업그레이드 현황 (업그레이드 분포, 총 GP 소각)
 */
router.get('/territory/upgrades', requireAdmin, async (req, res) => {
  try {
    const [upgradeStats, topUpgraded] = await Promise.all([
      pool.query(`
        SELECT upgrade_type, level, COUNT(*) AS count, SUM(gp_spent) AS total_gp_spent
        FROM territory_upgrades
        WHERE is_active = true
        GROUP BY upgrade_type, level
        ORDER BY upgrade_type, level
      `).catch(() => ({ rows: [] })),

      pool.query(`
        SELECT u.owner, u.claim_id, COUNT(*) AS upgrade_slots, SUM(u.level) AS total_levels, SUM(u.gp_spent) AS total_gp
        FROM territory_upgrades u
        WHERE u.is_active = true
        GROUP BY u.owner, u.claim_id
        ORDER BY total_levels DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({ upgradeStats: upgradeStats.rows, topUpgraded: topUpgraded.rows });
  } catch (err) { handleErr(res, err, 'territory/upgrades'); }
});

/**
 * GET /api/admin/territory/sector-control
 * 섹터별 컨트롤 현황 (상위 소유자, 픽셀 분포)
 */
router.get('/territory/sector-control', requireAdmin, async (req, res) => {
  try {
    const sectorSummary = await pool.query(`
      SELECT
        COALESCE(s.tier,'frontier') AS sector_type,
        COALESCE(s.name,'Uncharted') AS sector_name,
        s.id AS sector_id,
        COUNT(DISTINCT c.owner) AS owner_count,
        COUNT(DISTINCT c.id) AS claim_count,
        COUNT(p.lat) AS pixel_count,
        (
          SELECT c2.owner FROM claims c2
          JOIN pixels p2 ON p2.claim_id = c2.id
          WHERE p2.sector_id = s.id AND c2.deleted_at IS NULL
          GROUP BY c2.owner
          ORDER BY COUNT(*) DESC LIMIT 1
        ) AS top_owner
      FROM pixels p
      JOIN claims c ON c.id = p.claim_id AND c.deleted_at IS NULL
      LEFT JOIN sectors s ON s.id = p.sector_id
      GROUP BY s.tier, s.name, s.id
      ORDER BY s.tier, COUNT(p.lat) DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    res.json({ sectorControl: sectorSummary.rows });
  } catch (err) { handleErr(res, err, 'territory/sector-control'); }
});

/**
 * POST /api/admin/territory/production-profile
 * 영토 생산 프로파일 수정 (mining_reward_min/max, sector mults)
 * body: { key, value } — updates settings table
 */
router.post('/territory/production-profile', requireAdmin, async (req, res) => {
  const { key, value } = req.body;
  const allowedKeys = [
    'mining_reward_min', 'mining_reward_max',
    'mining_core_mult', 'mining_mid_mult', 'mining_frontier_mult',
    'mining_interval_core', 'mining_interval_mid', 'mining_interval_frontier',
    'resource_drop_enabled', 'resource_drop_rate_mult',
    'upgrade_p5_enabled', 'upgrade_p5_max_level',
  ];
  if (!key || !allowedKeys.includes(key)) {
    return res.status(400).json({ error: 'INVALID_KEY', allowed: allowedKeys });
  }
  try {
    await pool.query(
      `UPDATE settings SET value = $1::jsonb WHERE key = $2`,
      [JSON.stringify(value), key]
    );
    res.json({ ok: true, key, value });
  } catch (err) { handleErr(res, err, 'territory/production-profile'); }
});

// ═══════════════════════════════════════════════════════════════
// ECONOMY HEALTH — EVE MER(경제 리포트) + 뱅크런 조기경보 (읽기 전용)
//   GET /api/admin/economy/health
//   - 유통량(GP/PP/USDT) + PP담보율(미담보 PP 경보) + faucet/sink(최근 N일)
// ═══════════════════════════════════════════════════════════════
async function _safe(q, params) {
  try { const { rows } = await pool.query(q, params || []); return rows; }
  catch (e) { return [{ _error: e.message }]; }
}
router.get('/economy/health', requireAdmin, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10) || 30, 365);

    // 1) 유통량
    const circ = (await _safe(
      `SELECT COUNT(*)::int AS users,
              COALESCE(SUM(gp_balance),0) AS gp_total,
              COALESCE(SUM(pp_balance),0) AS pp_total,
              COALESCE(SUM(usdt_balance),0) AS usdt_balance_total
       FROM users`))[0] || {};

    // 2) 담보(뱅크런) — 실입금 USDT vs 출금가능 부채(PP+USDT). transactions.type 으로 추정.
    const depIn = (await _safe(
      `SELECT COALESCE(SUM(usdt_amount),0) AS v FROM transactions WHERE type ILIKE '%deposit%'`))[0]?.v || 0;
    const wOut = (await _safe(
      `SELECT COALESCE(SUM(usdt_amount),0) AS v FROM transactions WHERE type ILIKE '%withdraw%'`))[0]?.v || 0;
    const netCollateral = Number(depIn) - Number(wOut);
    const liability = Number(circ.pp_total || 0) + Number(circ.usdt_balance_total || 0); // PP는 1:1 페그 가정
    const undercollateral = liability - netCollateral;

    // 3) faucet/sink (GP) — gp_activity_log: delta>0 faucet, delta<0 sink
    const gpFlow = await _safe(
      `SELECT source,
              COALESCE(SUM(CASE WHEN delta>0 THEN delta ELSE 0 END),0) AS faucet,
              COALESCE(SUM(CASE WHEN delta<0 THEN -delta ELSE 0 END),0) AS sink,
              COUNT(*)::int AS n
       FROM gp_activity_log WHERE created_at > NOW() - ($1||' days')::interval
       GROUP BY source ORDER BY faucet DESC NULLS LAST LIMIT 30`, [String(days)]);

    // 4) faucet/sink (PP) — transactions: pp_amount by type
    const ppFlow = await _safe(
      `SELECT type, COALESCE(SUM(pp_amount),0) AS pp_total, COUNT(*)::int AS n
       FROM transactions WHERE created_at > NOW() - ($1||' days')::interval AND pp_amount IS NOT NULL
       GROUP BY type ORDER BY ABS(COALESCE(SUM(pp_amount),0)) DESC LIMIT 30`, [String(days)]);

    const gpFaucet = gpFlow.reduce((s, r) => s + Number(r.faucet || 0), 0);
    const gpSink = gpFlow.reduce((s, r) => s + Number(r.sink || 0), 0);

    res.json({
      window_days: days,
      circulation: circ,
      collateral: {
        usdt_deposited_total: Number(depIn),
        usdt_withdrawn_total: Number(wOut),
        net_collateral: netCollateral,
        withdrawable_liability_pp_plus_usdt: liability,
        undercollateralized_by: undercollateral,
        // ⚠️ >0 이면 미담보(발행 PP가 실담보 초과) — 유저 증가 시 뱅크런 위험
        bankrun_risk: undercollateral > 0
      },
      gp_flow: { faucet_total: gpFaucet, sink_total: gpSink, net: gpFaucet - gpSink, by_source: gpFlow },
      pp_flow: { by_type: ppFlow },
      // net>0(faucet>sink) 면 인플레 경향
      inflation_signal: { gp_inflating: (gpFaucet - gpSink) > 0 }
    });
  } catch (err) { handleErr(res, err, 'economy/health'); }
});

module.exports = router;

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

module.exports = router;

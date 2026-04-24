// server/routes/publicRoutes.js
// ═══════════════════════════════════════════════════════════════
// Public API (인증 불필요) + 소셜 공유 카드
// 바이블 COMPLETE_BIBLE PART 4 § 4.5, 4.6 기준
//
// GET /api/public/stats              — 서버 전체 통계
// GET /api/public/leaderboard        — 리더보드
// GET /api/public/chronicles         — 최근 Chronicle
// GET /api/public/chronicles/weekly  — 최신 Weekly Chronicle
// GET /api/public/share/:token       — 공유 카드 조회 + OG 메타
// GET /api/public/events/live        — SSE 실시간 이벤트
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const ce = require('../services/chronicleEnhanced');

function handleErr(res, err, context) {
  console.error(`[publicRoutes] ${context} error:`, err);
  res.status(500).json({ error: 'SERVER_ERROR' });
}

// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/public/stats
 * 서버 전체 현황 (외부 공개)
 */
router.get('/stats', async (req, res) => {
  try {
    const [userStats, claimStats, ppStats, activityStats] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total_users,
               COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '24 hours') AS active_users_24h,
               COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') AS active_users_7d
        FROM users
      `),
      pool.query(`
        SELECT COUNT(*) AS total_claims,
               COALESCE(SUM(width * height), 0) AS total_pixels_claimed
        FROM claims WHERE deleted_at IS NULL
      `).catch(() => ({ rows: [{ total_claims: 0, total_pixels_claimed: 0 }] })),
      pool.query(`
        SELECT COALESCE(SUM(pp_balance), 0) AS total_pp_in_circulation
        FROM users
      `),
      pool.query(`
        SELECT sector_code, COUNT(*) AS event_count
        FROM server_chronicles
        WHERE occurred_at >= NOW() - INTERVAL '24 hours'
          AND sector_code IS NOT NULL
        GROUP BY sector_code
        ORDER BY event_count DESC LIMIT 1
      `),
    ]);

    res.json({
      total_users: parseInt(userStats.rows[0].total_users) || 0,
      active_users_24h: parseInt(userStats.rows[0].active_users_24h) || 0,
      active_users_7d: parseInt(userStats.rows[0].active_users_7d) || 0,
      total_claims: parseInt(claimStats.rows[0].total_claims) || 0,
      pixels_claimed: parseInt(claimStats.rows[0].total_pixels_claimed) || 0,
      total_pp_in_circulation: parseFloat(ppStats.rows[0].total_pp_in_circulation) || 0,
      top_sector_by_activity: activityStats.rows[0]?.sector_code || null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { handleErr(res, err, 'stats'); }
});

/**
 * GET /api/public/leaderboard
 * 리더보드 (영토, PP, Governor)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const [topTerritory, topPP, topGovernors] = await Promise.all([
      // 최다 영토 보유
      pool.query(`
        SELECT u.nickname, u.wallet_address,
               COUNT(c.id) AS claim_count,
               COALESCE(SUM(c.width * c.height), 0) AS total_px,
               g.name AS guild_name
        FROM users u
        LEFT JOIN claims c ON c.owner = u.wallet_address AND c.deleted_at IS NULL
        LEFT JOIN guilds g ON g.id = u.guild_id
        GROUP BY u.wallet_address, u.nickname, g.name
        ORDER BY total_px DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      // 주간 최다 PP
      pool.query(`
        SELECT u.nickname, u.wallet_address,
               COALESCE(SUM(c.value_pp), 0) AS weekly_pp,
               g.name AS guild_name
        FROM server_chronicles c
        JOIN users u ON u.wallet_address = c.actor_wallet
        LEFT JOIN guilds g ON g.id = u.guild_id
        WHERE c.occurred_at >= NOW() - INTERVAL '7 days'
          AND c.value_pp > 0
        GROUP BY u.wallet_address, u.nickname, g.name
        ORDER BY weekly_pp DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      // Governor 랭킹 (재임 기간) — sector_governance 사용
      pool.query(`
        SELECT sg.sector_code, u.nickname, u.wallet_address,
               sg.governor_since,
               EXTRACT(DAY FROM NOW() - sg.governor_since)::INT AS days_held
        FROM sector_governance sg
        JOIN users u ON u.wallet_address = sg.governor_wallet
        WHERE sg.governor_wallet IS NOT NULL
        ORDER BY days_held DESC
        LIMIT 10
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({
      top_territory: topTerritory.rows.map((r, i) => ({
        rank: i + 1,
        nickname: r.nickname,
        guild_name: r.guild_name,
        total_px: parseInt(r.total_px) || 0,
        claim_count: parseInt(r.claim_count) || 0,
      })),
      top_pp_earner: topPP.rows.map((r, i) => ({
        rank: i + 1,
        nickname: r.nickname,
        guild_name: r.guild_name,
        weekly_pp: parseFloat(r.weekly_pp) || 0,
      })),
      top_governors: topGovernors.rows.map((r, i) => ({
        rank: i + 1,
        sector: r.sector_code,
        governor: r.nickname,
        days_held: parseInt(r.days_held) || 0,
      })),
      generated_at: new Date().toISOString(),
    });
  } catch (err) { handleErr(res, err, 'leaderboard'); }
});

/**
 * GET /api/public/chronicles?limit=20
 * 최근 공개 Chronicle 목록
 */
router.get('/chronicles', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const { rows } = await pool.query(`
      SELECT c.id, c.event_type, c.sector_code,
             c.value_pp, c.value_gp,
             c.title_ko, c.title_en,
             c.occurred_at,
             u.nickname AS actor_nickname,
             c.share_token
      FROM server_chronicles c
      LEFT JOIN users u ON u.wallet_address = c.actor_wallet
      WHERE c.is_public = true
      ORDER BY c.occurred_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ chronicles: rows });
  } catch (err) { handleErr(res, err, 'chronicles'); }
});

/**
 * GET /api/public/chronicles/weekly
 * 최신 Weekly Chronicle
 */
router.get('/chronicles/weekly', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM weekly_chronicles
      ORDER BY year DESC, week_number DESC
      LIMIT 1
    `);
    if (!rows[0]) return res.json({ weekly: null });
    res.json({ weekly: rows[0] });
  } catch (err) { handleErr(res, err, 'weekly'); }
});

/**
 * GET /api/public/share/:token
 * 공유 카드 조회 (OG 메타 포함)
 * HTML이면 OG 태그 포함 HTML 반환, JSON이면 데이터만
 */
router.get('/share/:token', async (req, res) => {
  try {
    const card = await ce.getShareCard(req.params.token);
    if (!card) return res.status(404).json({ error: 'CARD_NOT_FOUND' });

    const acceptsHtml = req.headers.accept?.includes('text/html');

    if (acceptsHtml) {
      // OG 태그 포함 HTML (소셜 공유 크롤러용)
      const html = buildOGHtml(card);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    res.json({ card });
  } catch (err) { handleErr(res, err, 'share'); }
});

/**
 * SSE: GET /api/public/events/live
 * 실시간 Chronicle 이벤트 스트림
 */
router.get('/events/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.write('data: {"type":"connected"}\n\n');

  // chronicle.js 의 chronicleEmitter 활용
  let emitter = null;
  try {
    const chronicle = require('../services/chronicle');
    emitter = chronicle.chronicleEmitter;
  } catch {}

  const sendEvent = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {}
  };

  if (emitter) {
    emitter.on('event', sendEvent);
  }

  // 30초마다 heartbeat
  const heartbeat = setInterval(() => {
    try { res.write('data: {"type":"heartbeat"}\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (emitter) emitter.off('event', sendEvent);
  });
});

// ─── OG HTML 생성 ───

function buildOGHtml(card) {
  const title = card.title_ko || card.title_en || 'Occupy Mars';
  const desc = `${card.nickname || '?'}의 화성 정복 기록`;
  const gameUrl = process.env.GAME_URL || 'https://occupymars.io';
  const shareUrl = `${gameUrl}/share/${card.token}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:site_name" content="Occupy Mars">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <title>${escapeHtml(title)}</title>
  <script>window.location.href = '${gameUrl}';</script>
</head>
<body>
  <p>${escapeHtml(title)}</p>
  <p><a href="${gameUrl}">Occupy Mars</a></p>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = router;

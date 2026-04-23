/**
 * routes/public.js
 * 공개 API (인증 불필요) — Chronicle Engine (BIBLE Migration 083-B)
 *
 * GET /api/public/stats          → 서버 통계
 * GET /api/public/sectors        → 섹터 현황
 * GET /api/public/leaderboard    → 리더보드
 * GET /api/public/chronicles     → 최근 Chronicles
 * GET /api/public/events/live    → SSE 실시간 이벤트 스트림
 * GET /share/chronicle/:id       → OG 공유 카드
 */

'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../db');

let chronicleService;
try { chronicleService = require('../services/chronicle'); } catch (_) {}

// ─────────────────────────────────────────────────────────────
// GET /api/public/stats
// ─────────────────────────────────────────────────────────────
router.get('/public/stats', async (req, res) => {
  try {
    const [claimRes, usersRes, volRes, topSecRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS claim_count, COALESCE(SUM(width * height), 0) AS total_pixels FROM claims WHERE deleted_at IS NULL'),
      pool.query("SELECT COUNT(*) AS cnt FROM users WHERE last_login_at > NOW() - INTERVAL '24 hours'"),
      pool.query('SELECT COALESCE(SUM(usdt_amount), 0) AS total_usdt FROM transactions'),
      pool.query(`
        SELECT sector_code, COUNT(*) AS cnt FROM claims
        WHERE sector_code IS NOT NULL AND deleted_at IS NULL
        GROUP BY sector_code ORDER BY cnt DESC LIMIT 1
      `)
    ]);

    res.json({
      claim_count:       parseInt(claimRes.rows[0]?.claim_count ?? 0),
      total_pixels:      parseInt(claimRes.rows[0]?.total_pixels ?? 0),
      active_users_24h:  parseInt(usersRes.rows[0]?.cnt ?? 0),
      total_volume_usdt: parseFloat(volRes.rows[0]?.total_usdt ?? 0),
      top_sector:        topSecRes.rows[0]?.sector_code || null
    });
  } catch (err) {
    console.error('[PUBLIC] stats error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/sectors
// ─────────────────────────────────────────────────────────────
router.get('/public/sectors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sd.code, sd.name_en, sd.name_ko, sd.sector_type,
             sd.price_multiplier, sd.mining_multiplier,
             sg.governor_wallet, u.nickname AS governor_nickname,
             sg.tax_rate, sg.sector_policy, sg.declaration_text,
             sg.active_siege_id,
             COUNT(c.id) AS claim_count,
             COALESCE(SUM(c.width * c.height), 0) AS total_pixels
      FROM sector_definitions sd
      LEFT JOIN sector_governance sg ON sg.sector_code = sd.code
      LEFT JOIN users u ON u.wallet_address = sg.governor_wallet
      LEFT JOIN claims c ON c.sector_code = sd.code AND c.deleted_at IS NULL
      WHERE sd.is_active = true
      GROUP BY sd.code, sd.name_en, sd.name_ko, sd.sector_type,
               sd.price_multiplier, sd.mining_multiplier,
               sg.governor_wallet, u.nickname, sg.tax_rate,
               sg.sector_policy, sg.declaration_text, sg.active_siege_id
      ORDER BY CASE sd.sector_type WHEN 'core' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END, sd.code
    `);

    res.json({
      sectors: result.rows.map(s => ({
        ...s,
        price_multiplier:  parseFloat(s.price_multiplier),
        mining_multiplier: parseFloat(s.mining_multiplier),
        tax_rate:          parseFloat(s.tax_rate),
        claim_count:       parseInt(s.claim_count),
        total_pixels:      parseInt(s.total_pixels),
        has_active_siege:  !!s.active_siege_id
      }))
    });
  } catch (err) {
    console.error('[PUBLIC] sectors error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/leaderboard
// ─────────────────────────────────────────────────────────────
router.get('/public/leaderboard', async (req, res) => {
  try {
    const [topTerritory, topGov] = await Promise.all([
      pool.query(`
        SELECT c.owner, u.nickname, SUM(c.width * c.height) AS total_pixels,
               COUNT(c.id) AS claim_count
        FROM claims c
        LEFT JOIN users u ON u.wallet_address = c.owner
        WHERE c.deleted_at IS NULL
        GROUP BY c.owner, u.nickname ORDER BY total_pixels DESC LIMIT 10
      `),
      pool.query(`
        SELECT sg.sector_code, sg.governor_wallet, u.nickname AS governor_nickname,
               sg.governor_since, sg.tax_rate, sd.name_en AS sector_name,
               sd.sector_type
        FROM sector_governance sg
        LEFT JOIN users u ON u.wallet_address = sg.governor_wallet
        LEFT JOIN sector_definitions sd ON sd.code = sg.sector_code
        WHERE sg.governor_wallet IS NOT NULL
        ORDER BY CASE sd.sector_type WHEN 'core' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END
      `)
    ]);

    res.json({
      top_territory: topTerritory.rows.map(r => ({
        wallet:       r.owner,
        nickname:     r.nickname || r.owner.slice(0, 8) + '...',
        total_pixels: parseInt(r.total_pixels),
        claim_count:  parseInt(r.claim_count)
      })),
      top_governors: topGov.rows.map(r => ({
        sector_code:        r.sector_code,
        sector_name:        r.sector_name,
        sector_type:        r.sector_type,
        governor_wallet:    r.governor_wallet,
        governor_nickname:  r.governor_nickname || r.governor_wallet.slice(0, 8) + '...',
        governor_since:     r.governor_since,
        tax_rate:           parseFloat(r.tax_rate)
      }))
    });
  } catch (err) {
    console.error('[PUBLIC] leaderboard error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/chronicles
// query: limit (default 20, max 100)
// ─────────────────────────────────────────────────────────────
router.get('/public/chronicles', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '20'), 100);
  try {
    if (!chronicleService) {
      return res.json({ chronicles: [] });
    }
    const chronicles = await chronicleService.getRecentChronicles(limit, true);
    res.json({ chronicles });
  } catch (err) {
    console.error('[PUBLIC] chronicles error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/public/events/live — SSE 실시간 이벤트 스트림
// ─────────────────────────────────────────────────────────────
router.get('/public/events/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx buffering 비활성화
  res.flushHeaders();

  // 연결 확인
  res.write('data: {"type":"connected","message":"Live chronicle stream started"}\n\n');

  // Heartbeat (30초마다 연결 유지)
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  // Chronicle 이벤트 핸들러
  const onChronicle = (chronicle) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'chronicle', data: chronicle })}\n\n`);
    } catch (_) {}
  };

  if (chronicleService && chronicleService.chronicleEmitter) {
    chronicleService.chronicleEmitter.on('chronicle', onChronicle);
  }

  // 연결 해제 시 정리
  req.on('close', () => {
    clearInterval(heartbeat);
    if (chronicleService && chronicleService.chronicleEmitter) {
      chronicleService.chronicleEmitter.removeListener('chronicle', onChronicle);
    }
  });
});

module.exports = router;

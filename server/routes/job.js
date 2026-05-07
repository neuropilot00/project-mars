/**
 * routes/job.js
 * 직업 시스템 API — MASTER_PLAN Phase 1.7
 *
 * GET  /api/jobs                   → 전체 직업 목록
 * GET  /api/user/job               → 내 현재 직업 + 버프 + 변경 상태
 * POST /api/user/job               → 직업 선택/변경
 * GET  /api/user/job/change-status → 변경 가능 여부
 * GET  /api/admin/jobs             → 어드민: 직업별 유저 분포 통계
 * PUT  /api/admin/job-buff         → 어드민: 버프 수치 수정
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const jobService = require('../services/job');

// ✅ [v7.44] JWT 인증 미들웨어
const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'INVALID_TOKEN' }); }
};
function getAuthWallet(req) {
  return (req.user?.wallet_address || req.user?.wallet || req.user?.walletAddress || '').toLowerCase().trim();
}

// ── 미들웨어: wallet 추출 헬퍼 ──
function getWallet(req) {
  return (req.query.wallet || req.body.wallet || req.headers['x-wallet'] || '').toLowerCase();
}

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) { res.status(403).json({ error: 'FORBIDDEN' }); return false; }
  return true;
}

// ─────────────────────────────────────────
// GET /api/jobs
// 전체 직업 목록 (프론트엔드 선택 UI용)
// ─────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  try {
    const lang = ['en','ko','ja','zh'].includes(req.query.lang) ? req.query.lang : 'en';
    const jobs = await jobService.getAllJobs(lang);
    res.json({ jobs });
  } catch (err) {
    console.error('[JOB] GET /jobs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/user/job
// 내 현재 직업 + 버프 목록 + 변경 상태
// ─────────────────────────────────────────
router.get('/user/job', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    const lang = ['en','ko','ja','zh'].includes(req.query.lang) ? req.query.lang : 'en';
    const data = await jobService.getUserJob(wallet, lang);
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  } catch (err) {
    console.error('[JOB] GET /user/job error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/user/job
// 직업 선택/변경 { wallet, jobCode }
// ─────────────────────────────────────────
router.post('/user/job', requireAuth, async (req, res) => {
  const wallet = getAuthWallet(req);
  const { jobCode } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  if (!jobCode) return res.status(400).json({ error: 'jobCode required' });
  try {
    const result = await jobService.selectJob(wallet, jobCode);
    if (!result.success) return res.status(400).json({ error: result.message, cooldownEndsAt: result.cooldownEndsAt });
    res.json(result);
  } catch (err) {
    console.error('[JOB] POST /user/job error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/user/job/change-status
// 직업 변경 가능 여부 상세 조회
// ─────────────────────────────────────────
router.get('/user/job/change-status', async (req, res) => {
  const wallet = getWallet(req);
  if (!wallet) return res.status(400).json({ error: 'Wallet required' });
  try {
    const data = await jobService.getUserJob(wallet, 'en');
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json({ changeStatus: data.changeStatus });
  } catch (err) {
    console.error('[JOB] GET /user/job/change-status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/admin/jobs
// 어드민: 직업별 유저 분포 + 버프 수치 + 최근 변경 로그
// ─────────────────────────────────────────
router.get('/admin/jobs', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [distribution, buffs, recentLog, recentAgg, perJobBalance] = await Promise.all([
      pool.query(`SELECT * FROM admin_job_distribution`).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT j.code, j.name_ko, j.icon_emoji,
               jb.buff_key, jb.buff_value, jb.description
        FROM jobs j
        JOIN job_buffs jb ON jb.job_id = j.id
        WHERE j.is_active = true
        ORDER BY j.sort_order, jb.buff_key
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT jcl.changed_at, jcl.change_type, jcl.gp_cost,
               u.nickname, u.wallet_address,
               fj.name_en AS from_job, tj.name_en AS to_job
        FROM job_change_log jcl
        JOIN users u ON u.wallet_address = jcl.wallet_address
        LEFT JOIN jobs fj ON fj.id = jcl.from_job_id
        JOIN jobs tj ON tj.id = jcl.to_job_id
        ORDER BY jcl.changed_at DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT change_type, COUNT(*)::int AS cnt
        FROM job_change_log
        WHERE changed_at >= NOW() - INTERVAL '7 days'
        GROUP BY change_type
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT j.id, j.code, j.name_en AS name, j.icon_emoji,
               COUNT(u.wallet_address)::int AS user_count,
               COALESCE(AVG(u.gp_balance), 0)::numeric(20,2) AS avg_gp,
               COALESCE(AVG(u.pp_balance), 0)::numeric(20,4) AS avg_pp
        FROM jobs j
        LEFT JOIN users u ON u.current_job_id = j.id
        WHERE j.is_active = true
        GROUP BY j.id, j.code, j.name_en, j.icon_emoji, j.sort_order
        ORDER BY j.sort_order
      `).catch(() => ({ rows: [] })),
    ]);

    // Frontend-friendly shape: byJob (with avg_gp/avg_pp), noJob, recentChanges, recentLog, buffs
    const byJob = perJobBalance.rows.map(r => ({
      ...r,
      user_count: parseInt(r.user_count) || 0,
      avg_gp:     parseFloat(r.avg_gp) || 0,
      avg_pp:     parseFloat(r.avg_pp) || 0,
    }));
    const noneRow = (distribution.rows || []).find(r => r.job_code === 'none' || r.job_code === null);
    const noJob = noneRow ? parseInt(noneRow.user_count) || 0 : 0;
    const recentChanges = (recentAgg.rows || []).map(r => ({
      change_type: r.change_type,
      cnt: parseInt(r.cnt) || 0,
    }));

    res.json({
      byJob,
      noJob,
      recentChanges,
      distribution: distribution.rows,
      buffs: buffs.rows,
      recentLog: recentLog.rows,
    });
  } catch (err) {
    console.error('[JOB] GET /admin/jobs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// PUT /api/admin/job-buff
// 어드민: 버프 수치 수정 { jobId, buffKey, value }
// ─────────────────────────────────────────
router.put('/admin/job-buff', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { jobId, buffKey, value } = req.body;
  if (!jobId || !buffKey || value === undefined) {
    return res.status(400).json({ error: 'jobId, buffKey, value required' });
  }
  const numValue = parseFloat(value);
  if (isNaN(numValue) || numValue < 0) {
    return res.status(400).json({ error: 'value must be a non-negative number' });
  }
  try {
    const updated = await jobService.updateJobBuff(parseInt(jobId), buffKey, numValue);
    res.json({ success: true, buff: updated });
  } catch (err) {
    console.error('[JOB] PUT /admin/job-buff error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

'use strict';
/**
 * Bug Report routes (mounted at '/').
 * ────────────────────────────────────
 *  POST /api/bug-report                       — public submit (rate-limited)
 *  POST /bug-report                           — compatibility submit alias
 *  GET  /admin/api/bug-reports                — admin list (X-ADMIN-SECRET)
 *  POST /admin/api/bug-reports/:id/status     — admin/Claude Code update
 *
 * Mounted at '/' so the full paths above match the rest of the codebase
 * (server/index.js mounts public routes at /api and admin at /admin/api).
 */

const express = require('express');
const router  = express.Router();
const svc     = require('../services/bugReport');

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString().split(',')[0].trim();
}

function requireAdmin(req, res) {
  const s = req.headers['x-admin-secret'] || req.headers['x-admin-key'];
  if (!s || s !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
}

async function submitBugReport(req, res) {
  try {
    const out = await svc.submitReport(req.body || {}, getIp(req));
    if (!out.ok) {
      const code = out.error === 'rate_limited' ? 429
                 : out.error === 'disabled'     ? 503
                 : 400;
      return res.status(code).json(out);
    }
    res.json(out);
  } catch (e) {
    console.error('[bugReport] submit error:', e.message);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
}

router.post('/api/bug-report', submitBugReport);
router.post('/bug-report', submitBugReport);

router.get('/admin/api/bug-reports', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await svc.listReports({
      status:   req.query.status,
      category: req.query.category,
      limit:    req.query.limit,
      offset:   req.query.offset
    });
    res.json({ reports: rows });
  } catch (e) {
    console.error('[bugReport] list error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/admin/api/bug-reports/:id/status', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const out = await svc.updateStatus(req.params.id, req.body || {});
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (e) {
    console.error('[bugReport] update error:', e.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;

'use strict';
/**
 * Bug Report service
 * ─────────────────
 *  - submitReport(payload, ip): persist to bug_reports table + mirror to
 *    /server/bug-reports/inbox/<id>.json so Claude Code (or any watcher)
 *    can pick up new reports without polling the DB.
 *  - listReports(filter): admin listing.
 *  - updateStatus(id, fields): admin/Claude Code update.
 *
 * Settings honored (all admin-tunable):
 *   bug_report_enabled            'true' | 'false'
 *   bug_report_per_ip_per_hour    integer
 *   bug_report_inbox_dir          relative dir for JSON mirror
 *   bug_report_min_body_chars     integer (0 disables floor)
 */

const fs = require('fs');
const path = require('path');
const { pool, getSetting } = require('../db');

const ALLOWED_CATS = new Set(['ui', 'gameplay', 'payment', 'performance', 'other']);
const ALLOWED_STATUSES = new Set(['new', 'triaged', 'in_progress', 'fixed', 'wontfix', 'duplicate']);
const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024;

function clean(val, max) {
  if (val === null || val === undefined) return null;
  return String(val).slice(0, max);
}

function repoRoot() {
  // server/services/bugReport.js → repo root is two dirs up
  return path.resolve(__dirname, '..', '..');
}

async function _resolveInboxDir() {
  let dir = await getSetting('bug_report_inbox_dir', 'server/bug-reports/inbox');
  if (!dir) dir = 'server/bug-reports/inbox';
  if (!path.isAbsolute(dir)) dir = path.join(repoRoot(), dir);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

async function _resolveScreenshotDir() {
  const dir = path.join(repoRoot(), 'server', 'bug-reports', 'screenshots');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function normalizeSubmitPayload(payload) {
  const context = payload && typeof payload.context === 'object' ? payload.context : {};
  const rawDescription = payload.description || payload.body || '';
  const body = clean(rawDescription, 2000) || '';
  const titleSource = payload.title || payload.summary || body.split('\n')[0] || '';
  return {
    category: payload.category,
    title: clean(titleSource, 120) || '',
    body,
    wallet: payload.wallet || context.wallet || null,
    url: payload.url || context.url || null,
    userAgent: payload.userAgent,
    lang: payload.lang,
    viewport: payload.viewport || context.viewport || null,
    recentErrors: payload.recentErrors || context.recentErrors || null,
    context,
    screenshot: payload.screenshot || null
  };
}

async function writeScreenshotMirror(reportId, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_SCREENSHOT_BYTES) return null;
  const dir = await _resolveScreenshotDir();
  const fname = String(reportId).padStart(8, '0') + '.' + ext;
  const fpath = path.join(dir, fname);
  fs.writeFileSync(fpath, bytes);
  return path.relative(repoRoot(), fpath);
}

async function _checkRateLimit(ip) {
  const limit = parseInt(await getSetting('bug_report_per_ip_per_hour', '20'), 10) || 20;
  if (!ip) return { ok: true };
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM bug_reports
       WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [ip]
  );
  const n = (r.rows[0] && r.rows[0].n) || 0;
  if (n >= limit) return { ok: false, error: 'rate_limited', retryAfterMin: 60 };
  return { ok: true };
}

async function submitReport(payload, ip) {
  payload = normalizeSubmitPayload(payload || {});
  const enabled = String(await getSetting('bug_report_enabled', 'true')).toLowerCase() === 'true';
  if (!enabled) return { ok: false, error: 'disabled' };

  const minChars = parseInt(await getSetting('bug_report_min_body_chars', '0'), 10) || 0;
  const title = payload.title || '';
  const body  = payload.body || '';
  if ((title.length + body.length) < minChars) {
    return { ok: false, error: 'too_short' };
  }
  if (!title && !body) return { ok: false, error: 'empty' };

  const rl = await _checkRateLimit(ip);
  if (!rl.ok) return rl;

  const category = ALLOWED_CATS.has(payload.category) ? payload.category : 'other';
  const wallet   = clean(payload.wallet, 80);
  const url      = clean(payload.url, 1000);
  const ua       = clean(payload.userAgent, 500);
  const lang     = clean(payload.lang, 16);
  const viewport = payload.viewport && typeof payload.viewport === 'object'
    ? { w: +payload.viewport.w || null, h: +payload.viewport.h || null, dpr: +payload.viewport.dpr || null }
    : null;
  const recentErrors = Array.isArray(payload.recentErrors)
    ? payload.recentErrors.slice(-10).map(e => ({
        ts: +e.ts || null,
        message: clean(e && e.message, 500),
        source:  clean(e && e.source, 300),
        line:    Number.isInteger(e && e.line) ? e.line : null
      }))
    : null;

  // node-pg sends JS objects as text by default; cast JSONB columns explicitly
  // so PG parses them rather than rejecting "[object Object]".
  const ins = await pool.query(
    `INSERT INTO bug_reports
       (category, title, body, wallet, url, user_agent, viewport, lang, recent_errors, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10)
     RETURNING id, created_at`,
    [
      category, title, body, wallet, url, ua,
      viewport ? JSON.stringify(viewport) : null,
      lang,
      recentErrors ? JSON.stringify(recentErrors) : null,
      ip || null
    ]
  );
  const row = ins.rows[0];

  // Mirror to disk for the Claude Code watcher pipeline.
  // Failures here MUST NOT block the user — log and move on.
  try {
    const dir = await _resolveInboxDir();
    const screenshotPath = await writeScreenshotMirror(row.id, payload.screenshot);
    const fname = String(row.id).padStart(8, '0') + '_' + category + '.json';
    const fpath = path.join(dir, fname);
    const doc = {
      id: row.id,
      created_at: row.created_at,
      category, title, body, wallet, url,
      user_agent: ua, viewport, lang,
      recent_errors: recentErrors,
      context: payload.context || null,
      screenshot_path: screenshotPath,
      codex_hint: 'Open this report, reproduce from body/context, implement the fix, then update status with resolved_commit.',
      ip_address: ip || null,
      status: 'new'
    };
    fs.writeFileSync(fpath, JSON.stringify(doc, null, 2), 'utf8');
  } catch (e) {
    console.error('[bugReport] inbox mirror failed:', e.message);
  }

  console.log(`[bugReport] new #${row.id} cat=${category} wallet=${wallet || '-'} title="${title.slice(0,60)}"`);
  return { ok: true, id: row.id };
}

async function listReports({ status, category, limit = 50, offset = 0 } = {}) {
  const where = [];
  const args  = [];
  if (status && ALLOWED_STATUSES.has(status))   { args.push(status);   where.push(`status = $${args.length}`); }
  if (category && ALLOWED_CATS.has(category))   { args.push(category); where.push(`category = $${args.length}`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  args.push(lim, off);
  const r = await pool.query(
    `SELECT id, category, title, body, wallet, url, user_agent, lang, viewport,
            recent_errors, status, claude_notes, claude_attempts, resolved_commit,
            created_at, updated_at
       FROM bug_reports ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args
  );
  return r.rows;
}

async function updateStatus(id, { status, claudeNotes, resolvedCommit, incrementAttempts } = {}) {
  const sets = [];
  const args = [];
  if (status) {
    if (!ALLOWED_STATUSES.has(status)) return { ok: false, error: 'bad_status' };
    args.push(status); sets.push(`status = $${args.length}`);
  }
  if (claudeNotes !== undefined) {
    args.push(clean(claudeNotes, 8000)); sets.push(`claude_notes = $${args.length}`);
  }
  if (resolvedCommit !== undefined) {
    args.push(clean(resolvedCommit, 80)); sets.push(`resolved_commit = $${args.length}`);
  }
  if (incrementAttempts) {
    sets.push(`claude_attempts = claude_attempts + 1`);
  }
  if (!sets.length) return { ok: false, error: 'nothing_to_update' };
  sets.push('updated_at = NOW()');
  args.push(parseInt(id, 10));
  const r = await pool.query(
    `UPDATE bug_reports SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING id, status`,
    args
  );
  if (!r.rows.length) return { ok: false, error: 'not_found' };
  return { ok: true, id: r.rows[0].id, status: r.rows[0].status };
}

module.exports = { submitReport, listReports, updateStatus };

#!/usr/bin/env node
'use strict';
/**
 * Bug Report → Claude Code pipeline CLI.
 *
 * Reads/writes the on-disk inbox at server/bug-reports/{inbox,processed,wontfix}
 * and (when DATABASE_URL is set) keeps the bug_reports table in sync.
 *
 * Subcommands:
 *   list                          List pending inbox files (id, cat, title).
 *   next                          Print the next pending report as JSON.
 *   next-and-fix                  Same as `next` but exits 1 when nothing pending
 *                                 — handy for /loop guards.
 *   show <id>                     Print a single report (inbox or processed).
 *   claim <id>                    Move inbox/<id>* → processed/<id>*, bump
 *                                 claude_attempts, set status='in_progress'.
 *   resolve <id> [--commit <sha>] [--note "..."]
 *                                 Set status='fixed', resolved_commit=<sha>,
 *                                 claude_notes=<note>.
 *   skip <id> [--reason "..."]    Move processed/<id>* → wontfix/, set status='wontfix'.
 *
 * Designed for both manual one-shot use and /loop dynamic mode.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INBOX     = path.join(ROOT, 'server', 'bug-reports', 'inbox');
const PROCESSED = path.join(ROOT, 'server', 'bug-reports', 'processed');
const WONTFIX   = path.join(ROOT, 'server', 'bug-reports', 'wontfix');

[INBOX, PROCESSED, WONTFIX].forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch(_) {} });

function listDir(dir) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort();
}

function findById(dir, id) {
  const prefix = String(id).padStart(8, '0') + '_';
  return listDir(dir).find(f => f.startsWith(prefix)) || null;
}

function readReport(dir, fname) {
  return JSON.parse(fs.readFileSync(path.join(dir, fname), 'utf8'));
}

function writeReport(dir, fname, doc) {
  fs.writeFileSync(path.join(dir, fname), JSON.stringify(doc, null, 2), 'utf8');
}

function moveFile(fromDir, toDir, fname) {
  const src = path.join(fromDir, fname);
  const dst = path.join(toDir, fname);
  fs.renameSync(src, dst);
  return dst;
}

// ── Optional DB sync ──
async function dbUpdate(id, fields) {
  if (!process.env.DATABASE_URL) return; // disk-only mode
  let pg;
  try { pg = require('pg'); } catch (_) { return; }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sets = [];
    const args = [];
    if (fields.status) { args.push(fields.status); sets.push(`status = $${args.length}`); }
    if (fields.note !== undefined) {
      args.push(fields.note); sets.push(`claude_notes = $${args.length}`);
    }
    if (fields.commit !== undefined) {
      args.push(fields.commit); sets.push(`resolved_commit = $${args.length}`);
    }
    if (fields.incrementAttempts) {
      sets.push('claude_attempts = claude_attempts + 1');
    }
    sets.push('updated_at = NOW()');
    args.push(id);
    await pool.query(
      `UPDATE bug_reports SET ${sets.join(', ')} WHERE id = $${args.length}`,
      args
    );
  } catch (e) {
    console.error('[bug-report-watch] DB sync failed:', e.message);
  } finally {
    await pool.end().catch(()=>{});
  }
}

// ── Subcommands ──
async function cmdList() {
  const files = listDir(INBOX);
  if (!files.length) { console.log('No pending bug reports.'); return 0; }
  console.log(`Pending: ${files.length}\n`);
  for (const f of files) {
    try {
      const r = readReport(INBOX, f);
      const ts = r.created_at ? new Date(r.created_at).toISOString().slice(0,19).replace('T',' ') : '?';
      console.log(`#${r.id}  [${(r.category||'other').padEnd(11)}] ${ts}  ${(r.title||'').slice(0,80)}`);
    } catch (e) {
      console.log(`#?  [parse-error] ${f}: ${e.message}`);
    }
  }
  return 0;
}

async function cmdNext({ failIfEmpty = false } = {}) {
  const files = listDir(INBOX);
  if (!files.length) {
    if (failIfEmpty) { process.exit(1); }
    console.log('null');
    return 0;
  }
  const r = readReport(INBOX, files[0]);
  console.log(JSON.stringify(r, null, 2));
  return 0;
}

async function cmdShow(id) {
  let f = findById(INBOX, id);
  let dir = INBOX;
  if (!f) { f = findById(PROCESSED, id); dir = PROCESSED; }
  if (!f) { f = findById(WONTFIX, id);   dir = WONTFIX; }
  if (!f) { console.error(`No report with id ${id}`); process.exit(2); }
  console.log(JSON.stringify(readReport(dir, f), null, 2));
  return 0;
}

async function cmdClaim(id) {
  const fname = findById(INBOX, id);
  if (!fname) { console.error(`No pending report with id ${id}`); process.exit(2); }
  const doc = readReport(INBOX, fname);
  doc.status = 'in_progress';
  doc.claimed_at = new Date().toISOString();
  writeReport(INBOX, fname, doc);
  moveFile(INBOX, PROCESSED, fname);
  await dbUpdate(id, { status: 'in_progress', incrementAttempts: true });
  console.log(`Claimed #${id} → processed/${fname}`);
  return 0;
}

async function cmdResolve(id, { commit, note }) {
  let fname = findById(PROCESSED, id);
  let dir = PROCESSED;
  if (!fname) { fname = findById(INBOX, id); dir = INBOX; }
  if (!fname) { console.error(`No report with id ${id}`); process.exit(2); }
  const doc = readReport(dir, fname);
  doc.status = 'fixed';
  if (commit) doc.resolved_commit = commit;
  if (note)   doc.claude_notes = note;
  doc.resolved_at = new Date().toISOString();
  writeReport(dir, fname, doc);
  if (dir === INBOX) moveFile(INBOX, PROCESSED, fname);
  await dbUpdate(id, { status: 'fixed', commit: commit || null, note: note || null });
  console.log(`Resolved #${id}${commit ? ` (commit ${commit})` : ''}`);
  return 0;
}

async function cmdSkip(id, { reason }) {
  let fname = findById(PROCESSED, id);
  let dir = PROCESSED;
  if (!fname) { fname = findById(INBOX, id); dir = INBOX; }
  if (!fname) { console.error(`No report with id ${id}`); process.exit(2); }
  const doc = readReport(dir, fname);
  doc.status = 'wontfix';
  if (reason) doc.claude_notes = reason;
  doc.skipped_at = new Date().toISOString();
  writeReport(dir, fname, doc);
  moveFile(dir, WONTFIX, fname);
  await dbUpdate(id, { status: 'wontfix', note: reason || null });
  console.log(`Skipped #${id}${reason ? ` (${reason})` : ''}`);
  return 0;
}

// ── arg parsing ──
function getFlag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] || null;
}

(async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    switch (cmd) {
      case 'list':         return process.exit(await cmdList());
      case 'next':         return process.exit(await cmdNext());
      case 'next-and-fix': return process.exit(await cmdNext({ failIfEmpty: true }));
      case 'show':         return process.exit(await cmdShow(rest[0]));
      case 'claim':        return process.exit(await cmdClaim(rest[0]));
      case 'resolve':      return process.exit(await cmdResolve(rest[0], {
        commit: getFlag(rest, '--commit'),
        note:   getFlag(rest, '--note')
      }));
      case 'skip':         return process.exit(await cmdSkip(rest[0], {
        reason: getFlag(rest, '--reason')
      }));
      default:
        console.error('Usage: bug-report-watch.js <list|next|next-and-fix|show|claim|resolve|skip> [args]');
        process.exit(64);
    }
  } catch (e) {
    console.error('[bug-report-watch] error:', e.message);
    process.exit(1);
  }
})();

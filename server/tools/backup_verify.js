#!/usr/bin/env node
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const backupDir = path.join(repoRoot, 'server', 'backups');
const providedDatabaseUrl = process.env.DATABASE_URL || '';
process.env.DATABASE_URL = providedDatabaseUrl || 'postgresql://jongho@localhost:5432/pixelwar';
let pass = 0;
let fail = 0;

function log(label, ok, extra = '') {
  console.log(`${ok ? '✅' : '❌'}  ${label}${extra ? '  ' + extra : ''}`);
  if (ok) pass += 1;
  else fail += 1;
}

function run(command, options = {}) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function latestBackupFile() {
  if (!fs.existsSync(backupDir)) return null;
  const files = fs.readdirSync(backupDir)
    .filter(name => /^backup_\d{8}_\d{6}\.sql\.gz$/.test(name))
    .map(name => {
      const fullPath = path.join(backupDir, name);
      return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] || null;
}

async function main() {
  log('DATABASE_URL resolved', !!process.env.DATABASE_URL, providedDatabaseUrl ? 'env' : 'fallback:local-pixelwar');

  try {
    const version = run('pg_dump --version');
    log('pg_dump available', !!version, version);
  } catch (error) {
    log('pg_dump available', false, 'command not found');
  }

  try {
    const version = run('psql --version');
    log('psql available for restore rehearsal', !!version, version);
  } catch (error) {
    log('psql available for restore rehearsal', false, 'command not found');
  }

  try {
    const latest = latestBackupFile();
    if (!latest) {
      log('latest backup artifact exists', false, `missing in ${backupDir}`);
    } else {
      log('latest backup artifact exists', true, latest.name);
      execFileSync('gzip', ['-t', latest.fullPath], { stdio: 'ignore' });
      log('latest backup gzip integrity', true, latest.name);
      const header = execFileSync('sh', ['-c', 'gzip -cd "$1" | head -n 30', 'sh', latest.fullPath], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024,
      });
      const looksRestorable = /PostgreSQL database dump|CREATE TABLE|COPY public\.|INSERT INTO/i.test(header);
      log('latest backup looks restorable SQL', looksRestorable, latest.name);
    }
  } catch (error) {
    log('latest backup artifact verification', false, error.message);
  }

  try {
    const { pool } = require('../db');
    try {
      await pool.query('SELECT 1');
      log('database ping', true);
    } catch (error) {
      log('database ping', false, error.message);
    }

    try {
      const requiredTables = ['users', 'settings', 'transactions', 'admin_audit_log'];
      const { rows } = await pool.query(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
          ORDER BY table_name`,
        [requiredTables]
      );
      const found = rows.map(row => row.table_name);
      const missing = requiredTables.filter(name => !found.includes(name));
      log('backup-critical tables exist', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : found.join(','));
    } catch (error) {
      log('backup-critical tables exist', false, error.message);
    }

    await pool.end();
  } catch (error) {
    log('database module load', false, error.message);
  }

  try {
    const remote = run('git remote get-url origin');
    log('git origin remote present', !!remote, remote);
  } catch (error) {
    log('git origin remote present', false, error.message);
  }

  console.log(`\n📊  ${pass} passed / ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('fatal:', error);
  process.exit(2);
});

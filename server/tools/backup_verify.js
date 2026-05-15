#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
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

async function main() {
  log('DATABASE_URL resolved', !!process.env.DATABASE_URL, providedDatabaseUrl ? 'env' : 'fallback:local-pixelwar');

  try {
    const version = run('pg_dump --version');
    log('pg_dump available', !!version, version);
  } catch (error) {
    log('pg_dump available', false, 'command not found');
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

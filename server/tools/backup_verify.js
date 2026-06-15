#!/usr/bin/env node
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');
const path = require('path');
const { Client } = require('pg');

const repoRoot = path.resolve(__dirname, '..', '..');
const backupDir = path.join(repoRoot, 'server', 'backups');
const providedDatabaseUrl = process.env.DATABASE_URL || '';
const restoreDatabaseUrl = process.env.RESTORE_DATABASE_URL || '';
const restoreRehearsal = process.argv.includes('--restore-rehearsal');
process.env.DATABASE_URL = providedDatabaseUrl || 'postgresql://jongho@localhost:5432/pixelwar';
let pass = 0;
let fail = 0;

const requiredTables = ['users', 'settings', 'transactions', 'admin_audit_log'];
const coreEconomySettings = ['deposit_pp_bonus', 'withdraw_fee_percent', 'signup_pp_bonus'];

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

async function validateCoreSchema(client, labelPrefix) {
  try {
    const { rows } = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name`,
      [requiredTables]
    );
    const found = rows.map(row => row.table_name);
    const missing = requiredTables.filter(name => !found.includes(name));
    log(`${labelPrefix} backup-critical tables exist`, missing.length === 0, missing.length ? `missing=${missing.join(',')}` : found.join(','));
  } catch (error) {
    log(`${labelPrefix} backup-critical tables exist`, false, error.message);
  }

  for (const table of requiredTables) {
    try {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      log(`${labelPrefix} ${table} selectable`, true, `count=${rows[0]?.count ?? 0}`);
    } catch (error) {
      log(`${labelPrefix} ${table} selectable`, false, error.message);
    }
  }

  try {
    const { rows } = await client.query(
      `SELECT key
         FROM settings
        WHERE key = ANY($1::text[])
        ORDER BY key`,
      [coreEconomySettings]
    );
    const found = rows.map(row => row.key);
    const missing = coreEconomySettings.filter(key => !found.includes(key));
    log(`${labelPrefix} core economy settings usable`, missing.length === 0, missing.length ? `missing=${missing.join(',')}` : found.join(','));
  } catch (error) {
    log(`${labelPrefix} core economy settings usable`, false, error.message);
  }
}

async function restoreTargetHasObjects() {
  const client = new Client({ connectionString: restoreDatabaseUrl });
  try {
    await client.connect();
    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*)::int
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')) AS relations,
        (SELECT COUNT(*)::int
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typtype = 'e') AS enums
    `);
    const relations = rows[0]?.relations || 0;
    const enums = rows[0]?.enums || 0;
    return { hasObjects: relations + enums > 0, relations, enums };
  } finally {
    await client.end().catch(() => {});
  }
}

async function runRestoreRehearsal(latest) {
  if (!latest) {
    log('restore rehearsal backup selected', false, 'no latest backup artifact');
    return;
  }
  if (!restoreDatabaseUrl) {
    log('restore rehearsal target configured', false, 'set RESTORE_DATABASE_URL to an empty disposable database');
    return;
  }
  if (restoreDatabaseUrl === process.env.DATABASE_URL) {
    log('restore rehearsal target is isolated', false, 'RESTORE_DATABASE_URL must not equal DATABASE_URL');
    return;
  }

  log('restore rehearsal target configured', true, 'RESTORE_DATABASE_URL');
  log('restore rehearsal target is isolated', true);

  try {
    const target = await restoreTargetHasObjects();
    if (target.hasObjects) {
      log('restore rehearsal target is empty', false, `relations=${target.relations} enums=${target.enums}`);
      return;
    }
    log('restore rehearsal target is empty', true);
  } catch (error) {
    log('restore rehearsal target is empty', false, error.message);
    return;
  }

  try {
    execFileSync('sh', ['-c', 'gzip -cd "$1" | psql "$2" -v ON_ERROR_STOP=1 -q', 'sh', latest.fullPath, restoreDatabaseUrl], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    });
    log('restore rehearsal SQL applied', true, latest.name);
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim().split('\n').slice(-3).join(' | ') : error.message;
    log('restore rehearsal SQL applied', false, stderr);
    return;
  }

  const client = new Client({ connectionString: restoreDatabaseUrl });
  try {
    await client.connect();
    await client.query('SELECT 1');
    log('restore rehearsal database ping', true);
    await validateCoreSchema(client, 'restored');
  } catch (error) {
    log('restore rehearsal database validation', false, error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  log('DATABASE_URL resolved', !!process.env.DATABASE_URL, providedDatabaseUrl ? 'env' : 'fallback:local-pixelwar');
  if (restoreRehearsal) {
    console.log('ℹ️  restore rehearsal mode: latest backup will be applied to RESTORE_DATABASE_URL');
  }

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

  const latest = latestBackupFile();
  try {
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

  if (restoreRehearsal) {
    await runRestoreRehearsal(latest);
  }

  const sourceClient = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await sourceClient.connect();
    await sourceClient.query('SELECT 1');
    log('database ping', true);
    await validateCoreSchema(sourceClient, 'source');
  } catch (error) {
    log('database validation', false, error.message);
  } finally {
    await sourceClient.end().catch(() => {});
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

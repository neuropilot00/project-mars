/**
 * Simple file-based DB migration runner.
 *
 * Usage:
 *   node migrate.js            # apply all pending migrations
 *   node migrate.js --status   # show migration status
 *
 * Reads .sql files from ./migrations/ in lexicographic order (001_xxx.sql, 002_xxx.sql, ...)
 * and applies only those not yet recorded in the schema_migrations table.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── Use the same connection config as db.js ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// ── Ensure the schema_migrations tracking table exists ──
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ── Get list of already-applied migration filenames ──
async function getAppliedMigrations(client) {
  const res = await client.query(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(res.rows.map((r) => r.filename));
}

// ── Read all .sql files from migrations/ sorted by name ──
function getPendingFiles(appliedSet) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[migrate] No migrations/ directory found. Nothing to do.');
    return [];
  }

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic sort ensures 001 < 002 < ...

  return allFiles.filter((f) => !appliedSet.has(f));
}

// ── Apply a single migration inside a transaction ──
async function applyMigration(client, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf-8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1)',
      [filename]
    );
    await client.query('COMMIT');
    console.log(`[migrate] Applied: ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`[migrate] Failed on ${filename}: ${err.message}`);
  }
}

// ── Main: run all pending migrations ──
async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const pending = getPendingFiles(applied);

    if (pending.length === 0) {
      console.log('[migrate] All migrations are up to date.');
      return { applied: 0, total: applied.size };
    }

    console.log(`[migrate] ${pending.length} pending migration(s) found.`);

    for (const file of pending) {
      await applyMigration(client, file);
    }

    console.log(`[migrate] Done. Applied ${pending.length} migration(s).`);
    return { applied: pending.length, total: applied.size + pending.length };
  } finally {
    client.release();
  }
}

// ── Status: show which migrations have been applied ──
async function showStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const allFiles = fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
      : [];

    console.log('\n  Migration Status');
    console.log('  ────────────────────────────────────────');
    for (const f of allFiles) {
      const status = applied.has(f) ? '✓ applied' : '✗ pending';
      console.log(`  ${status}  ${f}`);
    }
    if (allFiles.length === 0) {
      console.log('  (no migration files found)');
    }
    console.log('');
  } finally {
    client.release();
  }
}

// ── CLI entry point ──
if (require.main === module) {
  const arg = process.argv[2];

  const run = arg === '--status' ? showStatus : runMigrations;

  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}

module.exports = { runMigrations };

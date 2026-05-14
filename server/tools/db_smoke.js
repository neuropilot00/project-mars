#!/usr/bin/env node
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://jongho@localhost:5432/pixelwar';

async function main() {
  const { pool } = require('../db');
  let pass = 0;
  let fail = 0;

  const check = (label, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'}  ${label}${extra ? '  ' + extra : ''}`);
    if (ok) pass += 1;
    else fail += 1;
  };

  try {
    await pool.query('SELECT 1');
    check('database ping', true);
  } catch (error) {
    check('database ping', false, error.message);
    await pool.end();
    process.exit(1);
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
    check('required tables exist', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : found.join(','));
  } catch (error) {
    check('required tables exist', false, error.message);
  }

  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM settings');
    const count = rows[0]?.count || 0;
    check('settings seeded', count > 0, `count=${count}`);
  } catch (error) {
    check('settings seeded', false, error.message);
  }

  try {
    const { rows } = await pool.query(
      `SELECT key
         FROM settings
        WHERE key = ANY($1::text[])
        ORDER BY key`,
      [['deposit_pp_bonus', 'withdraw_fee_percent', 'signup_pp_bonus']]
    );
    const found = rows.map(row => row.key);
    const requiredKeys = ['deposit_pp_bonus', 'withdraw_fee_percent', 'signup_pp_bonus'];
    const missing = requiredKeys.filter(key => !found.includes(key));
    check('core economy settings exist', missing.length === 0, missing.length ? `missing=${missing.join(',')}` : found.join(','));
  } catch (error) {
    check('core economy settings exist', false, error.message);
  }

  console.log(`\n📊  ${pass} passed / ${fail} failed`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error('fatal:', error);
  process.exit(2);
});

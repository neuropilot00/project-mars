#!/usr/bin/env node
'use strict';
// Actual PostgreSQL row/advisory locks and daily-service SQL. Shadow schema only.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const pg = require('pg');
const url = new URL(process.env.DATABASE_URL || '');
if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/codex_occupy_review_upgrade_20261010') throw Error('Exact disposable local review DB required');
const schema = 'daily_qa_' + crypto.randomBytes(6).toString('hex');
const admin = new pg.Pool({ connectionString: url.href });
const pool = new pg.Pool({ connectionString: url.href, options: '-c search_path=' + schema + ',public', application_name: schema, max: 20 });
const tables = ['factions','jobs','users','daily_missions','daily_logins','settings'];
const retired = new Set(['view_weather','explore_poi','play_cantina']);
const checks = [];
let locker, pending, singlePool;
async function account() {
  const wallet = '0x' + crypto.randomBytes(20).toString('hex');
  await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,xp) VALUES($1,$1,'mcc',0,0)", [wallet]);
  return wallet;
}
async function add(wallet, slot, type, opts = {}) {
  const row = (await pool.query(`INSERT INTO daily_missions(wallet,slot,mission_type,target_value,current_value,reward_gp,reward_xp,completed,claimed)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [wallet, slot, type, opts.target ?? 1, opts.current ?? 0, opts.gp ?? 17, opts.xp ?? 9, opts.completed ?? false, opts.claimed ?? false])).rows[0];
  return row;
}
async function rows(wallet) { return (await pool.query('SELECT * FROM daily_missions WHERE wallet=$1 ORDER BY slot', [wallet])).rows; }
async function assets(wallet) { return (await pool.query('SELECT gp_balance,xp FROM users WHERE wallet_address=$1', [wallet])).rows[0]; }
async function waitForLock(pattern) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await admin.query("SELECT COUNT(*)::int n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2", [schema, pattern]);
    if (result.rows[0].n >= 1) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw Error('Expected lock waiter did not arrive: ' + pattern);
}
(async () => {
  await admin.query('CREATE SCHEMA ' + schema);
  for (const table of tables) {
    await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    const columns = (await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval(%'", [schema, table])).rows;
    for (const column of columns) {
      const sequence = `${schema}.${table}_${column.column_name}_qa_seq`;
      await admin.query('CREATE SEQUENCE ' + sequence);
      await admin.query(`ALTER TABLE ${schema}.${table} ALTER COLUMN ${column.column_name} SET DEFAULT nextval('${sequence}')`);
    }
  }
  const fks = (await admin.query("SELECT c.conrelid::regclass::text tbl,c.conname,pg_get_constraintdef(c.oid) def FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND c.conrelid::regclass::text=ANY($1::text[])", [tables])).rows;
  for (const fk of fks) {
    const definition = fk.def.replace(/REFERENCES (?:public\.)?([a-z_]+)\(/g, (_, name) => `REFERENCES ${tables.includes(name) ? schema : 'public'}.${name}(`);
    await admin.query(`ALTER TABLE ${schema}.${fk.tbl} ADD CONSTRAINT ${fk.conname} ${definition}`);
  }
  await pool.query('INSERT INTO factions SELECT * FROM public.factions');
  const dbFile = require.resolve('../db');
  require.cache[dbFile] = { id: dbFile, filename: dbFile, loaded: true, exports: { pool, getSetting: async (_k, fallback) => fallback, getPPToGPRate: async () => 100, notifyPlayer: async () => {}, logGPActivity: async () => {} } };
  const daily = require('../services/daily');

  const fresh = await account();
  const first = await Promise.all(Array.from({ length: 12 }, () => daily.getDailyMissions(fresh)));
  assert.ok(first.every(list => list.length === 3));
  assert.equal((await rows(fresh)).length, 3);
  assert.ok(first.every(list => new Set(list.map(m => m.type)).size === 3 && list.every(m => !retired.has(m.type))));
  assert.ok(first.every(list => JSON.stringify(list) === JSON.stringify(first[0])));
  const freshSnapshot = await rows(fresh);
  await daily.getDailyMissions(fresh); assert.deepEqual(await rows(fresh), freshSnapshot);
  assert.deepEqual(await assets(fresh), { gp_balance: '0.000000', xp: 0 });
  checks.push('12 concurrent empty-board reads assign exactly three unique supported stable goals without rewards');

  const abandoned = await account();
  const old = [];
  for (const [i, type] of [...retired].entries()) old.push(await add(abandoned, i + 1, type, { gp: 13 + i * 10, xp: 6 + i }));
  await Promise.all([daily.getDailyMissions(abandoned), daily.getDailyMissions(abandoned)]);
  const replaced = await rows(abandoned);
  assert.deepEqual(replaced.map(r => r.mission_type), ['harvest','equip_cosmetic','enhance_item']);
  for (let i = 0; i < 3; i++) {
    assert.equal(replaced[i].id, old[i].id); assert.equal(replaced[i].slot, old[i].slot);
    assert.equal(replaced[i].reward_gp, old[i].reward_gp); assert.equal(replaced[i].reward_xp, old[i].reward_xp);
    assert.equal(replaced[i].target_value, 1); assert.equal(replaced[i].current_value, 0);
  }
  await daily.getDailyMissions(abandoned); assert.deepEqual(await rows(abandoned), replaced);
  const progressed = await daily.updateMissionProgress(abandoned, 'harvest', 1);
  assert.equal(progressed.completed, true); assert.equal(progressed.reward, 13);
  const claims = await Promise.all([daily.claimMissionReward(abandoned, old[0].id), daily.claimMissionReward(abandoned, old[0].id)]);
  assert.equal(claims.filter(r => r.success).length, 1); assert.deepEqual(await assets(abandoned), { gp_balance: '13.000000', xp: 6 });
  checks.push('retired zero-progress replacements keep ids, slots, exact GP/XP; supported event completes and duplicate claim pays once');

  const preserved = await account();
  await add(preserved, 1, 'view_weather', { completed: true, gp: 21 });
  await add(preserved, 2, 'explore_poi', { current: 1 });
  await add(preserved, 3, 'play_cantina', { completed: true, claimed: true });
  const before = await rows(preserved), rendered = await daily.getDailyMissions(preserved);
  assert.deepEqual(await rows(preserved), before);
  assert.equal(rendered[0].title, 'Storm Chaser'); assert.equal(rendered[2].title, 'Cantina Night');
  const claimed = await daily.claimMissionReward(preserved, before[0].id);
  assert.equal(claimed.rewardGP, 21); assert.equal(claimed.xpAwarded, 9);
  checks.push('completed, claimed and nonzero retired rows unchanged; historical definitions and stored reward claim retained');

  const mixed = await account();
  await add(mixed, 1, 'harvest', { current: 1, completed: true });
  const stale = await add(mixed, 2, 'view_weather', { target: 4, gp: 99, xp: 12 });
  await add(mixed, 3, 'equip_cosmetic', { completed: true, claimed: true });
  const mixedBefore = await rows(mixed); await daily.getDailyMissions(mixed); const mixedAfter = await rows(mixed);
  assert.deepEqual(mixedAfter[0], mixedBefore[0]); assert.deepEqual(mixedAfter[2], mixedBefore[2]);
  assert.equal(mixedAfter[1].id, stale.id); assert.equal(mixedAfter[1].mission_type, 'enhance_item');
  assert.equal(mixedAfter[1].target_value, 1); assert.equal(mixedAfter[1].reward_gp, '99.000000'); assert.equal(mixedAfter[1].reward_xp, 12);
  const partial = await account(); const existing = await add(partial, 2, 'build_ship', { current: 1, target: 2 });
  const filled = await daily.getDailyMissions(partial); assert.equal(filled.length, 3); assert.equal(new Set(filled.map(m => m.type)).size, 3);
  assert.deepEqual((await rows(partial)).find(r => r.id === existing.id), existing);
  checks.push('replacement chooses unused supported type, target one; supported rows and partial-board goals preserved');

  const racing = await account(); const weather = await add(racing, 1, 'view_weather');
  await add(racing, 2, 'harvest'); await add(racing, 3, 'build_ship');
  locker = await pool.connect(); await locker.query('BEGIN'); await locker.query('SELECT id FROM daily_missions WHERE id=$1 FOR UPDATE', [weather.id]);
  const progress = daily.updateMissionProgress(racing, 'view_weather', 1);
  pending = Promise.all([progress]);
  await waitForLock('%SELECT id FROM daily_missions%FOR UPDATE%');
  const read = daily.getDailyMissions(racing); pending = Promise.all([progress, read]);
  await waitForLock('%pg_advisory_xact_lock%');
  await locker.query('COMMIT'); locker.release(); locker = null;
  const raceResult = await pending; pending = null;
  assert.equal(raceResult[0].completed, true);
  const survived = (await rows(racing)).find(r => r.id === weather.id);
  assert.equal(survived.mission_type, 'view_weather'); assert.equal(survived.current_value, 1); assert.equal(survived.completed, true);
  assert.equal((await pool.query('SELECT COUNT(*)::int n FROM daily_logins')).rows[0].n, 0);
  checks.push('forced real row-lock progress vs reassignment race preserves completed goal; no login awards changed');

  singlePool = new pg.Pool({ connectionString: url.href, options: '-c search_path=' + schema + ',public', max: 1, connectionTimeoutMillis: 1000 });
  require.cache[dbFile].exports = { ...require.cache[dbFile].exports, pool: singlePool, getSetting: async () => { throw Error('Assignment must not request another pool connection through getSetting'); } };
  delete require.cache[require.resolve('../services/daily')];
  const singleDaily = require('../services/daily');
  const supported = ['harvest','equip_cosmetic','enhance_item','marketplace_trade','build_ship','win_naval_battle','claim_pixels','hijack'];
  for (const type of supported) {
    await pool.query('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value', ['daily_mission_' + type + '_reward_gp', JSON.stringify(27)]);
  }
  const limitedWallets = await Promise.all(Array.from({ length: 8 }, () => account()));
  const limitedBoards = await Promise.all(limitedWallets.map(wallet => singleDaily.getDailyMissions(wallet)));
  assert.ok(limitedBoards.every(board => board.length === 3 && board.every(m => m.reward === 27)));
  // JSONB strings decode to text; old text columns already return text directly.
  await pool.query('UPDATE settings SET value=$1', [JSON.stringify('31')]);
  const stringBoard = await singleDaily.getDailyMissions(await account());
  assert.ok(stringBoard.every(m => m.reward === 31));
  await pool.query('UPDATE settings SET value=$1', [JSON.stringify('')]);
  const fallbackBoard = await singleDaily.getDailyMissions(await account());
  assert.ok(fallbackBoard.every(m => m.reward > 0 && m.reward !== 27 && m.reward !== 31));
  await pool.query('ALTER TABLE settings ALTER COLUMN value DROP DEFAULT');
  await pool.query("ALTER TABLE settings ALTER COLUMN value TYPE text USING value #>> '{}'");
  await pool.query('UPDATE settings SET value=$1', ['35']);
  const oldTextBoard = await singleDaily.getDailyMissions(await account());
  assert.ok(oldTextBoard.every(m => m.reward === 35));
  checks.push('max-one pool assigns eight concurrent wallets with no getSetting call; JSONB numeric/string and older text overrides plus empty fallback retained');
  console.log(JSON.stringify({ passed: checks.length, checks, actualPostgreSQL: true, publicWrites: false, schema }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (locker) { await locker.query('ROLLBACK'); locker.release(); }
  if (pending) await pending.catch(() => {});
  if (singlePool) await singlePool.end();
  await pool.end(); await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); await admin.end();
});

#!/usr/bin/env node
'use strict';
// Disposable PostgreSQL + actual NPC and marketplace services, no app bootstrap.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const net = require('node:net');
const crypto = require('node:crypto');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const name of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(name), 'Unexpected environment key: ' + name);
const pgBin = '/opt/homebrew/opt/postgresql@16/bin';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-npc-'));
fs.chmodSync(dir, 0o700);
const dataDir = path.join(dir, 'db'), socketDir = path.join(dir, 's');
fs.mkdirSync(socketDir, { mode: 0o700 });
const port = 55447, pgSocket = path.join(socketDir, '.s.PGSQL.' + port);
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const inject = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
const results = [];
const pass = (name, details) => { results.push({ name, details }); console.log('PASS ' + name + (details ? ': ' + JSON.stringify(details) : '')); };
let pool, started = false;
const random = Math.random;

function installBoundary() {
  function target(args) { const a = args[0]; return Array.isArray(a) ? target(a) : typeof a === 'string' ? a : a?.path; }
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) { assert.equal(target(args), pgSocket, 'ONLY_FIXTURE_UNIX_SOCKET'); return connect.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
  net.Server.prototype.listen = deny;
  require('node:tls').connect = deny;
  const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny;
  dns.promises.lookup = deny; dns.promises.resolve = deny; global.fetch = deny;
  const load = Module._load;
  Module._load = function (request, ...args) {
    if (['dotenv', 'ioredis', 'nodemailer', 'ethers'].includes(String(request).split('/')[0])) throw Error('FORBIDDEN_DEPENDENCY:' + request);
    return load.call(this, request, ...args);
  };
  const read = fs.readFileSync;
  fs.readFileSync = function (file, ...args) {
    assert.ok(!path.basename(String(file)).startsWith('.env') && !['.pgpass', 'credentials'].includes(path.basename(String(file))), 'NO_CREDENTIAL_READS');
    return read.call(this, file, ...args);
  };
}

const schema = `
CREATE TABLE schema_migrations(filename text PRIMARY KEY);
CREATE TABLE users(wallet_address text PRIMARY KEY,gp_balance numeric DEFAULT 0,is_ai boolean DEFAULT false);
CREATE TABLE settings(key text PRIMARY KEY,value text);
CREATE TABLE resources(id serial PRIMARY KEY,code text UNIQUE,name_en text,icon_emoji text,rarity text DEFAULT 'common',is_active boolean DEFAULT true,is_tradeable boolean DEFAULT true);
CREATE TABLE user_resource_inventory(wallet_address text REFERENCES users,resource_id integer REFERENCES resources,quantity integer NOT NULL CHECK(quantity>=0),updated_at timestamptz DEFAULT now(),PRIMARY KEY(wallet_address,resource_id));
CREATE TABLE pixels(owner text,claim_id integer,sector_id integer);
CREATE TABLE marketplace_listings(id serial PRIMARY KEY,seller text REFERENCES users,listing_type text,item_instance_id integer,claim_id integer,resource_code text,resource_quantity integer,price numeric,currency text,status text DEFAULT 'active',expires_at timestamptz,meta jsonb,sector_id integer);
CREATE TABLE transactions(id serial PRIMARY KEY,type text,from_wallet text,pp_amount numeric,fee numeric,meta jsonb);
INSERT INTO users VALUES('legacy_npc',17,true),('human',8,false);
INSERT INTO resources(code,name_en) VALUES('iron_ore','Iron'),('carbon_fiber','Carbon'),('silicon_chip','Silicon'),('titanium_alloy','Titanium'),('plasma_crystal','Plasma');
INSERT INTO user_resource_inventory SELECT 'legacy_npc',id,3 FROM resources WHERE code='iron_ore';
INSERT INTO settings VALUES('npc_economy_enabled','true'),('npc_market_target_listings','1000'),('npc_market_per_tick','1'),('marketplace_max_active_listings','1000'),('marketplace_listing_fee_gp','2');
`;

async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', dataDir, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=npc_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(dataDir, 'postgresql.conf'), "\nlisten_addresses = ''\nport = " + port + "\nunix_socket_directories = '" + socketDir + "'\n");
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', dataDir, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' });
    started = true;
    installBoundary();
    const { Pool } = require('pg');
    pool = new Pool({ host: socketDir, port, user: 'npc_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, max: 16, connectionTimeoutMillis: 3000, statement_timeout: 8000, query_timeout: 9000 });
    await pool.query(schema);
    const noop = async () => {};
    const getSetting = async key => (await pool.query('SELECT value FROM settings WHERE key=$1', [key])).rows[0]?.value;
    inject('../db', { pool, getSetting, logGPActivity: noop });
    inject('../services/job', { getJobBuff: async (_wallet, _key, fallback) => fallback });
    inject('../services/resource', {});
    inject('../routes/dailyOps', { notifyMissionProgress: noop });
    const npc = require('../services/npcEconomy');
    const scalar = async (sql, args = []) => Number(Object.values((await pool.query(sql, args)).rows[0])[0]);
    const gp = wallet => scalar('SELECT gp_balance FROM users WHERE wallet_address=$1', [wallet]);
    const quantity = wallet => scalar('SELECT COALESCE(SUM(quantity),0) FROM user_resource_inventory WHERE wallet_address=$1', [wallet]);
    const count = wallet => scalar('SELECT COUNT(*) FROM marketplace_listings WHERE seller=$1', [wallet]);
    const ledger = async wallet => (await pool.query('SELECT * FROM npc_economy_seed_ledger WHERE wallet_address=$1', [wallet])).rows[0];
    const only = wallet => pool.query('UPDATE users SET is_ai = (wallet_address=$1)', [wallet]);
    Math.random = () => 0;

    assert.equal((await npc.runMarketTick()).created, 0);
    assert.equal(await gp('legacy_npc'), 17); assert.equal(await quantity('legacy_npc'), 3);
    pass('missing migration prevents issuance and listing');
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/354_npc_seed_budget.sql'), 'utf8');
    const client = await pool.connect();
    try { await client.query('BEGIN'); await client.query(migration); await client.query('COMMIT'); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    assert.equal((await ledger('legacy_npc')).seed_kind, 'legacy_existing');
    assert.equal((await ledger('legacy_npc')).gp_issued, '0');
    assert.deepEqual((await ledger('legacy_npc')).resources_issued, {});
    assert.equal((await npc.runMarketTick()).created, 0);
    assert.equal(await gp('legacy_npc'), 17); assert.equal(await quantity('legacy_npc'), 3);
    pass('migration legacy backfill issues zero and exhausted legacy inventory stays unchanged');

    await pool.query("INSERT INTO users VALUES('new_npc',0,true)"); await only('new_npc');
    assert.equal((await npc.runMarketTick()).created, 1);
    assert.equal(await gp('new_npc'), 198); assert.equal(await quantity('new_npc'), 190);
    const initialLedger = await ledger('new_npc');
    assert.equal(initialLedger.gp_issued, '200'); assert.equal(initialLedger.seed_kind, 'initial_seed');
    assert.deepEqual(initialLedger.resources_issued, { iron_ore: 40, carbon_fiber: 40, silicon_chip: 40, titanium_alloy: 40, plasma_crystal: 40 });
    assert.equal(await scalar("SELECT price FROM marketplace_listings WHERE seller='new_npc'"), 6);
    for (let i = 0; i < 8; i++) await npc.runMarketTick();
    assert.equal(await count('new_npc'), 4); assert.equal(await quantity('new_npc'), 160);
    assert.deepEqual(await ledger('new_npc'), initialLedger);
    for (let resource = 1; resource < 5; resource++) {
      Math.random = () => (resource + 0.01) / 5;
      for (let i = 0; i < 6; i++) await npc.runMarketTick();
    }
    assert.equal(await count('new_npc'), 20); assert.equal(await quantity('new_npc'), 0);
    assert.equal(await gp('new_npc'), 135);
    assert.equal(await scalar("SELECT SUM(resource_quantity) FROM marketplace_listings WHERE seller='new_npc'"), 200);
    assert.deepEqual(await ledger('new_npc'), initialLedger);
    pass('repeated ticks exhaust finite seed: 200 GP / 200 resources issued once, 20 listings / 65 GP fees', { gp: await gp('new_npc'), inventory: await quantity('new_npc'), listings: await count('new_npc') });

    Math.random = () => 0;
    await pool.query("INSERT INTO users VALUES('race_npc',0,true)"); await only('race_npc');
    const concurrent = await Promise.all(Array.from({ length: 12 }, () => npc.runMarketTick()));
    assert.equal(concurrent.reduce((sum, tick) => sum + tick.created, 0), 4);
    assert.equal(await count('race_npc'), 4); assert.equal(await gp('race_npc'), 192); assert.equal(await quantity('race_npc'), 160);
    assert.equal(await scalar("SELECT COUNT(*) FROM npc_economy_seed_ledger WHERE wallet_address='race_npc'"), 1);
    assert.equal((await ledger('race_npc')).gp_issued, '200');
    pass('12 concurrent actual transactions seed once and escrow only four iron lots');

    await pool.query("INSERT INTO users VALUES('rollback_npc',0,true)"); await only('rollback_npc');
    await pool.query("CREATE FUNCTION reject_fixture_listing() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.seller='rollback_npc' THEN RAISE EXCEPTION 'fixture forced insert failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_fixture_listing BEFORE INSERT ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION reject_fixture_listing()");
    assert.equal((await npc.runMarketTick()).created, 0);
    assert.equal(await gp('rollback_npc'), 0); assert.equal(await quantity('rollback_npc'), 0); assert.equal(await ledger('rollback_npc'), undefined);
    assert.equal(await scalar("SELECT COUNT(*) FROM transactions WHERE from_wallet='rollback_npc'"), 0);
    await pool.query('DROP TRIGGER reject_fixture_listing ON marketplace_listings');
    assert.equal((await npc.runMarketTick()).created, 1);
    pass('failed real listing INSERT rolls back seed, fee, inventory and ledger; retry then succeeds once');

    await pool.query("INSERT INTO users VALUES('partial_npc',199.25,true)");
    await pool.query("INSERT INTO user_resource_inventory SELECT 'partial_npc',id,CASE WHEN code='iron_ore' THEN 50 ELSE 39 END,NOW() FROM resources");
    await only('partial_npc'); assert.equal((await npc.runMarketTick()).created, 1);
    assert.equal((await ledger('partial_npc')).gp_issued, '0.75');
    assert.deepEqual((await ledger('partial_npc')).resources_issued, { iron_ore: 0, carbon_fiber: 1, silicon_chip: 1, titanium_alloy: 1, plasma_crystal: 1 });
    pass('audit stores actual fractional GP and resource deltas without reducing existing surplus');

    await only('human'); await pool.query("UPDATE users SET is_ai=false WHERE wallet_address='human'");
    assert.equal((await npc.runMarketTick()).created, 0); assert.equal(await gp('human'), 8); assert.equal(await quantity('human'), 0); assert.equal(await ledger('human'), undefined);
    await pool.query("INSERT INTO users VALUES('duplicate_npc',0,true),('DUPLICATE_NPC',3,false)");
    await only('duplicate_npc'); assert.equal((await npc.runMarketTick()).created, 0);
    assert.equal(await gp('duplicate_npc'), 0); assert.equal(await ledger('duplicate_npc'), undefined);
    pass('human and duplicate normalized ownership cannot receive seed');

    await pool.query("INSERT INTO users VALUES('invalid_npc',-1,true)"); await only('invalid_npc');
    for (const balance of ['-1', 'NaN', null]) {
      await pool.query("UPDATE users SET gp_balance=$1 WHERE wallet_address='invalid_npc'", [balance]);
      assert.equal((await npc.runMarketTick()).created, 0); assert.equal(await ledger('invalid_npc'), undefined);
    }
    await pool.query("UPDATE users SET gp_balance=0 WHERE wallet_address='invalid_npc'");
    // Deliberately weaken only this fixture schema to prove corrupt inventory is rejected.
    await pool.query('ALTER TABLE user_resource_inventory DROP CONSTRAINT user_resource_inventory_quantity_check; ALTER TABLE user_resource_inventory ALTER COLUMN quantity DROP NOT NULL');
    await pool.query("INSERT INTO user_resource_inventory SELECT 'invalid_npc',id,-1,NOW() FROM resources WHERE code='iron_ore'");
    for (const quantity of [-1, null]) {
      await pool.query("UPDATE user_resource_inventory SET quantity=$1 WHERE wallet_address='invalid_npc'", [quantity]);
      assert.equal((await npc.runMarketTick()).created, 0); assert.equal(await gp('invalid_npc'), 0); assert.equal(await ledger('invalid_npc'), undefined);
    }
    pass('negative / NaN / null GP and negative / null inventory fail closed without erasing debt');

    await only('race_npc');
    await pool.query("DELETE FROM marketplace_listings WHERE seller='race_npc'; DELETE FROM user_resource_inventory WHERE wallet_address='race_npc'; DELETE FROM users WHERE wallet_address='race_npc'; INSERT INTO users VALUES('race_npc',0,true)");
    assert.equal((await npc.runMarketTick()).created, 0); assert.equal(await gp('race_npc'), 0); assert.equal(await quantity('race_npc'), 0);
    pass('deleting and recreating the same identity cannot reset its allowance');

    const hashes = Object.fromEntries(['../services/npcEconomy.js', '../services/marketplace.js', '../migrations/354_npc_seed_budget.sql', 'npc_economy_isolated_regression.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
    console.log(JSON.stringify({ result: 'passed', checks: results.length, sources: hashes, actualMarketplaceListing: true, database: 'fresh private PostgreSQL 16 / Unix socket only' }, null, 2));
  } finally {
    Math.random = random;
    if (pool) await pool.end();
    if (started) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('CLEANUP temporary PostgreSQL cluster removed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

#!/usr/bin/env node
'use strict';
// Actual claim/onboarding HTTP handlers in a fresh private PostgreSQL fixture.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const net = require('node:net'), http = require('node:http'), crypto = require('node:crypto'), Module = require('node:module');
const { execFileSync } = require('node:child_process');
assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const key of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(key), 'UNEXPECTED_ENVIRONMENT:' + key);
const root = path.resolve(__dirname, '../..'), pgBin = '/opt/homebrew/opt/postgresql@16/bin';
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-onboarding-')); fs.chmodSync(dir, 0o700);
const data = path.join(dir, 'db'), socket = path.join(dir, 's'), port = 55455; fs.mkdirSync(socket, { mode: 0o700 });
const pgSocket = path.join(socket, '.s.PGSQL.' + port), httpSocket = path.join(dir, 'http.sock');
const baseline = process.argv.includes('--baseline-source');
const baselineShield = process.argv.includes('--baseline-shield');
const baselineAccounting = process.argv.includes('--baseline-accounting');
const hashes = {}, read = file => { const value = fs.readFileSync(path.join(root, file), 'utf8'); hashes[file] = crypto.createHash('sha256').update(value).digest('hex'); return value; };
const inject = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
let pool, inspector, server, started = false, checks = 0;
const pass = (name, details) => { checks++; console.log('PASS ' + name + (details ? ': ' + JSON.stringify(details) : '')); };
function boundary() {
  const target = args => Array.isArray(args[0]) ? target(args[0]) : typeof args[0] === 'string' ? args[0] : args[0]?.path;
  const connect = net.Socket.prototype.connect, listen = net.Server.prototype.listen;
  net.Socket.prototype.connect = function (...args) { assert.ok([pgSocket, httpSocket].includes(target(args)), 'ONLY_PRIVATE_UNIX_SOCKETS'); return connect.apply(this, args); };
  net.Server.prototype.listen = function (...args) { assert.equal(target(args), httpSocket); return listen.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
  require('node:tls').connect = deny; const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny; dns.promises.lookup = deny; dns.promises.resolve = deny; global.fetch = deny;
  const load = Module._load;
  Module._load = function (request, ...args) { if (['dotenv', 'ioredis', 'ethers', 'nodemailer'].includes(String(request).split('/')[0])) throw Error('FORBIDDEN_DEPENDENCY:' + request); return load.call(this, request, ...args); };
  const readFile = fs.readFileSync;
  fs.readFileSync = function (file, ...args) { assert.ok(!path.basename(String(file)).startsWith('.env') && !['.pgpass', 'credentials'].includes(path.basename(String(file))), 'NO_CREDENTIAL_READS'); return readFile.call(this, file, ...args); };
}
const schema = `
CREATE TABLE schema_migrations(filename text PRIMARY KEY);
CREATE TABLE settings(key text PRIMARY KEY,value jsonb,description text);
CREATE TABLE users(wallet_address varchar(42) PRIMARY KEY,nickname text,gp_balance numeric DEFAULT 0,pp_balance numeric DEFAULT 0,usdt_balance numeric DEFAULT 0,rank_level integer DEFAULT 1,xp integer DEFAULT 0,settings jsonb DEFAULT '{}');
CREATE TABLE jobs(code varchar(20) PRIMARY KEY,name_ko text,icon_emoji text);
INSERT INTO jobs VALUES('miner','광부','pick');
CREATE TABLE sectors(id integer PRIMARY KEY,tier text,bounds_polygon jsonb,lat_min numeric,lat_max numeric,lng_min numeric,lng_max numeric,base_price numeric);
INSERT INTO sectors VALUES(1,'frontier',NULL,-70,70,-180,180,0.02);
CREATE TABLE claims(id serial PRIMARY KEY,owner text,center_lat numeric,center_lng numeric,width integer,height integer,image_url text,original_image_url text,link_url text,total_paid numeric,claimed_at timestamptz DEFAULT NOW(),deleted_at timestamptz);
CREATE TABLE pixels(lat numeric,lng numeric,owner text,price numeric,claim_id integer,sector_id integer,updated_at timestamptz,PRIMARY KEY(lat,lng));
CREATE TABLE transactions(id serial PRIMARY KEY,type text,from_wallet text,usdt_amount numeric,pp_amount numeric,fee numeric,meta jsonb);
CREATE TABLE user_active_effects(id serial PRIMARY KEY,wallet text,effect_type text,active boolean,uses_remaining integer,expires_at timestamptz,effect_value numeric);
ALTER TABLE sectors ADD COLUMN tax_rate numeric DEFAULT 2, ADD COLUMN buff_fund_gp numeric DEFAULT 0;
CREATE TABLE governance_positions(role text,sector_id integer,gp_balance numeric DEFAULT 0);
INSERT INTO governance_positions VALUES('governor',1,0),('vice_governor',1,0);
CREATE TABLE commander(id integer PRIMARY KEY,commander_pool_gp numeric DEFAULT 0);
INSERT INTO commander VALUES(1,0);
CREATE TABLE governance_transactions(id serial PRIMARY KEY,type text,from_role text,to_role text,sector_id integer,wallet text,gp_amount numeric,meta jsonb);
CREATE TABLE user_titles(user_wallet text,title_code text,title_ko text,title_en text,is_equipped boolean,PRIMARY KEY(user_wallet,title_code));
CREATE TABLE item_types(id serial PRIMARY KEY,code text);
CREATE TABLE user_items(wallet text,item_type_id integer,quantity integer,PRIMARY KEY(wallet,item_type_id));
`;
async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', data, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=onboarding_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(data, 'postgresql.conf'), "\nlisten_addresses=''\nport=" + port + "\nunix_socket_directories='" + socket + "'\n");
    execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' }); started = true; boundary();
    const { Pool } = require('pg');
    const config = { host: socket, port, user: 'onboarding_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, statement_timeout: 6000, query_timeout: 7000 };
    pool = new Pool({ ...config, max: 8, application_name: 'onboarding_fixture' }); inspector = new Pool({ ...config, max: 1, application_name: 'onboarding_inspector' });
    await pool.query(schema); await pool.query(read('server/migrations/083_onboarding_tutorial.sql'));
    await pool.query("INSERT INTO item_types(code) VALUES('shield_basic')");
    // Existing authored reward profile220/224, fixture only. No new policy/grant.
    await pool.query("UPDATE settings SET value='0.5' WHERE key='onboarding_pp_reward'; UPDATE settings SET value='75' WHERE key='onboarding_gp_reward'");
    await pool.query("INSERT INTO settings VALUES('price_pixel_frontier','0.02','fixture source price'),('referral_enabled','false','fixture no referrers')");
    const make = async (name, state) => {
      await pool.query('INSERT INTO users(wallet_address,nickname) VALUES($1,$2)', [name, name]);
      if (state) await pool.query('INSERT INTO user_onboarding(wallet_address,current_step,completed,skipped,reward_claimed) VALUES($1,$2,$3,$4,$5)', [name, state.step ?? 2, state.completed ?? false, state.skipped ?? false, state.reward_claimed ?? false]);
      return name;
    };
    const fresh = await make('fixture_fresh');
    const legacy = await make('fixture_legacy_paid', { step: 5, reward_claimed: true });
    const dbSource = read('server/db.js');
    const ensureUserSource = dbSource.slice(dbSource.indexOf('async function ensureUser('), dbSource.indexOf('// ── Helper: get all settings'));
    const realEnsureUser = new Function('return (' + ensureUserSource.trim() + ')')();
    const db = { pool, getSetting: async (key, fallback) => (await pool.query("SELECT value #>> '{}' AS v FROM settings WHERE key=$1", [key])).rows[0]?.v ?? fallback,
      getSettings: async () => Object.fromEntries((await pool.query('SELECT key,value FROM settings')).rows.map(row => [row.key,row.value])),
      getPPToGPRate: async () => 10, ensureUser: realEnsureUser,
      awardXP: async () => null, getReferralChain: async () => [], creditReferralCommission: async () => [], notifyPlayer: async () => {} };
    inject('../db', db);
    // Explicitly isolate unrelated domain collaborators; claim and onboarding SQL stay real.
    const currentApiSource = read('server/routes/api.js');
    const apiSource = baselineAccounting ? execFileSync('/usr/bin/git', ['show', 'ece190793a2b0422880efd7721295581bdd16620'], { cwd: root, env: childEnv, encoding: 'utf8' }) : currentApiSource;
    for (const match of apiSource.matchAll(/require\('\.\.\/services\/([^']+)'\)/g)) if (match[1] !== 'onboarding' && fs.existsSync(path.join(root, 'server/services', match[1] + '.js'))) inject('../services/' + match[1], null);
    inject('../services/titleExtended', null);
    const governanceFile = require.resolve('../services/governance');
    const governanceMod = new Module(governanceFile, module); governanceMod.filename = governanceFile; governanceMod.paths = Module._nodeModulePaths(path.dirname(governanceFile)); governanceMod._compile(read('server/services/governance.js'), governanceFile);
    const taxCalls = [];
    inject('../services/governance', { recalculateGovernor: async () => ({ changed: false }), recalculateCommander: async () => ({ changed: false }), collectTax: async (...args) => { taxCalls.push(args.slice(1)); return governanceMod.exports.collectTax(...args); }, getActiveSectorBuffs: async () => [], hasActiveEvent: async () => false });
    inject('../services/sector', { checkEntryRequirementBySectorId: async () => ({ allowed: true }) });
    inject('../services/playerJourney', { getPlayerJourney: async () => ({ step: 0, verifiedFixtureJourney: true }) });
    inject('../utils/settingsCache', { cfg: async () => Object.fromEntries((await pool.query('SELECT key,value FROM settings')).rows.map(row => [row.key, row.value])) });
    const onboardFile = require.resolve('../services/onboarding');
    const onboardSource = (baseline || baselineShield) ? execFileSync('/usr/bin/git', ['show', '691e1e0ec266657850e4ae1cfe64bb256a04772e'], { cwd: root, env: childEnv, encoding: 'utf8' }) : read('server/services/onboarding.js');
    const mod = new Module(onboardFile, module); mod.filename = onboardFile; mod.paths = Module._nodeModulePaths(path.dirname(onboardFile)); mod._compile(onboardSource, onboardFile);
    const onboarding = mod.exports; inject('../services/onboarding', onboarding);
    process.env.JWT_SECRET = 'public-local-only-onboarding-schema-fixture';
    const express = require('express'), jwt = require('jsonwebtoken'), app = express(); app.use(express.json());
    app.use((req, _res, next) => { Object.defineProperty(req, 'ip', { value: '127.0.0.1' }); next(); });
    const apiFile = require.resolve('../routes/api'), apiMod = new Module(apiFile, module); apiMod.filename = apiFile; apiMod.paths = Module._nodeModulePaths(path.dirname(apiFile));
    // Observe arguments while executing the existing quest-pool no-op unchanged.
    apiMod._compile(apiSource + '\nmodule.exports.__fixturePoolAmounts = []; const fixtureOriginalFund = fundQuestPool; fundQuestPool = async (client, amount) => { module.exports.__fixturePoolAmounts.push(amount); return fixtureOriginalFund(client, amount); };', apiFile);
    app.use('/api', require('../routes/playerStatusRoutes')); app.use('/api/onboarding', require('../routes/onboardingRoutes')); app.use('/api', apiMod.exports);
    server = http.createServer(app); await new Promise(resolve => server.listen(httpSocket, resolve));
    const request = (method, route, wallet, body) => new Promise((resolve, reject) => {
      const payload = body == null ? null : JSON.stringify(body);
      const req = http.request({ socketPath: httpSocket, path: '/api' + route, method, headers: { authorization: 'Bearer ' + jwt.sign({ wallet_address: wallet }, process.env.JWT_SECRET, { expiresIn: '5m' }), ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}) } }, res => { let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; }); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(text) }); } catch (error) { reject(error); } }); });
      req.on('error', reject); req.setTimeout(8000, () => req.destroy(Error('FIXTURE_TIMEOUT'))); if (payload) req.write(payload); req.end();
    });
    const claim = (wallet, lng, width = 5, height = 5, expectedTutorialFree) => request('POST', '/claim', wallet, { lat: 0, lng, width, height, payMethod: 'pp', ...(expectedTutorialFree == null ? {} : { expectedTutorialFree }) });
    const balance = async wallet => (await pool.query('SELECT gp_balance,pp_balance,usdt_balance FROM users WHERE wallet_address=$1', [wallet])).rows[0];
    const idle = async () => (await inspector.query("SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE application_name='onboarding_fixture' AND state='idle in transaction'")).rows[0].n;
    const rollbackLeaked = async () => { const clients = await Promise.all(Array.from({ length: pool.totalCount }, () => pool.connect())); for (const client of clients) { await client.query('ROLLBACK'); client.release(); } };

    const offer = await request('GET', '/onboarding/status', fresh); assert.equal(offer.body.firstClaim.eligible, true); assert.equal(offer.body.firstClaim.maxPixels, 25);
    await assert.rejects(onboarding.getOnboardingState(fresh), error => error.code === '42703');
    const failure = await claim(fresh, 0); assert.equal(failure.status, 400); assert.equal(failure.body.required, 0.5); assert.equal((await balance(fresh)).pp_balance, '0');
    pass('083 schema reproduces eligible25px UI offer but actual PP0 first claim fails requiring0.5 due42703');
    const before = JSON.stringify((await pool.query('SELECT * FROM user_onboarding ORDER BY id')).rows), oldBalances = JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows);
    const migration = read('server/migrations/362_onboarding_service_compatibility.sql'), c = await pool.connect();
    try { await c.query('BEGIN'); await c.query(migration); await c.query('COMMIT'); } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
    const after = (await pool.query('SELECT * FROM user_onboarding ORDER BY id')).rows;
    assert.equal(JSON.stringify(after.map(({ job_selected, pp_rewarded, shield_given, gp_rewarded, title_given, ...row }) => row)), before);
    assert.equal(JSON.stringify((await pool.query('SELECT * FROM users ORDER BY wallet_address')).rows), oldBalances);
    assert.ok(after.every(row => row.job_selected === null && !row.pp_rewarded && !row.shield_given && !row.gp_rewarded && !row.title_given));
    pass('362 adds exactly missing service fields without guessing old job/reward history or changing balances');
    if (baselineShield) {
      const wallet = await make('fixture_phantom_shield', { step: 3 });
      const response = await request('POST', '/onboarding/step', wallet, { step: 3 }); assert.equal(response.status, 200); assert.equal(response.body.success, true); assert.equal(response.body.rewards[0].code, 'basic_shield');
      assert.equal((await pool.query('SELECT shield_given FROM user_onboarding WHERE wallet_address=$1', [wallet])).rows[0].shield_given, true); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM user_items WHERE wallet=$1', [wallet])).rows[0].n, 0);
      pass('BUG REPRODUCED: missing basic_shield reports reward success and consumes shield_given with no inventory'); return;
    }

    await pool.query("UPDATE settings SET value='false' WHERE key='onboarding_enabled'");
    const disabled = await make('fixture_disabled_new'); const disabledClaim = await claim(disabled, 10);
    assert.equal(disabledClaim.status, baseline ? 200 : 400, JSON.stringify(disabledClaim));
    if (baseline) assert.equal(disabledClaim.body.tutorialFreeClaim, true);
    else assert.equal(disabledClaim.body.required, 0.5);
    pass(baseline ? 'BUG REPRODUCED: missing row ignores disabled setting and receives a free claim' : 'disabled onboarding with no existing row is honored by actual claim and status');
    await pool.query("UPDATE settings SET value='true' WHERE key='onboarding_enabled'");

    const legacyBefore = await balance(legacy);
    const legacyStep = await request('POST', '/onboarding/step', legacy, { step: 5 }); assert.equal(legacyStep.status, 200, JSON.stringify(legacyStep));
    const legacyAfter = await balance(legacy);
    assert.equal(Number(legacyAfter.gp_balance) - Number(legacyBefore.gp_balance), baseline ? 75 : 0);
    const paidMarker = (await pool.query('SELECT reward_claimed,completed FROM user_onboarding WHERE wallet_address=$1', [legacy])).rows[0]; assert.equal(paidMarker.reward_claimed, true); assert.equal(paidMarker.completed, true);
    await onboarding.completeStep(legacy, 5);
    assert.equal(await idle(), baseline ? 1 : 0);
    if (baseline) await rollbackLeaked();
    pass(baseline ? 'BUG REPRODUCED: reward_claimed=true final retry pays75GP again; already-done returns leakBEGIN' : 'legacy reward_claimed prevents duplicate final GP; already-done closes its transaction');
    if (baseline) return;

    const taxState = async () => (await pool.query("SELECT (SELECT COALESCE(SUM(gp_balance),0) FROM governance_positions) + (SELECT COALESCE(SUM(buff_fund_gp),0) FROM sectors) + (SELECT COALESCE(SUM(commander_pool_gp),0) FROM commander) AS total, (SELECT COUNT(*)::int FROM governance_transactions) AS records")).rows[0];
    const freeTaxBefore = await taxState(), freeCallCount = taxCalls.length;
    const first = await claim(fresh, 0); assert.equal(first.status, 200, JSON.stringify(first)); assert.equal(first.body.tutorialFreeClaim, true); assert.equal(first.body.newCount, 25); assert.equal(first.body.ppUsed, 0); assert.equal(first.body.usdtUsed, 0);
    assert.equal(first.body.totalCost, baselineAccounting ? 0.5 : 0); assert.equal(first.body.totalTax, baselineAccounting ? 0.01 : 0);
    if (!baselineAccounting) assert.equal(first.body.nominalCost, 0.5);
    const freeClaim = (await pool.query('SELECT total_paid FROM claims WHERE id=$1', [first.body.claimId])).rows[0]; assert.equal(Number(freeClaim.total_paid), baselineAccounting ? 0.5 : 0);
    const amount = (actual, expected) => expected === 0 ? assert.equal(Number(actual), 0) : assert.ok(Math.abs(Number(actual)-expected) < 1e-9, String(actual)+' vs '+expected);
    const freeTx = (await pool.query('SELECT fee,pp_amount,usdt_amount FROM transactions WHERE from_wallet=$1', [fresh])).rows[0]; amount(freeTx.fee, baselineAccounting ? 0.5 : 0); assert.equal(Number(freeTx.pp_amount), 0); assert.equal(Number(freeTx.usdt_amount), 0);
    amount(apiMod.exports.__fixturePoolAmounts.at(-1), baselineAccounting ? 0.5 : 0);
    const freeTaxAfter = await taxState(); assert.equal(Number(freeTaxAfter.total)-Number(freeTaxBefore.total), baselineAccounting ? 0.01 : 0); assert.equal(freeTaxAfter.records-freeTaxBefore.records, baselineAccounting ? 2 : 0); assert.equal(taxCalls.length-freeCallCount, baselineAccounting ? 1 : 0);
    assert.ok((await pool.query('SELECT price FROM pixels WHERE claim_id=$1', [first.body.claimId])).rows.every(row => Number(row.price) === 0.02));
    assert.equal((await request('GET', '/onboarding/status', fresh)).body.firstClaim.eligible, false);
    const second = await claim(fresh, 20); assert.equal(second.status, 400); assert.equal(second.body.required, 0.5);
    await pool.query('UPDATE users SET pp_balance=0.5 WHERE wallet_address=$1', [fresh]);
    const paidTaxBefore = await taxState(), paidCallCount = taxCalls.length;
    const paid = await claim(fresh, 20); assert.equal(paid.status, 200, JSON.stringify(paid)); assert.equal(paid.body.tutorialFreeClaim, false); assert.equal(paid.body.ppUsed, 0.5);
    assert.equal((await balance(fresh)).pp_balance, '0.0');
    assert.equal(paid.body.totalCost, 0.5); assert.equal(paid.body.totalTax, 0.01); assert.equal('nominalCost' in paid.body, false);
    assert.equal(Number((await pool.query('SELECT total_paid FROM claims WHERE id=$1', [paid.body.claimId])).rows[0].total_paid), 0.5);
    const paidTx = (await pool.query('SELECT fee,pp_amount FROM transactions WHERE from_wallet=$1 ORDER BY id DESC LIMIT 1', [fresh])).rows[0]; amount(paidTx.fee, 0.5); assert.equal(Number(paidTx.pp_amount), 0.5);
    amount(apiMod.exports.__fixturePoolAmounts.at(-1), 0.5); const paidTaxAfter = await taxState(); assert.ok(Math.abs(Number(paidTaxAfter.total)-Number(paidTaxBefore.total)-0.01) < 1e-9); assert.equal(paidTaxAfter.records-paidTaxBefore.records, 2); assert.equal(taxCalls.length-paidCallCount, 1);
    pass('actual PP0 first25px claim succeeds free once; second claim requires and charges original0.5PP');
    pass(baselineAccounting ? 'BUG REPRODUCED: free claim fabricates0.5paid/fee/pool-base and0.01governanceGP; paid comparator unchanged' : 'free paid-volume/fee/pool-base/tax all0 with0.02pixelreference intact; paid0.5claim still fee0.5 and realgovernanceGP0.01');
    if (baselineAccounting) return;

    for (const [name, state] of [['skipped', { skipped: true }], ['completed', { completed: true }]]) {
      const wallet = await make('fixture_' + name, state); const result = await claim(wallet, name === 'skipped' ? 30 : 40); assert.equal(result.status, 400); assert.equal(result.body.required, 0.5);
      assert.equal((await request('GET', '/onboarding/status', wallet)).body.firstClaim.eligible, false);
    }
    const owned = await make('fixture_already_owned'); await pool.query('INSERT INTO claims(owner,width,height) VALUES($1,1,1)', [owned]); assert.equal((await claim(owned, 50)).status, 400);
    const large = await make('fixture_oversize'); assert.equal((await claim(large, 60, 6, 5)).status, 400); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM claims WHERE owner=$1', [large])).rows[0].n, 0);
    const freeDisabled = await make('fixture_free_disabled'); await pool.query("UPDATE settings SET value='false' WHERE key='onboarding_free_claim_enabled'"); assert.equal((await claim(freeDisabled, 70)).status, 400); await pool.query("UPDATE settings SET value='true' WHERE key='onboarding_free_claim_enabled'");
    pass('skipped/completed/already-owned/oversize/free-disabled claims are not free and create no unintended claim');

    const sync = await make('fixture_step2', { step: 2 }); const synced = await claim(sync, 80); assert.equal(synced.status, 200, JSON.stringify(synced));
    const syncedRow = (await pool.query('SELECT current_step,tutorial_claim_id,pp_rewarded FROM user_onboarding WHERE wallet_address=$1', [sync])).rows[0]; assert.equal(syncedRow.current_step, 3); assert.equal(syncedRow.tutorial_claim_id, synced.body.claimId); assert.equal(syncedRow.pp_rewarded, true); assert.equal(Number((await balance(sync)).gp_balance), 5);
    await onboarding.completeStep(sync, 2, { claim_id: synced.body.claimId }); assert.equal(Number((await balance(sync)).gp_balance), 5); assert.equal(await idle(), 0);
    pass('first claim at existing step2 syncs claim ID/step3 and existing5GP equivalent once; earlier-step return closesBEGIN');
    const final = await make('fixture_final_new', { step: 5 }); const finals = await Promise.all([onboarding.completeStep(final, 5), onboarding.completeStep(final, 5)]); assert.equal(Number((await balance(final)).gp_balance), 75); assert.equal(finals.filter(result => result.rewards?.some(reward => reward.type === 'gp')).length, 1); assert.equal(await idle(), 0);
    const snapshot = JSON.stringify((await pool.query('SELECT * FROM user_onboarding ORDER BY id')).rows); await pool.query(migration); assert.equal(JSON.stringify((await pool.query('SELECT * FROM user_onboarding ORDER BY id')).rows), snapshot);
    pass('new qualified final completion keeps75GP once under concurrency; repeat migration preserves all metadata');

    const race = await make('fixture_free_race'); await pool.query('UPDATE users SET pp_balance=1 WHERE wallet_address=$1', [race]);
    // Exercise first-time get/create as well as serialized count and actual charging.
    const concurrent = await Promise.all([claim(race, 90), claim(race, 100)]);
    assert.deepEqual(concurrent.map(result => result.status), [200, 200]);
    assert.equal(concurrent.filter(result => result.body.tutorialFreeClaim).length, 1);
    assert.equal(concurrent.reduce((sum, result) => sum + result.body.ppUsed, 0), 0.5);
    assert.equal(Number((await balance(race)).pp_balance), 0.5);
    const expectedRace = await make('fixture_expected_race'); await pool.query('UPDATE users SET pp_balance=1 WHERE wallet_address=$1', [expectedRace]);
    const expectedConcurrent = await Promise.all([claim(expectedRace, 110, 5, 5, true), claim(expectedRace, 120, 5, 5, true)]);
    assert.deepEqual(expectedConcurrent.map(result => result.status).sort(), [200, 409]);
    assert.equal(expectedConcurrent.find(result => result.status === 409).body.error, 'TUTORIAL_FREE_CLAIM_CHANGED');
    assert.equal(Number((await balance(expectedRace)).pp_balance), 1);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM claims WHERE owner=$1', [expectedRace])).rows[0].n, 1);
    pass('actual concurrent disjoint25px claims grant free once: legacy caller pays second; expected-free caller gets409 without charge or deadlock');

    const unchanged = async (wallet, action) => {
      const before = JSON.stringify({ balance: await balance(wallet), claims: (await pool.query('SELECT * FROM claims WHERE owner=$1 ORDER BY id', [wallet])).rows, tx: (await pool.query('SELECT * FROM transactions WHERE from_wallet=$1 ORDER BY id', [wallet])).rows });
      const response = await action(); assert.equal(response.status, 409, JSON.stringify(response)); assert.equal(response.body.error, 'TUTORIAL_FREE_CLAIM_CHANGED');
      assert.equal(JSON.stringify({ balance: await balance(wallet), claims: (await pool.query('SELECT * FROM claims WHERE owner=$1 ORDER BY id', [wallet])).rows, tx: (await pool.query('SELECT * FROM transactions WHERE from_wallet=$1 ORDER BY id', [wallet])).rows }), before);
    };
    await unchanged(expectedRace, () => claim(expectedRace, 130, 5, 5, true));
    const guard = await make('fixture_guard_funded'); await pool.query('UPDATE users SET pp_balance=10 WHERE wallet_address=$1', [guard]);
    await pool.query("UPDATE settings SET value='false' WHERE key='onboarding_free_claim_enabled'");
    await unchanged(guard, () => claim(guard, 140, 5, 5, true));
    await pool.query("UPDATE settings SET value='true' WHERE key='onboarding_free_claim_enabled'");
    await unchanged(guard, () => claim(guard, 150, 6, 5, true));
    const getState = onboarding.getOnboardingState;
    try { onboarding.getOnboardingState = async () => { throw Error('FIXTURE_ELIGIBILITY_UNAVAILABLE'); }; await unchanged(guard, () => claim(guard, 160, 5, 5, true)); }
    finally { onboarding.getOnboardingState = getState; }
    assert.equal(await idle(), 0);
    pass('funded expected-free stale/disabled/oversize/unavailable eligibility returns409 before any balance, claim or transaction change');
    const missingShield = await make('fixture_missing_shield', { step: 3 });
    await pool.query(`INSERT INTO settings(key,value,description) VALUES('onboarding_free_item_type','"basic_shield"','fixture explicit invalid setting')`);
    const missingResponse = await request('POST', '/onboarding/step', missingShield, { step: 3 }); assert.equal(missingResponse.status, 503); assert.equal(missingResponse.body.error, 'ONBOARDING_ITEM_UNAVAILABLE');
    const missingRow = (await pool.query('SELECT current_step,shield_given FROM user_onboarding WHERE wallet_address=$1', [missingShield])).rows[0]; assert.equal(missingRow.current_step, 3); assert.equal(missingRow.shield_given, false); assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM user_items WHERE wallet=$1', [missingShield])).rows[0].n, 0); assert.equal(await idle(), 0);
    await pool.query("DELETE FROM settings WHERE key='onboarding_free_item_type'");
    const validShield = await make('fixture_valid_shield', { step: 3 });
    const shieldResponses = await Promise.all([request('POST', '/onboarding/step', validShield, { step: 3 }), request('POST', '/onboarding/step', validShield, { step: 3 })]); assert.ok(shieldResponses.every(result => result.status === 200));
    const shieldInventory = (await pool.query('SELECT t.code,i.quantity FROM user_items i JOIN item_types t ON t.id=i.item_type_id WHERE i.wallet=$1', [validShield])).rows; assert.deepEqual(shieldInventory, [{ code: 'shield_basic', quantity: 1 }]);
    assert.equal(shieldResponses.filter(result => result.body.rewards?.some(reward => reward.code === 'shield_basic')).length, 1); assert.equal((await pool.query('SELECT shield_given FROM user_onboarding WHERE wallet_address=$1', [validShield])).rows[0].shield_given, true); assert.equal(await idle(), 0);
    pass('unknown configured basic_shield fails503 without step/flag/item consumption; authored defaultshield_basic grants quantity1 exactly once concurrently');
    hashes['executed_onboarding_source'] = crypto.createHash('sha256').update(onboardSource).digest('hex'); read('server/tools/onboarding_schema_isolated_regression.js');
    console.log(JSON.stringify({ result: 'passed', checks, sources: hashes, existingAppOrDatabaseModified: false }, null, 2));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) { await pool.query('ROLLBACK').catch(() => {}); await pool.end(); }
    if (inspector) await inspector.end();
    if (started) execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
    fs.rmSync(dir, { recursive: true, force: true }); assert.equal(fs.existsSync(dir), false); console.log('CLEANUP temporary onboarding PostgreSQL cluster and HTTP socket removed');
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });

#!/usr/bin/env node
'use strict';
// Fresh dummy PostgreSQL cluster + actual mining/crafting/resource-market handlers.
// No application bootstrap, dotenv, existing database, mail, chain or TCP access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const Module = require('node:module');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(process.env.RUN_SCHEDULERS, 'false');
for (const name of Object.keys(process.env)) assert.ok(['PATH', 'NODE_ENV', 'RUN_SCHEDULERS', '__CF_USER_TEXT_ENCODING'].includes(name), 'Unexpected environment key: ' + name);
const pgBin = '/opt/homebrew/opt/postgresql@16/bin';
for (const name of ['initdb', 'pg_ctl']) assert.ok(fs.statSync(path.join(pgBin, name)).isFile());
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-play-'));
fs.chmodSync(dir, 0o700);
const dataDir = path.join(dir, 'db'), socketDir = path.join(dir, 's');
fs.mkdirSync(socketDir, { mode: 0o700 });
const pgSocket = path.join(socketDir, '.s.PGSQL.55443'), httpSocket = path.join(dir, 'http.sock');
const childEnv = { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LC_ALL: 'C' };
const results = [];
const pass = (name, details) => { results.push({ name, details }); console.log('PASS ' + name + (details ? ': ' + JSON.stringify(details) : '')); };
const inject = (file, exports) => { const id = require.resolve(file); require.cache[id] = { id, filename: id, loaded: true, exports }; };
let pool, server, started = false;

function installBoundary() {
  function target(args) { const a = args[0]; return Array.isArray(a) ? target(a) : typeof a === 'string' ? a : a?.path; }
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) { assert.ok([pgSocket, httpSocket].includes(target(args)), 'ONLY_FIXTURE_UNIX_SOCKETS'); return connect.apply(this, args); };
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function (...args) { assert.equal(target(args), httpSocket, 'ONLY_FIXTURE_HTTP_LISTEN'); return listen.apply(this, args); };
  const deny = () => { throw Error('EXTERNAL_IO_FORBIDDEN'); };
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
CREATE TABLE users(wallet_address text PRIMARY KEY,nickname text,gp_balance numeric NOT NULL DEFAULT 0,pp_balance numeric NOT NULL DEFAULT 0,is_ai boolean DEFAULT false,faction_code text DEFAULT 'fixture',rank_level integer DEFAULT 1);
CREATE TABLE settings(key text PRIMARY KEY,value text);
CREATE TABLE game_settings(key text PRIMARY KEY,value jsonb);
CREATE TABLE resources(id serial PRIMARY KEY,code text UNIQUE,name_en text,icon_emoji text,rarity text DEFAULT 'common',is_active boolean DEFAULT true,is_tradeable boolean DEFAULT true);
CREATE TABLE user_resource_inventory(wallet_address text REFERENCES users,resource_id integer REFERENCES resources,quantity integer NOT NULL CHECK(quantity>=0),updated_at timestamptz DEFAULT now(),PRIMARY KEY(wallet_address,resource_id));
CREATE TABLE user_items(wallet text REFERENCES users,item_type_id integer,quantity integer NOT NULL CHECK(quantity>=0),PRIMARY KEY(wallet,item_type_id));
CREATE TABLE crafting_recipes(id serial PRIMARY KEY,name text,category text,ingredients jsonb,gp_cost numeric,output_item_type_id integer,output_qty integer,output_name text,success_rate numeric,fail_refund_pct numeric,is_active boolean DEFAULT true,sort_order integer DEFAULT 0);
CREATE TABLE crafting_log(id serial PRIMARY KEY,wallet text,recipe_id integer,recipe_name text,gp_cost numeric,gp_refunded numeric,success boolean,created_at timestamptz DEFAULT now());
CREATE TABLE fleets(id serial PRIMARY KEY,owner_wallet text REFERENCES users,is_in_battle boolean DEFAULT false,current_battle_id integer,name text,formation text,movement text);
CREATE TABLE ship_types(code text PRIMARY KEY,size_class text,tier integer DEFAULT 1,is_active boolean DEFAULT true,faction_code text DEFAULT 'fixture',min_player_rank integer DEFAULT 1,max_per_server integer,max_per_player integer,build_gp_cost numeric DEFAULT 25,recipe_minerals jsonb DEFAULT '{"iron_ore":1,"silicon_dust":1}',build_time_seconds integer DEFAULT 60,base_hp integer DEFAULT 100,is_flagship_capable boolean DEFAULT true,name text);
CREATE TABLE ships(id serial PRIMARY KEY,owner_wallet text REFERENCES users,fleet_id integer REFERENCES fleets,ship_type_code text REFERENCES ship_types,is_alive boolean DEFAULT true,is_market_listed boolean DEFAULT false,current_hp integer,max_hp integer,bonus_hp integer DEFAULT 0,is_flagship boolean DEFAULT false,built_at timestamptz,built_by_wallet text);
CREATE TABLE ship_build_jobs(id serial PRIMARY KEY,wallet_address text REFERENCES users,fleet_id integer REFERENCES fleets,ship_type_code text,started_at timestamptz,completes_at timestamptz,status text,gp_cost numeric,minerals_used jsonb,completed_at timestamptz,result_ship_id integer);
CREATE TABLE ship_build_log(id serial PRIMARY KEY,wallet_address text,ship_type_code text,gp_cost numeric,minerals_used jsonb,result text);
CREATE TABLE fleet_gp_activity(id serial PRIMARY KEY,wallet_address text,activity_type text,gp_delta numeric,meta jsonb);
CREATE TABLE fleet_battles(id serial PRIMARY KEY,status text);
CREATE TABLE fleet_battle_participants(battle_id integer,fleet_id integer);
CREATE TABLE ship_mining_jobs(id serial PRIMARY KEY,wallet_address text REFERENCES users,fleet_id integer REFERENCES fleets,ship_count integer,capacity numeric,sector_type text,duration_h numeric,ends_at timestamptz,status text DEFAULT 'mining',reward_gp numeric,reward_resources jsonb,raided boolean DEFAULT false,collected_at timestamptz);
CREATE TABLE siege_fleet_commits(fleet_id integer,siege_id integer);
CREATE TABLE governor_sieges(id integer,status text);
CREATE TABLE sectors(id serial PRIMARY KEY,tier text,governor_wallet text);
CREATE TABLE pixels(id serial PRIMARY KEY,owner text,claim_id integer,sector_id integer REFERENCES sectors);
CREATE TABLE marketplace_listings(id serial PRIMARY KEY,seller text REFERENCES users,listing_type text,item_instance_id integer,claim_id integer,resource_code text,resource_quantity integer,price numeric,currency text,status text DEFAULT 'active',expires_at timestamptz,listed_at timestamptz DEFAULT now(),sold_at timestamptz,buyer text REFERENCES users,meta jsonb,sector_id integer);
CREATE TABLE transactions(id serial PRIMARY KEY,type text,from_wallet text,pp_amount numeric,fee numeric,meta jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE marketplace_price_history(id serial PRIMARY KEY,listing_type text,item_type_id integer,enhancement_level integer,claim_id integer,sale_price numeric,currency text);
CREATE TABLE sector_resource_rates(sector_type text,resource_code text,base_rate numeric,miner_bonus numeric DEFAULT 0,is_active boolean DEFAULT true);
INSERT INTO users(wallet_address,nickname,gp_balance) VALUES('fixture_commander','Commander',1000),('fixture_buyer','Buyer',1000),('fixture_racer','Racer',1000);
INSERT INTO resources(code,name_en) VALUES('iron_ore','Iron ore'),('silicon_dust','Silicon dust');
INSERT INTO sector_resource_rates(sector_type,resource_code,base_rate) VALUES('frontier','iron_ore',1),('frontier','silicon_dust',1);
INSERT INTO settings(key,value) VALUES('resource_drop_quantity_min','10'),('resource_drop_quantity_max','10'),('ship_mining_gp_per_capacity_h','5'),('ship_mining_alliance_sector_bonus_pct','0'),('ship_mining_owned_sector_bonus_pct','0'),('marketplace_listing_fee_gp','2'),('marketplace_sale_fee_pct','5'),('marketplace_referral_commission_pct_of_fee','0');
INSERT INTO game_settings(key,value) VALUES('crafting_enabled','true'),('crafting_max_per_day','20');
INSERT INTO crafting_recipes(name,category,ingredients,gp_cost,output_item_type_id,output_qty,output_name,success_rate,fail_refund_pct) VALUES
('Fixture shield','defense','[{"code":"iron_ore","qty":5},{"resource_code":"silicon_dust","qty":3}]',50,1,1,'Shield',100,50),
('Legacy item recipe','utility','[{"item_type_id":1,"qty":1}]',0,2,1,'Legacy output',100,0),
('Rollback fixture','utility','[{"code":"iron_ore","qty":2},{"code":"silicon_dust","qty":999}]',50,3,1,'Unavailable',100,0),
('Concurrent fixture','utility','[{"code":"iron_ore","qty":5}]',10,4,1,'Concurrent output',100,0),
('Failure fixture','utility','[{"code":"iron_ore","qty":1}]',20,5,1,'No output',0,50);
INSERT INTO fleets(owner_wallet,name) VALUES('fixture_commander','Dummy starting fleet');
INSERT INTO ship_types(code,size_class) VALUES('fixture_miner','frigate');
INSERT INTO ships(owner_wallet,fleet_id,ship_type_code,current_hp,max_hp) VALUES('fixture_commander',1,'fixture_miner',100,100);
`;

async function run() {
  try {
    execFileSync(path.join(pgBin, 'initdb'), ['-D', dataDir, '--no-locale', '--encoding=UTF8', '--auth=trust', '--username=mars_fixture'], { env: childEnv, stdio: 'pipe' });
    fs.appendFileSync(path.join(dataDir, 'postgresql.conf'), "\nlisten_addresses = ''\nport = 55443\nunix_socket_directories = '" + socketDir + "'\n");
    try { execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', dataDir, '-l', path.join(dir, 'postgres.log'), '-w', 'start'], { env: childEnv, stdio: 'pipe' }); }
    catch (error) { console.error(fs.readFileSync(path.join(dir, 'postgres.log'), 'utf8')); throw error; }
    started = true;
    installBoundary();
    const { Pool } = require('pg');
    pool = new Pool({ host: socketDir, port: 55443, user: 'mars_fixture', password: 'unused-public-fixture-password', database: 'postgres', ssl: false, max: 10, connectionTimeoutMillis: 3000, statement_timeout: 5000, query_timeout: 6000 });
    await pool.query(schema);
    const getSetting = async (key, fallback) => (await pool.query('SELECT value FROM settings WHERE key=$1', [key])).rows[0]?.value ?? fallback;
    const noop = async () => {};
    inject('../db', { pool, getSetting, logGPActivity: noop, notifyPlayer: noop, creditReferralCommission: noop, awardXP: noop });
    inject('../services/job', { getJobBuff: async (_wallet, _key, fallback) => fallback });
    inject('../services/season', { addSeasonScore: noop, trackGPSpend: noop });
    inject('../routes/dailyOps', { notifyMissionProgress: noop });
    inject('../services/weeklyChallenge', { trackProgress: noop });
    inject('../services/sector', { computeSectorTariff: async () => ({ tariffAmount: 0, tariffPct: 0, reason: 'fixture_no_sector' }) });
    inject('../services/territoryCondition', { marketFeeMultiplier: async () => 1 });
    inject('../services/daily', { updateMissionProgress: noop });
    inject('../services/dividends', { addToPool: noop });
    inject('../services/achievements', { checkAndUnlock: noop });
    inject('../services/washTradeDetect', { observeTrade: noop });
    inject('../services/news', { onMarketSale: noop });
    // JWT fixture secret is public and fixed, set only after the cleared-env check.
    process.env.JWT_SECRET = 'local-play-loop-public-dummy-jwt-secret';
    const express = require('express'), jwt = require('jsonwebtoken');
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { Object.defineProperty(req, 'ip', { value: '127.0.0.1' }); next(); });
    app.use('/api', require('../routes/crafting'));
    app.use('/api', require('../routes/shipMining'));
    app.use('/api/ships', require('../routes/ships'));
    app.use('/api/marketplace', require('../routes/marketplace'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(httpSocket, resolve));
    const request = (method, route, wallet = 'fixture_commander', body) => new Promise((resolve, reject) => {
      const payload = body == null ? null : JSON.stringify(body);
      const req = http.request({ socketPath: httpSocket, path: '/api' + route, method, headers: {
        ...(wallet ? { authorization: 'Bearer ' + jwt.sign({ wallet_address: wallet }, process.env.JWT_SECRET, { expiresIn: '5m' }) } : {}),
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {})
      } }, res => { let value = ''; res.setEncoding('utf8'); res.on('data', c => { value += c; }); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(value) }); } catch (e) { reject(e); } }); });
      req.on('error', reject); req.setTimeout(7000, () => req.destroy(Error('fixture_timeout'))); if (payload) req.write(payload); req.end();
    });
    const scalar = async (sql, args = []) => Number(Object.values((await pool.query(sql, args)).rows[0])[0]);
    const inventory = async (wallet, code) => scalar('SELECT COALESCE(SUM(i.quantity),0) FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code=$2', [wallet, code]);
    const gp = wallet => scalar('SELECT gp_balance FROM users WHERE wallet_address=$1', [wallet]);
    const snapshot = async () => ({ gp: await gp('fixture_commander'), iron: await inventory('fixture_commander', 'iron_ore'), silicon: await inventory('fixture_commander', 'silicon_dust'), attempts: await scalar('SELECT COUNT(*) FROM crafting_log') });
    assert.equal((await request('POST', '/mining/launch', null, { fleetId: 1, durationH: 1 })).status, 401);
    const launch = await request('POST', '/mining/launch', 'fixture_commander', { fleetId: 1, durationH: 1, destination: 'frontier' });
    assert.equal(launch.status, 200, JSON.stringify(launch));
    const jobId = launch.body.job.id;
    assert.equal((await request('POST', '/mining/collect', 'fixture_buyer', { jobId })).status, 400);
    const early = await request('POST', '/mining/collect', 'fixture_commander', { jobId });
    assert.equal(early.status, 400); assert.equal(early.body.error, 'not_ready');
    const relaunch = await request('POST', '/mining/launch', 'fixture_commander', { fleetId: 1, durationH: 1 });
    assert.equal(relaunch.status, 400); assert.equal(relaunch.body.error, 'fleet_already_mining');
    pass('actual mining launch / wrong owner / early collect / occupied fleet');
    // Move only this dummy job's clock. No hour-long real wait is claimed.
    await pool.query("UPDATE ship_mining_jobs SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [jobId]);
    const beforeMining = await gp('fixture_commander');
    const collected = await Promise.all([request('POST', '/mining/collect', 'fixture_commander', { jobId }), request('POST', '/mining/collect', 'fixture_commander', { jobId })]);
    assert.deepEqual(collected.map(x => x.status).sort(), [200, 400]);
    assert.equal(collected.find(x => x.status === 400).body.error, 'already_collected');
    assert.equal(await gp('fixture_commander') - beforeMining, 5);
    assert.equal(await inventory('fixture_commander', 'iron_ore'), 10);
    assert.equal(await inventory('fixture_commander', 'silicon_dust'), 10);
    assert.equal(await scalar('SELECT current_hp FROM ships WHERE id=1'), 98);
    pass('actual mining collection exactly once; real resource roll/inventory SQL', { gpGain: 5, ironOre: 10, siliconDust: 10, hullHp: 98, concurrentStatuses: collected.map(x => x.status) });
    const list = await request('GET', '/crafting/recipes?category=defense');
    const detail = await request('GET', '/crafting/recipe/1');
    assert.equal(list.status, 200); assert.equal(detail.status, 200);
    if (process.argv.includes('--expect-eligibility-bug')) {
      assert.equal(list.body[0].canCraft, false); assert.equal(detail.body.canCraft, false);
      const crafted = await request('POST', '/crafting/craft', 'fixture_commander', { recipeId: 1 });
      assert.equal(crafted.status, 200); assert.equal(crafted.body.success, true);
      pass('BUG REPRODUCED: resource-funded recipe reads false but actual craft succeeds', { listCanCraft: false, detailCanCraft: false, craftSuccess: true, after: await snapshot() });
      return;
    }
    assert.equal(list.body[0].canCraft, true); assert.equal(detail.body.canCraft, true);
    assert.equal((await request('GET', '/crafting/recipe/1', null)).body.canCraft, false);
    pass('list/detail eligibility recognizes both resource-code keys; guest remains false');
    const crafted = await request('POST', '/crafting/craft', 'fixture_commander', { recipeId: 1 });
    assert.equal(crafted.status, 200); assert.equal(crafted.body.success, true);
    assert.equal(await inventory('fixture_commander', 'iron_ore'), 5); assert.equal(await inventory('fixture_commander', 'silicon_dust'), 7);
    assert.equal(await gp('fixture_commander'), 955);
    assert.equal((await request('GET', '/crafting/recipe/2')).body.canCraft, true);
    const legacy = await request('POST', '/crafting/craft', 'fixture_commander', { recipeId: 2 });
    assert.equal(legacy.status, 200); assert.equal(await scalar('SELECT quantity FROM user_items WHERE wallet=$1 AND item_type_id=2', ['fixture_commander']), 1);
    assert.equal((await request('GET', '/crafting/recipe/2')).body.canCraft, false);
    pass('actual resource craft charges 50 GP / 5 ore / 3 silicon; legacy item craft consumes its item');
    const beforeRollback = await snapshot();
    const failed = await request('POST', '/crafting/craft', 'fixture_commander', { recipeId: 3 });
    assert.equal(failed.status, 400); assert.match(failed.body.error, /Not enough silicon_dust/);
    assert.deepEqual(await snapshot(), beforeRollback);
    pass('insufficient second ingredient rolls back first ingredient and every GP/output/log write');
    // Listing consumes only mined leftovers. The second dummy human is independent.
    const listed = await request('POST', '/marketplace/list', 'fixture_commander', { type: 'resource', resourceCode: 'iron_ore', resourceQuantity: 3, price: 10, currency: 'GP' });
    assert.equal(listed.status, 200, JSON.stringify(listed));
    assert.equal(await inventory('fixture_commander', 'iron_ore'), 2);
    const listingId = listed.body.listing.id;
    const bought = await Promise.all([request('POST', '/marketplace/buy', 'fixture_buyer', { listingId }), request('POST', '/marketplace/buy', 'fixture_buyer', { listingId })]);
    assert.deepEqual(bought.map(x => x.status).sort(), [200, 400]);
    assert.equal(await inventory('fixture_buyer', 'iron_ore'), 3);
    assert.equal(await gp('fixture_buyer'), 990); assert.equal(await gp('fixture_commander'), 962.5);
    assert.equal(await scalar("SELECT COUNT(*) FROM transactions WHERE type='marketplace_sale'"), 1);
    pass('actual mined-resource escrow and concurrent purchase settle once', { oreSeller: 2, oreBuyer: 3, sellerGp: 962.5, buyerGp: 990, listingFee: 2, saleFee: 0.5 });
    await pool.query("INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT 'fixture_racer',id,5 FROM resources WHERE code='iron_ore'");
    const concurrent = await Promise.all([request('POST', '/crafting/craft', 'fixture_racer', { recipeId: 4 }), request('POST', '/crafting/craft', 'fixture_racer', { recipeId: 4 })]);
    assert.deepEqual(concurrent.map(x => x.status).sort(), [200, 400]);
    assert.equal(await inventory('fixture_racer', 'iron_ore'), 0); assert.equal(await gp('fixture_racer'), 990);
    assert.equal(await scalar("SELECT quantity FROM user_items WHERE wallet='fixture_racer' AND item_type_id=4"), 1);
    assert.equal(await scalar("SELECT COUNT(*) FROM crafting_log WHERE wallet='fixture_racer'"), 1);
    pass('concurrent crafts with one available batch produce one item / debit / log');
    const failedRoll = await request('POST', '/crafting/craft', 'fixture_commander', { recipeId: 5 });
    assert.equal(failedRoll.status, 200); assert.equal(failedRoll.body.success, false); assert.equal(failedRoll.body.gpRefunded, 10);
    assert.equal(await gp('fixture_commander'), 952.5); assert.equal(await inventory('fixture_commander', 'iron_ore'), 1);
    assert.equal(await scalar('SELECT COUNT(*) FROM user_items WHERE item_type_id=5'), 0);
    pass('0-percent success fixture consumes material / refunds half GP / creates no output');
    // Use only the actual mined leftovers; catalogue/time are dummy fixture values.
    const build = await request('POST', '/ships/build', 'fixture_commander', { ship_type_code: 'fixture_miner', fleet_id: 1 });
    assert.equal(build.status, 200, JSON.stringify(build));
    assert.equal(build.body.gp_cost, '25');
    assert.equal(await gp('fixture_commander'), 927.5);
    assert.equal(await inventory('fixture_commander', 'iron_ore'), 0);
    assert.equal(await inventory('fixture_commander', 'silicon_dust'), 6);
    const buildId = build.body.job_id;
    assert.equal((await request('POST', '/ships/build-jobs/' + buildId + '/complete', 'fixture_buyer', {})).status, 404);
    const earlyBuild = await request('POST', '/ships/build-jobs/' + buildId + '/complete', 'fixture_commander', {});
    assert.equal(earlyBuild.status, 409); assert.equal(earlyBuild.body.error, 'NOT_YET_COMPLETE');
    await pool.query("UPDATE ship_build_jobs SET completes_at=NOW()-INTERVAL '1 second' WHERE id=$1", [buildId]);
    const completions = await Promise.all([request('POST', '/ships/build-jobs/' + buildId + '/complete', 'fixture_commander', {}), request('POST', '/ships/build-jobs/' + buildId + '/complete', 'fixture_commander', {})]);
    assert.ok(completions.every(x => x.status === 200));
    assert.equal(completions.filter(x => x.body.success === true).length, 1);
    assert.equal(completions.filter(x => x.body.already_completed === true).length, 1);
    assert.equal(await scalar('SELECT COUNT(*) FROM ships'), 2);
    assert.equal(await scalar("SELECT COUNT(*) FROM ship_build_jobs WHERE status='completed' AND result_ship_id IS NOT NULL"), 1);
    assert.equal(await gp('fixture_commander'), 927.5);
    pass('actual mined-material ship build / owner and time guards / concurrent completion one new hull', { gp: 927.5, ore: 0, silicon: 6, ships: 2, newHulls: 1 });
    // Missing configuration must inherit the already-seeded 3 GP/capacity-hour
    // and 1500 GP/day policy, while an explicit operator cap=0 remains valid.
    await pool.query("DELETE FROM settings WHERE key IN ('ship_mining_gp_per_capacity_h','ship_mining_gp_cap_per_day')");
    const miningInfo = await request('GET', '/mining/info');
    assert.equal(miningInfo.status, 200); assert.equal(miningInfo.body.gpPerCapacityHour, 3); assert.equal(miningInfo.body.gpCapPerDay, 1500);
    await pool.query("UPDATE ship_mining_jobs SET reward_gp=1499 WHERE id=$1", [jobId]);
    const cappedLaunch = await request('POST', '/mining/launch', 'fixture_commander', { fleetId: 1, durationH: 1 });
    assert.equal(cappedLaunch.status, 200);
    await pool.query("UPDATE ship_mining_jobs SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [cappedLaunch.body.job.id]);
    const cappedCollect = await request('POST', '/mining/collect', 'fixture_commander', { jobId: cappedLaunch.body.job.id });
    assert.equal(cappedCollect.status, 200); assert.equal(cappedCollect.body.rewardGp, 1);
    await pool.query("INSERT INTO settings(key,value) VALUES('ship_mining_gp_cap_per_day','-10'),('ship_mining_gp_per_capacity_h','-2')");
    const invalidLaunch = await request('POST', '/mining/launch', 'fixture_commander', { fleetId: 1, durationH: 1 });
    assert.equal(invalidLaunch.status, 200);
    await pool.query("UPDATE ship_mining_jobs SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [invalidLaunch.body.job.id]);
    const invalidCollect = await request('POST', '/mining/collect', 'fixture_commander', { jobId: invalidLaunch.body.job.id });
    assert.equal(invalidCollect.status, 200); assert.equal(invalidCollect.body.rewardGp, 0);
    await pool.query("UPDATE settings SET value=CASE WHEN key='ship_mining_gp_cap_per_day' THEN '0' ELSE 'malformed' END WHERE key IN ('ship_mining_gp_cap_per_day','ship_mining_gp_per_capacity_h')");
    const uncappedLaunch = await request('POST', '/mining/launch', 'fixture_commander', { fleetId: 1, durationH: 1 });
    assert.equal(uncappedLaunch.status, 200);
    await pool.query("UPDATE ship_mining_jobs SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1", [uncappedLaunch.body.job.id]);
    const uncappedCollect = await request('POST', '/mining/collect', 'fixture_commander', { jobId: uncappedLaunch.body.job.id });
    assert.equal(uncappedCollect.status, 200); assert.equal(uncappedCollect.body.rewardGp, 6);
    pass('missing cap inherits existing 1500/day; invalid rate inherits 3/capacity-hour; explicit zero cap preserved', { cappedGp: 1, uncappedGp: 6, capacity: 2 });
    const sourceHashes = {};
    for (const relative of ['services/shipMining.js', 'services/resource.js', 'services/crafting.js', 'services/marketplace.js', 'services/ship.js', 'routes/shipMining.js', 'routes/crafting.js', 'routes/marketplace.js', 'routes/ships.js']) sourceHashes[relative] = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', relative))).digest('hex');
    console.log(JSON.stringify({ results, sourceHashes, fixture: { dir, database: 'postgres', port: 55443, tcp: false }, limits: ['Starting fleet is dummy seed; one additional hull is actually built/completed by the existing HTTP/service path.', 'Mining/build clocks advanced by fixture SQL; drop quantity fixed at 10, recipe success fixed at 100/0, build catalogue is dummy cost/time.', 'XP/job buffs/tariff/season/weekly/daily/notifications/referrals/achievements/dividends/wash-trade collaborators are injected no-ops or neutral values.', 'No territory claim/territory harvest, guild action, story/tactics battle, complete new-account journey, production/bootstrap or browser execution.'] }, null, 2));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (started) {
      execFileSync(path.join(pgBin, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], { env: childEnv, stdio: 'pipe' });
      started = false;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    assert.equal(fs.existsSync(dir), false);
    console.log('CLEANUP no private PG running; HTTP/PG sockets and dummy cluster removed: ' + dir);
  }
}
run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

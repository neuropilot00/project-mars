#!/usr/bin/env node
'use strict';
// Actual bulk route and source-migration DDL in a new private Unix-only cluster.
// Optional CLI argument: evidence directory containing preserved before-* source.
// Never imports app/db bootstrap or reads .env.

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process'),net=require('node:net'),tls=require('node:tls'),dns=require('node:dns');
const root=path.resolve(__dirname,'../..'),pgBin='/opt/homebrew/opt/postgresql@16/bin';
const temp=fs.mkdtempSync('/tmp/mars-bulk-pg-'),socket=path.join(temp,'s'),data=path.join(temp,'d'),port=55495;fs.mkdirSync(socket,{mode:0o700});
const connect=net.Socket.prototype.connect;function target(args){return Array.isArray(args[0])?target(args[0]):typeof args[0]==='string'?args[0]:args[0]?.path;}
net.Socket.prototype.connect=function(...args){assert.equal(target(args),path.join(socket,'.s.PGSQL.'+port));return connect.apply(this,args);};
const deny=()=>{throw Error('External network forbidden');};net.Server.prototype.listen=tls.connect=dns.lookup=dns.resolve=deny;dns.promises.lookup=dns.promises.resolve=deny;global.fetch=deny;
const read=fs.readFileSync;fs.readFileSync=function(file,...args){assert.ok(!path.basename(String(file)).startsWith('.env'));return read.call(this,file,...args);};
const {Pool}=require(path.join(root,'server/node_modules/pg'));
const evidence=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(require('node:os').tmpdir(),'mars-bulk-evidence-'));fs.mkdirSync(evidence,{recursive:true});
const current=fs.readFileSync(path.join(root,'server/routes/api.js'),'utf8');
function parts(s){return {constants:s.slice(s.indexOf('const SECTOR_INFLUENCE_PRODUCTION_BONUS'),s.indexOf('const GRID_SIZE')),date:s.slice(s.indexOf('function sameDateKey('),s.indexOf('// Public config and wallet')),influence:s.slice(s.indexOf('async function getSectorInfluenceProductionBonus('),s.indexOf('// Cached sectors for sector lookup')),route:s.slice(s.indexOf("router.post('/territory/harvest-all'"),s.indexOf('// ══════════════════════════════════════════════════════════\n//  POST /api/territory/:claimId/harvest'))};}
const source=parts(current),before=fs.existsSync(path.join(evidence,'before-bulk-route.js'))&&fs.existsSync(path.join(evidence,'before-influence-helper.js'))?{...source,route:fs.readFileSync(path.join(evidence,'before-bulk-route.js'),'utf8'),influence:fs.readFileSync(path.join(evidence,'before-influence-helper.js'),'utf8')}:null;
const sourceHashes=Object.fromEntries(Object.entries(source).map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]));
const migrationHashes={},checks=[],sqlErrors=[],warnings=[];let pool,started=false,error,failXP=false;
function command(binary,args){const r=spawnSync(path.join(pgBin,binary),args,{encoding:'utf8',env:{PATH:'/usr/bin:/bin',LC_ALL:'C'}});if(r.status!==0)throw Error(binary+':'+r.stdout+r.stderr);}
function migration(name){const text=fs.readFileSync(path.join(root,'server/migrations',name),'utf8');migrationHashes[name]=crypto.createHash('sha256').update(text).digest('hex');return text;}
function table(name,file){const text=migration(file),match=text.match(new RegExp('CREATE TABLE IF NOT EXISTS '+name+' \\([\\s\\S]*?\\n\\);'));assert.ok(match,'Actual migration table '+name);return match[0];}
function line(file,expression){const result=migration(file).match(expression);assert.ok(result,file);return result[0];}
const w='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';
function handler(sourceParts){let handle;
 const clientPool={async connect(){const c=await pool.connect();return {release:()=>c.release(),async query(sql,args){try{return await c.query(sql,args);}catch(e){sqlErrors.push({code:e.code,message:e.message,sql:sql.slice(0,160)});throw e;}}};}};
 const settings={mining_enabled:true,mining_interval_frontier:72,mining_reward_min:1,mining_reward_max:1,mining_reward_cap_per_harvest:1,mining_frontier_mult:1};
 const sandbox={console:{error:(...x)=>warnings.push(x.join(' ')),warn:(...x)=>warnings.push(x.join(' '))},pool:clientPool,
  router:{post(url,...handlers){assert.equal(url,'/territory/harvest-all');handle=handlers.at(-1);}},requireAuth(){},harvestLimiter(){},getAuthWallet:req=>req.wallet,
  cfg:async()=>settings,getSetting:async(key,fallback)=>(await pool.query('SELECT value FROM settings WHERE key=$1',[key])).rows[0]?.value??fallback,
  getPPToGPRate:async c=>Number((await c.query("SELECT value #>> '{}' AS v FROM settings WHERE key='pp_to_gp_exchange_rate'")).rows[0]?.v??10),
  jobService:null,hasActiveEvent:async()=>false,weatherService:null,explorationService:null,regionMultiplier:async()=>1,getActiveSectorBuffs:async()=>[],surgeSvc:null,resourceService:null,
  awardXP:async(c,wallet,xp)=>{await c.query('UPDATE users SET xp=COALESCE(xp,0)+$2 WHERE wallet_address=$1',[wallet,xp]);if(failXP)await c.query('SELECT absent_fixture_xp_column FROM users');},creditReferralCommission:async()=>{},dailyService:null,weeklySvc:null,seasonService:null,
  require(name){if(name==='../services/tiers')return {getCfg:async()=>({enabled:true,tiers:[]})};if(name==='../services/territoryCondition')return {harvestMultiplier:async()=>1,rareMultiplier:async()=>1};throw Error('Uninjected optional dependency '+name);}};
 vm.createContext(sandbox);vm.runInContext(sourceParts.constants+sourceParts.date+sourceParts.influence+sourceParts.route,sandbox);
 return async()=>{const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};await handle({wallet:w},res);return res;};
}
async function check(name,fn){await fn();checks.push({name,passed:true});console.log('PASS '+name);}
async function seed(count=1,cooling=0){failXP=false;await pool.query('TRUNCATE user_mining,transactions,pixels,claims,user_active_effects,territory_tiers,territory_upgrades RESTART IDENTITY CASCADE');await pool.query('UPDATE users SET gp_balance=100,xp=0');
 for(let i=1;i<=count;i++){await pool.query("INSERT INTO claims(id,owner,center_lat,center_lng,width,height,total_paid,sector_code,last_harvest_at) VALUES($1::integer,$2,$1::numeric,0,1,1,0,'fixture',CASE WHEN $3 THEN NOW() ELSE NULL END)",[i,w,i<=cooling]);await pool.query('INSERT INTO pixels(lat,lng,owner,claim_id,sector_id) VALUES($1::numeric,0,$2,$1::integer,1)',[i,w]);}}
async function balance(){return Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[w])).rows[0].gp_balance);}
async function count(table){return Number((await pool.query('SELECT COUNT(*) n FROM '+table)).rows[0].n);}
async function main(){
 command('initdb',['-D',data,'-U','bulk_fixture','--auth-local=trust','--auth-host=reject','--no-locale','-E','UTF8']);command('pg_ctl',['-D',data,'-l',path.join(temp,'pg.log'),'-o',`-F -c listen_addresses='' -k '${socket}' -p ${port}`,'-w','start']);started=true;
 pool=new Pool({host:socket,port,user:'bulk_fixture',database:'postgres',password:'',ssl:false,max:8,options:'-c statement_timeout=5000 -c lock_timeout=4000'});
 assert.equal((await pool.query('SELECT inet_server_addr() a')).rows[0].a,null);
 const ddl=[table('users','001_initial_schema.sql'),table('settings','001_initial_schema.sql'),table('pixels','001_initial_schema.sql'),table('claims','001_initial_schema.sql'),table('transactions','001_initial_schema.sql'),table('sectors','005_sectors_and_ranks.sql'),table('user_mining','005_sectors_and_ranks.sql'),table('guilds','046_guild_system.sql'),table('guild_members','046_guild_system.sql'),table('sector_definitions','084_sector_definitions.sql'),table('fleets','092_fleets_and_ships.sql'),table('fleet_battles','093_fleet_battles.sql'),table('fleet_battle_participants','093_fleet_battles.sql'),table('territory_tiers','178_phantom_tables_pack.sql'),table('territory_upgrades','180_remaining_phantom_tables.sql'),
 migration('034_user_active_effects.sql'),migration('016_add_mining_tx_type.sql'),line('044_daily_engagement.sql',/ALTER TABLE users ADD COLUMN IF NOT EXISTS gp_balance[^;]*;/),line('005_sectors_and_ranks.sql',/ALTER TABLE users ADD COLUMN IF NOT EXISTS xp[^;]*;/),line('005_sectors_and_ranks.sql',/ALTER TABLE pixels ADD COLUMN IF NOT EXISTS sector_id[^;]*;/),line('084_sector_definitions.sql',/ALTER TABLE claims[\s\S]*?;/),line('216_territory_identity.sql',/ALTER TABLE claims[\s\S]*?;/),line('237_territory_condition_grade.sql',/ALTER TABLE claims ADD COLUMN IF NOT EXISTS grade[^;]*;/),'CREATE TABLE schema_migrations(filename TEXT PRIMARY KEY);',migration('214_per_territory_harvest.sql')];
 fs.writeFileSync(path.join(evidence,'actual-migration-ddl.sql'),ddl.join('\n'));await pool.query(ddl.join('\n'));
 await pool.query('INSERT INTO users(wallet_address,gp_balance) VALUES($1,100),($2,100)',[w,other]);await pool.query("INSERT INTO sectors(id,name,tier,center_lat,center_lng,lat_min,lat_max,lng_min,lng_max) VALUES(1,'Fixture','frontier',0,0,-1,1,-1,1)");await pool.query("INSERT INTO sector_definitions(code,sector_type) VALUES('fixture','frontier');INSERT INTO settings(key,value) VALUES('pp_to_gp_exchange_rate','10')");
 await seed();
 await check('before patch, actual migration schema reproduces missing guild_members.status then aborted bulk transaction',async()=>{
  if(before){const response=await handler(before)();assert.equal(response.statusCode,500);assert.equal(await balance(),100);assert.equal(await count('transactions'),0);assert.ok(sqlErrors.some(e=>e.code==='42703'&&e.message.includes('status')));assert.ok(sqlErrors.some(e=>e.code==='25P02'));}
  else{const c=await pool.connect();try{await c.query('BEGIN');await assert.rejects(()=>c.query("SELECT wallet FROM guild_members WHERE status='active'"),e=>e.code==='42703');await assert.rejects(()=>c.query('SELECT 1'),e=>e.code==='25P02');await c.query('ROLLBACK');}finally{c.release();}}
 });
 await seed(0);
 await check('zero owned territories returns no_territory and persists no mining row or payout',async()=>{const r=await handler(source)();assert.equal(r.statusCode,400);assert.equal(r.body.error,'no_territory');assert.equal(await count('user_mining'),0);assert.equal(await balance(),100);});
 await seed();
 await check('one owned territory succeeds with one GP payout, ledger and cooldown; repeat cannot pay again',async()=>{
  const invoke=handler(source),r=await invoke();assert.equal(r.statusCode,200);assert.equal(r.body.harvested,1);assert.equal(await balance(),100+r.body.totalGP);assert.equal(await count('transactions'),1);
  const again=await invoke();assert.equal(again.statusCode,429);assert.equal(again.body.error,'harvest_on_cooldown');assert.equal(await count('transactions'),1);assert.equal(await balance(),100+r.body.totalGP);
 });
 await seed(3,1);
 await check('multiple claims preserve each cooldown and aggregate only the two eligible owned territories',async()=>{
  const r=await handler(source)();assert.equal(r.statusCode,200);assert.equal(r.body.harvested,2);assert.equal(r.body.cooldown,1);assert.equal(await count('transactions'),2);assert.equal(await balance(),100+r.body.totalGP);
  const total=Number((await pool.query('SELECT total_mined_pp FROM user_mining')).rows[0].total_mined_pp);assert.equal(total,r.body.totalPP);
 });
 await seed(2);
 await check('concurrent bulk requests serialize the user mining row and harvest each claim only once',async()=>{
  const invoke=handler(source),results=await Promise.all([invoke(),invoke()]);assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,429]);assert.equal(await count('transactions'),2);const winner=results.find(r=>r.statusCode===200);assert.equal(await balance(),100+winner.body.totalGP);
 });
 await seed(2);await pool.query("INSERT INTO user_active_effects(wallet,effect_type,effect_value,uses_remaining) VALUES($1,'harvest_surge',3,1)",[w]);
 await check('one-use surge multiplies only one eligible claim and consumption commits once with the payout',async()=>{
  const invoke=handler(source),r=await invoke();assert.equal(r.statusCode,200);assert.equal(r.body.results.length,2);assert.equal(r.body.results[0].harvestedPP,3*r.body.results[1].harvestedPP);
  const effect=(await pool.query('SELECT uses_remaining,active FROM user_active_effects')).rows[0];assert.equal(effect.uses_remaining,0);assert.equal(effect.active,false);assert.equal((await invoke()).statusCode,429);
 });
 await seed();await pool.query('DROP TABLE user_active_effects');
 await check('an absent optional effects table does not poison the mandatory transaction',async()=>{const r=await handler(source)();assert.equal(r.statusCode,200);assert.equal(await count('transactions'),1);assert.equal(await balance(),100+r.body.totalGP);});await pool.query(migration('034_user_active_effects.sql'));
 await seed();failXP=true;
 await check('a partially written optional XP effect rolls back to its savepoint while payout remains atomic',async()=>{
  const r=await handler(source)();assert.equal(r.statusCode,200);assert.equal((await pool.query('SELECT xp FROM users WHERE wallet_address=$1',[w])).rows[0].xp,0);assert.equal(await balance(),100+r.body.totalGP);assert.equal(await count('transactions'),1);
 });
 await seed(2);await pool.query(`CREATE FUNCTION fail_second_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.meta->>'claimId')::int=2 THEN RAISE EXCEPTION 'fixture mandatory ledger failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_second_ledger BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION fail_second_ledger()`);
 await check('a mandatory second-claim ledger failure rolls all claim clocks, payout and first ledger back',async()=>{
  const r=await handler(source)();assert.equal(r.statusCode,500);assert.equal(await balance(),100);assert.equal(await count('transactions'),0);assert.equal(await count('user_mining'),0);assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM claims WHERE last_harvest_at IS NOT NULL')).rows[0].n),0);
 });await pool.query('DROP TRIGGER fail_second_ledger ON transactions;DROP FUNCTION fail_second_ledger()');
 await seed();await pool.query("INSERT INTO user_active_effects(wallet,effect_type,effect_value,uses_remaining) VALUES($1,'harvest_surge',3,1)",[w]);await pool.query(`CREATE FUNCTION fail_surge_consumption() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture surge consume failure'; END $$;CREATE TRIGGER fail_surge BEFORE UPDATE ON user_active_effects FOR EACH ROW EXECUTE FUNCTION fail_surge_consumption()`);
 await check('surge consumption failure rolls the reward back instead of allowing a reusable paid bonus',async()=>{
  const r=await handler(source)();assert.equal(r.statusCode,500);assert.equal(await balance(),100);assert.equal(await count('transactions'),0);assert.equal((await pool.query('SELECT uses_remaining FROM user_active_effects')).rows[0].uses_remaining,1);
 });await pool.query('DROP TRIGGER fail_surge ON user_active_effects;DROP FUNCTION fail_surge_consumption()');
 const final=parts(fs.readFileSync(path.join(root,'server/routes/api.js'),'utf8'));for(const key in sourceHashes)assert.equal(crypto.createHash('sha256').update(final[key]).digest('hex'),sourceHashes[key]);
 assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM pg_stat_activity WHERE state='idle in transaction'")).rows[0].n),0);
}
(async()=>{try{await main();}catch(e){error=e;console.error(e);}finally{if(pool)await pool.end();if(started)command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);fs.rmSync(temp,{recursive:true,force:true});}
 const result={passed:!error,checks,sourceHashes,migrationHashes,sqlErrors,warnings,privateClusterRemoved:!fs.existsSync(temp),error:error?.message,limits:['Actual bulk handler/influence helper and real selected migration DDL on a fresh Unix-only PG.','No Express HTTP/auth, current QA account, app bootstrap or existing DB used.','Fixed reward cfg and injected optional non-SQL services; real route queries, locking, writes and SQL-error injection.','Not a full migration chain or production validation.']};fs.writeFileSync(path.join(evidence,'private-pg-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,checks:checks.length,privateClusterRemoved:result.privateClusterRemoved,evidence,error:result.error}));if(error)process.exitCode=1;})();

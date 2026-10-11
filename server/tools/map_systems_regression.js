'use strict';
// No DB, provider, or network access. Execute real service/route handlers against transaction doubles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { regionMultiplier, weightedRegionMultiplier } = require('../utils/regionalHarvest');
const root = path.join(__dirname, '..');
function load(file, dependencies) {
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    module: mod, exports: mod.exports, console: {log(){},warn(){},error(){}}, Date, Math, Number, String,
    require(name) { if (Object.hasOwn(dependencies, name)) return dependencies[name]; throw Error('Unexpected dependency: ' + name); }
  }, { filename: file });
  return mod.exports;
}
async function main() {
  const overlays = fs.readFileSync(path.join(root, '../assets/mars-map-overlays.js'), 'utf8');
  const feeds = fs.readFileSync(path.join(root, '../assets/world-live-feeds.js'), 'utf8');
  const classes = new Set();
  const track = { firstChild: null, innerHTML: '' };
  const banner = { classList: { add(c){classes.add(c);}, remove(c){classes.delete(c);} } };
  const chip = { classList: {remove(){}}, innerHTML:'' };
  const ui = {Date, _rocketData:{events:[]}, tl:en=>en,
    document:{getElementById:id=>({announceTrack:track,announceBanner:banner,rocketBanner:chip}[id])},
    showAnnounce(text){track.firstChild={textContent:text};classes.add('show');}};
  vm.createContext(ui);
  vm.runInContext(overlays.slice(overlays.indexOf('function _isRocketEventVisible('), overlays.indexOf('var _rocketMesh')), ui);
  vm.runInContext(feeds.slice(feeds.indexOf("var _rocketAnnounceText = ''"),feeds.indexOf('_setActiveTimeout(loadRocketData,')),ui);
  const future=new Date(Date.now()+60000).toISOString(),past=new Date(Date.now()-60000).toISOString();
  const live={status:'incoming',landingAt:future,lootingEndsAt:future,totalRewards:3,claimedRewards:0,sectorName:'QA'};
  ui._rocketData.events=[live];ui.updateRocketBanner();assert.ok(classes.has('show'));assert.match(track.firstChild.textContent,/INCOMING/);
  ui._rocketData.events=[{...live,landingAt:past}];ui.updateRocketBanner();assert.ok(!classes.has('show'));assert.equal(track.innerHTML,'');
  ui._rocketData.events=[live];ui.updateRocketBanner();track.firstChild={textContent:'Unrelated announcement'};
  ui._rocketData.events=[];ui.updateRocketBanner();assert.ok(classes.has('show'));
  assert.equal(ui._isRocketEventVisible({...live,status:'looting',landingAt:past}),true);
  assert.equal(ui._isRocketEventVisible({...live,status:'looting',lootingEndsAt:past}),false);
  assert.equal(ui._isRocketEventVisible({...live,status:'looting',claimedRewards:3}),false);
  console.log('PASS rocket announcement hides overdue incoming/expired/exhausted events; clears own stale message and preserves unrelated announcements');
  const weather = { getWeatherModifiers: async id => ({ miningMod: id === 1 ? 100 : 0 }) };
  const satellites = { getStarlinkBoost: async id => id === 1 ? .1 : 0 };
  assert.equal(await regionMultiplier(1,weather,satellites),2.2);
  assert.equal(await regionMultiplier(2,weather,satellites),1);
  assert.equal(await weightedRegionMultiplier([{sector_id:1,tier:'frontier',cnt:1},{sector_id:2,tier:'frontier',cnt:99}],{frontier:1},weather,satellites),1.012);
  assert.equal(await weightedRegionMultiplier([{sector_id:1,tier:'core',cnt:1},{sector_id:2,tier:'frontier',cnt:1}],{core:2,frontier:1},weather,satellites),1.8);
  assert.equal(await regionMultiplier(null,weather,satellites),1);
  assert.equal(await regionMultiplier(1,{getWeatherModifiers:async()=>({miningMod:-25})},null),.75);
  assert.equal(await regionMultiplier(1,{getWeatherModifiers:async()=>{throw Error('unavailable');}},satellites),1.1);
  console.log('PASS local accounting: 1% ownership gets 1.2% combined effect, same-region overlap, tier weighting, negative effects, missing data');

  let writes=0, tracking=0;
  const forbidden = async()=>{ writes++; throw Error('Unexpected DB write'); };
  const db = { pool:{query:forbidden,connect:forbidden},getSetting:async(_key,fb)=>fb,getPPToGPRate:async()=>100 };
  const exploration=load('services/exploration.js',{'../db':db});
  const rockets=load('services/rocket.js',{'../db':db,'./telegram':{sendTelegramNotification:forbidden}});
  assert.equal((await exploration.spawnPOIs()).length,0);
  assert.match((await rockets.scheduleRocketEvent()).error,/retired/);
  await rockets.autoScheduleRocket();
  const routes={};const router={get(p,...h){routes['GET '+p]=h.at(-1);},post(p,...h){routes['POST '+p]=h.at(-1);}};
  load('routes/worldOpsRoutes.js',{
    express:{Router:()=>router},jsonwebtoken:{verify:()=>({wallet:'0xtest'})},'../db':db,
    '../utils/rateLimiters':{makeRateLimiter:()=>()=>{}},'../utils/apiHelpers':{requireAuth(){},getAuthWallet:()=> '0xtest'},
    '../services/weather':{getActiveWeather:async()=>[]},'../services/exploration':exploration,'../services/rocket':rockets,
    '../services/daily':{updateMissionProgress:()=>{tracking++;}},'../services/season':{addSeasonScore:()=>{tracking++;}}
  });
  const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(d){this.data=d;return this;}});
  for(const endpoint of ['/rockets/priority','/exploration/hint']){const res=response();await routes['POST '+endpoint]({body:{}},res);assert.equal(res.statusCode,410);}
  await routes['GET /weather']({headers:{authorization:'Bearer valid'}},response());
  assert.equal(tracking,0);assert.equal(writes,0);
  console.log('PASS retired supply/sales write nothing; authenticated weather GET creates no mission or season reward');

  // Test the actual late-claim handler, including an outstanding valid GP loot grant.
  let valid=true,committed=0,rolledBack=0,granted=0,lootType='gp',recorded;
  const lootClient={release(){},async query(sql,args){
    if(sql==='BEGIN')return {rows:[]};if(sql==='COMMIT'){committed++;return {rows:[]};}if(sql==='ROLLBACK'){rolledBack++;return {rows:[]};}
    if(sql.includes('SELECT * FROM rocket_events')){assert.match(sql,/looting_ends_at > NOW\(\)/);return {rows:valid?[{rewards_json:[{index:0,type:lootType,amount:20}]}]:[]};}
    if(sql.includes('UPDATE users')){granted+=args[0];return {rowCount:1};}if(sql.includes('INSERT INTO rocket_loot_claims'))recorded=args;return {rows:[],rowCount:1};
  }};
  const existing=load('services/rocket.js',{'../db':{...db,pool:{connect:async()=>lootClient}},'./telegram':{sendTelegramNotification:async()=>{}}});
  assert.equal((await existing.claimRocketLoot('0xtest',1,0)).success,true);assert.equal(granted,20);assert.equal(committed,1);
  valid=false;assert.match((await existing.claimRocketLoot('0xtest',1,0)).error,/not available/);assert.equal(granted,20);assert.equal(rolledBack,1);
  valid=true;lootType='pp';const converted=await existing.claimRocketLoot('0xtest',2,0);
  assert.equal(converted.reward.type,'gp');assert.equal(converted.reward.amount,2000);assert.equal(recorded[3],'gp');assert.equal(recorded[4],2000);
  console.log('PASS existing rocket grants preserved, expired claim denied, legacy PP payout returns and records actual GP');

  // Atomic payout model: staged grants publish only on COMMIT; ledger SELECT serializes retries.
  const parts=[{wallet:'top',damage_dealt:100,rewarded:false},{wallet:'low',damage_dealt:10,rewarded:false}];
  const paid={top:0,low:0},metal={top:0,low:0},titles={top:0,low:0};const locks=new Map();let failLow=true;
  const pool={async query(sql){
    if(sql.includes('SELECT wallet, damage_dealt'))return {rows:parts.map(p=>({...p}))};
    if(sql.includes("we.status='defeated'"))return {rows:parts.some(p=>!p.rewarded)?[{id:1}]:[]};
    if(sql.includes('WHERE status IN'))return {rows:[]};throw Error('Unexpected pool query: '+sql);
  },async connect(){let staged=[],unlock;return {release(){},async query(sql,args){
    if(sql==='BEGIN'){staged=[];return {rows:[]};}
    if(sql==='COMMIT'){staged.forEach(fn=>fn());if(unlock)unlock();unlock=null;return {rows:[]};}
    if(sql==='ROLLBACK'){staged=[];if(unlock)unlock();unlock=null;return {rows:[]};}
    if(sql.includes('SELECT wallet FROM')){
      const wallet=args[1];const prior=locks.get(wallet)||Promise.resolve();let release;const current=new Promise(r=>release=r);locks.set(wallet,current);await prior;unlock=release;
      return {rows:[],rowCount:parts.find(p=>p.wallet===wallet&&!p.rewarded)?1:0};
    }
    if(sql.includes('UPDATE users')){staged.push(()=>paid[args[0]]+=args[1]);return {rowCount:1};}
    if(sql.includes('INSERT INTO user_resource_inventory')){
      if(args[0]==='low'&&failLow){failLow=false;throw Error('Injected mineral failure');}
      if(args[1]==='ancient_metal')staged.push(()=>metal[args[0]]+=args[2]);return {rowCount:1};
    }
    if(sql.includes('INSERT INTO user_titles')){assert.match(sql,/user_wallet.*title_code.*earned_at/);staged.push(()=>titles[args[0]]++);return {rowCount:1};}
    if(sql.includes('UPDATE world_event_participants')){staged.push(()=>parts.find(p=>p.wallet===args[1]).rewarded=true);return {rowCount:1};}
    throw Error('Unexpected transaction query: '+sql);
  }};}};
  const boss=load('services/worldEvents.js',{'../db':{pool,getSetting:async(_k,fb)=>fb,ensureUser:async()=>{},logGPActivity:async()=>{}},'./fleetOccupancy':{assertFleetsNotMining:async()=>{}},'./battleScheduler':{}});
  await boss.distributeRewards(1,'defeated');assert.equal(paid.top,200);assert.equal(paid.low,0);assert.equal(parts[1].rewarded,false);
  await boss.settleExpiredEvents();assert.equal(paid.top,200);assert.equal(paid.low,200);assert.equal(metal.top,5);assert.equal(metal.low,0);assert.equal(titles.top,1);assert.equal(titles.low,0);
  await Promise.all([boss.distributeRewards(1,'defeated'),boss.distributeRewards(1,'defeated')]);assert.deepEqual(paid,{top:200,low:200});
  parts.forEach(p=>p.rewarded=false);paid.top=0;paid.low=0;metal.top=0;titles.top=0;
  await Promise.all([boss.distributeRewards(1,'defeated'),boss.distributeRewards(1,'defeated')]);assert.deepEqual(paid,{top:200,low:200});assert.equal(metal.top,5);assert.equal(titles.top,1);
  console.log('PASS boss failed payout rolls back, defeated-event scheduler retries, stable top award, concurrent retry pays once');
  let bossBusy=true,battleCreated=0,reservationSeen=false,cooldownReserved=false,unlocked=false;
  const sortieClient={release(){},async query(sql,args){
    if(sql==='BEGIN'||sql==='ROLLBACK'||sql==='COMMIT')return {rows:[]};
    if(sql.includes('SELECT * FROM world_events'))return {rows:[{id:1,status:'active',ends_at:new Date(Date.now()+60000),fleet_id:20,sector_id:1}]};
    if(sql.includes('SELECT id, is_in_battle, current_battle_id FROM fleets'))return {rows:[{id:20,is_in_battle:bossBusy}]};
    if(sql.includes('SELECT f.id, f.owner_wallet'))return {rows:[{id:10,is_npc:false,is_in_battle:false,alive_ships:5}]};
    if(sql.includes('SELECT last_battle_at'))return {rows:[]};
    if(sql.includes('INSERT INTO fleet_battles')){battleCreated++;return {rows:[{id:99}]};}
    if(sql.includes('UPDATE fleets SET is_in_battle = true')){assert.deepEqual(Array.from(args[0]),[10,20]);assert.equal(args[1],99);reservationSeen=true;}
    if(sql.includes('INSERT INTO world_event_participants')){assert.match(sql,/last_battle_at/);cooldownReserved=true;}
    return {rows:[],rowCount:1};
  }};
  const sortiePool={connect:async()=>sortieClient,async query(sql,args){assert.match(sql,/WHERE current_battle_id = \$1/);assert.equal(args[0],99);unlocked=true;return {rowCount:2};}};
  const sorties=load('services/worldEvents.js',{'../db':{pool:sortiePool,getSetting:async(_k,fb)=>fb,ensureUser:async()=>{}},'./fleetOccupancy':{assertFleetsNotMining:async()=>{}},'./battleScheduler':{runBattle:async()=>{throw Error('Injected dispatch failure');}}});
  await assert.rejects(sorties.engageEvent(1,'player',10),/FLEET_BUSY/);assert.equal(battleCreated,0);
  bossBusy=false;await assert.rejects(sorties.engageEvent(1,'player',10),/Injected dispatch failure/);
  assert.equal(battleCreated,1);assert.ok(reservationSeen&&cooldownReserved&&unlocked);
  console.log('PASS busy boss rejects before battle insert; accepted sortie reserves both fleets and cooldown, failure clears only own reservation');

}
main().catch(e=>{console.error(e);process.exitCode=1;});

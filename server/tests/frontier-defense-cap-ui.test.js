'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const runner=fs.readFileSync(path.join(root,'server/tools/command_center_regression.js'),'utf8'),moduleFixture={exports:{}};
vm.runInNewContext(runner.slice(0,runner.indexOf('async function main()'))+'\nmodule.exports=harness;',{module:moduleFixture,require,__dirname:path.join(root,'server/tools'),URL,console,setImmediate});
const saved={node_id:11,wallet:'newcomer',owner_key:'guild:5',fleet_id:41,preset:{formation:'sphere',movement:'flank',shipIds:[101,102,103]},updated_at:'2026-10-21T01:00:00Z'};
function board({cap=16,batches=4,defenses=[saved],cargo=[]}={}){return {wallet:'newcomer',ownerKey:'guild:5',mode:'guild_front',scope:'guild',nodes:[{id:11,node_type:'resource',name:'Mine',owner_key:'guild:5',stored_batches:batches,production_at:new Date().toISOString()}],stocks:[],cargo,battles:[],score:{},objective:{},balance:{batchCap:cap,batchMinutes:30},defenses};}
function fixture(value=board()) {const f=moduleFixture.exports();f.window.walletState={address:'newcomer'};f.router=c=>c.url==='/api/frontier/state'?f.response(value):null;return f;}

test('full production uses the current server cap, offers collection and hides the misleading next clock',async()=>{
  for(const [cap,batches] of [[16,16],[3,3],[16,17]]){
    const f=fixture(board({cap,batches}));await f.open('front');
    assert.match(f.body.innerHTML,/Storage full · collect production\. Excess batches are not stored\./);
    assert.doesNotMatch(f.body.innerHTML,/Next batch /);
    assert.match(f.body.innerHTML,new RegExp('Stored batches '+batches+' / '+cap));
    assert.match(f.body.innerHTML,/data-cc="collect"/);
    await f.click('collect',11);assert.equal(f.calls.find(c=>c.method==='POST').url,'/api/frontier/production/collect');
  }
});

test('four batches below a sixteen-batch cap still show the normal next production time',async()=>{
  const f=fixture(board({cap:16,batches:4}));await f.open('front');
  assert.match(f.body.innerHTML,/Stored batches 4 \/ 16/);assert.match(f.body.innerHTML,/Next batch /);assert.doesNotMatch(f.body.innerHTML,/Storage full/);
});

test('the actual saved fleet and preset are shown without promising availability from incomplete client evidence',async()=>{
  const f=fixture();await f.open('front');
  assert.match(f.body.innerHTML,/Saved defense fleet: SERVER FLEET/);
  assert.match(f.body.innerHTML,/data-defense-status="saved-unverified"/);
  assert.match(f.body.innerHTML,/Formation sphere/);assert.match(f.body.innerHTML,/Maneuver flank/);assert.match(f.body.innerHTML,/3 ships/);
  assert.match(f.body.innerHTML,/availability is rechecked when attacked/);
  assert.match(f.body.innerHTML,/mining, carrying cargo/);assert.match(f.body.innerHTML,/surviving ship IDs differ/);
  assert.match(f.body.innerHTML,/Saved formation and movement are applied when it is eligible/);
});

test('known battle, moving cargo, empty or missing owned fleet show unavailable; guildmate fleets stay unverified',async()=>{
  for(const reason of ['battle','cargo','empty','missing']){
    const value=board({cargo:reason==='cargo'?[{fleet_id:41,status:'moving',resource_code:'iron_dust',amount:20,arrives_at:new Date().toISOString()}]:[]}),f=fixture(value);
    if(reason==='battle')f.fleet.is_in_battle=true;
    if(reason==='empty')f.fleet.ships_alive=0;
    if(reason==='missing')f.router=c=>c.url==='/api/frontier/state'?f.response(value):c.url==='/api/fleets'?f.response({fleets:[]}):null;
    await f.open('front');assert.match(f.body.innerHTML,/data-defense-status="unavailable"/);assert.match(f.body.innerHTML,/NPC fallback/);
  }
  const f=fixture(board({defenses:[{...saved,wallet:'guildmate',fleet_id:99}]}));await f.open('front');
  assert.match(f.body.innerHTML,/Saved defense fleet: #99/);assert.match(f.body.innerHTML,/data-defense-status="saved-unverified"/);
});

test('old controller presets are not presented as the current owner defense, and new copy is inline in seven languages',async()=>{
  const stale=fixture(board({defenses:[{...saved,owner_key:'guild:other'}]}));await stale.open('front');
  assert.match(stale.body.innerHTML,/data-defense-status="not-saved"/);assert.doesNotMatch(stale.body.innerHTML,/Saved defense fleet/);
  for(const [index,lang] of ['en','ko','ja','zh','id','vi','th'].entries()){
    const f=fixture(board({batches:16}));f.context.LANG=lang;f.context.tl=(...strings)=>strings[index]||strings[0];await f.open('front');
    assert.match(f.body.innerHTML,/data-defense-status="saved-unverified"/);assert.doesNotMatch(f.body.innerHTML,/Next batch /);
    if(index){assert.doesNotMatch(f.body.innerHTML,/Storage full|Saved defense fleet|availability is rechecked/);}
  }
});

test('the existing real service saves a preset and already returns it unchanged in getState',async()=>{
  let defense;const node={id:11,node_type:'resource',front_key:'public',owner_key:'guild:5',production_at:new Date(Date.now()+60000).toISOString(),stored_batches:16};
  const client={release(){},async query(sql,args){
    if(/^(BEGIN|COMMIT|ROLLBACK)/.test(sql))return {rows:[]};
    if(sql.startsWith('SELECT wallet_address FROM users'))return {rows:[{wallet_address:'newcomer'}]};
    if(sql.startsWith('SELECT guild_id,role'))return {rows:[{guild_id:5,role:'member'}]};
    if(sql.startsWith('SELECT * FROM frontier_nodes'))return {rows:[node]};
    if(sql.startsWith('SELECT * FROM fleets'))return {rows:[{id:41,owner_wallet:'newcomer',formation:'sphere',movement:'flank'}]};
    if(sql.startsWith('SELECT 1 FROM ships'))return {rows:[{yes:1}],rowCount:1};
    if(sql.startsWith('SELECT id FROM ships'))return {rows:[{id:101},{id:102},{id:103}]};
    if(sql.startsWith('INSERT INTO frontier_defense(')){defense={node_id:args[0],wallet:args[1],owner_key:args[2],fleet_id:args[3],preset:JSON.parse(args[4])};return {rows:[],rowCount:1};}
    if(sql.startsWith('INSERT INTO frontier_defense_events'))return {rows:[{id:1}]};
    if(sql.startsWith('SELECT id FROM sectors'))return {rows:[{id:1}]};
    if(sql.startsWith('SELECT * FROM frontier_defense'))return {rows:defense?[defense]:[]};
    if(sql.startsWith('INSERT INTO frontier_nodes')||sql.includes('FROM frontier_')||sql.startsWith('UPDATE frontier_nodes'))return {rows:[]};
    throw Error('Uninjected SQL: '+sql);
  }};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'server/services/frontierIndustry.js'),'utf8'),{module,console,require(name){if(name==='crypto')return crypto;if(name==='../db')return {pool:{connect:async()=>client}};if(name==='./fleetOccupancy')return {assertFleetsNotMining:async()=>{}};throw Error(name);}});
  const service=module.exports;
  const result=await service.saveDefense('newcomer',11,41,{riskConsent:true});
  assert.deepEqual([...result.preset.shipIds],[101,102,103]);
  const state=await service.getState('newcomer');
  assert.equal(state.defenses.length,1);assert.equal(state.defenses[0].fleet_id,41);assert.equal(state.defenses[0].preset.formation,'sphere');
  assert.equal(state.balance.batchCap,16);assert.equal(state.nodes[0].stored_batches,16);
});

test('the actual defender selector falls back only for the documented eligibility checks and restores the saved tactic',async()=>{
  const source=fs.readFileSync(path.join(root,'server/services/frontierIndustry.js'),'utf8');
  const fragment=source.slice(source.indexOf('async function defender('),source.indexOf('async function declare('));
  for(const scenario of ['ready','FLEET_IN_BATTLE','FLEET_MINING','FLEET_TRANSPORTING','FLEET_EMPTY','FLEET_NOT_FOUND','changed-ships','changed-owner']){
    const writes=[],sandbox={JSON,Number,context:async()=>({ownerKey:scenario==='changed-owner'?'guild:other':'guild:5',wallet:'newcomer'}),
      fleet:async()=>{if(scenario.startsWith('FLEET_'))throw Error(scenario);return {id:41};},
      npcDefender:async()=>({npc:true})};
    vm.createContext(sandbox);vm.runInContext(fragment,sandbox);
    const client={async query(sql,args){
      if(sql.startsWith('SELECT * FROM frontier_defense'))return {rows:[{...saved}]};
      if(sql.startsWith('SELECT id FROM ships'))return {rows:(scenario==='changed-ships'?[101,102]:[101,102,103]).map(id=>({id}))};
      if(sql.startsWith('UPDATE fleets')){writes.push(args);return {rows:[]};}
      throw Error(sql);
    }};
    const result=await sandbox.defender(client,{id:11,front_key:'public',owner_key:'guild:5'},99);
    if(scenario==='ready'){assert.equal(result.fleet.id,41);assert.deepEqual([...writes[0]],[41,'sphere','flank']);}
    else{assert.equal(result.npc,true,scenario);assert.equal(writes.length,0);}
  }
});

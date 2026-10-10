#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid/invalid');
if(url.hostname!=='localhost'||url.pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Exact local disposable upgrade DB required');
const {pool}=require('../db'),frontier=require('../services/frontierIndustry'),engine=require('../services/battleEngine');
const settings=['full_loss_mode','full_loss_season_active'];let original=[],settingsCaptured=false;
async function setting(key,value){await pool.query('INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,JSON.stringify(value)]);}
async function commander(optin,strong=true){
 const wallet='0x'+crypto.randomBytes(20).toString('hex');await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,is_ai,is_test_account,full_loss_optin) VALUES($1,'Frontier consent regression','mcc',10000,false,true,$2)",[wallet,optin]);
 const guild=(await pool.query('INSERT INTO guilds(name,tag,leader_wallet) VALUES($1,$2,$3) RETURNING id',['Consent '+crypto.randomBytes(8).toString('hex'),crypto.randomBytes(2).toString('hex'),wallet])).rows[0].id;
 await pool.query("INSERT INTO guild_members(guild_id,wallet,role) VALUES($1,$2,'leader')",[guild,wallet]);
 const fleetId=(await pool.query("INSERT INTO fleets(owner_wallet,name,auto_retreat_pct) VALUES($1,'Consent escort',0) RETURNING id",[wallet])).rows[0].id;
 const type=(await pool.query("SELECT code,base_hp FROM ship_types WHERE code='mcc_frg' AND is_active")).rows[0];assert.ok(type);
 const ship=(await pool.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,is_flagship,bonus_atk) VALUES($1,$2,$3,$4,$4,true,$5) RETURNING id,max_hp',[fleetId,wallet,type.code,type.base_hp,strong?1000000:0])).rows[0];
 return {wallet,guild,fleetId,shipId:ship.id,maxHp:Number(ship.max_hp),ownerKey:'guild:'+guild};
}
async function hull(id){return (await pool.query('SELECT is_alive,current_hp,destroyed_at FROM ships WHERE id=$1',[id])).rows[0];}
async function raid(mode,atkOpt,defOpt,season=false){
 await setting('full_loss_mode',mode);await setting('full_loss_season_active',season);
 const atk=await commander(atkOpt),def=await commander(defOpt,false);
 await pool.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'mine','iron_dust',10)",[def.ownerKey]);
 const cargo=(await frontier.startCargo(def.wallet,def.fleetId,10)).cargo;
 await pool.query("UPDATE frontier_cargo SET started_at=NOW()-INTERVAL '3 minutes',arrives_at=NOW()+INTERVAL '7 minutes' WHERE id=$1",[cargo.id]);
 const declared=await frontier.attackCargo(atk.wallet,cargo.id,atk.fleetId,{riskConsent:true,dispatch:false});
 const result=await engine.simulateBattle(declared.battleId);assert.equal(result.winner_side,'atk');assert.ok(result.stats.by_ship.some(s=>String(s.ship_id)===String(def.shipId)&&s.is_alive===false));
 // The simulation itself must not mutate persistent hulls before settlement.
 assert.equal((await hull(def.shipId)).is_alive,true);assert.equal(Number((await hull(def.shipId)).current_hp),def.maxHp);
 const loss=atkOpt&&defOpt&&(mode==='always'||mode==='optin'||(mode==='seasonal'&&season));
 await engine.applyBattleResults(declared.battleId,result);
 const first=await hull(def.shipId);assert.equal(first.is_alive,!loss);assert.equal(Number(first.current_hp),loss?0:Math.max(1,Math.round(def.maxHp*.15)));assert.equal(!!first.destroyed_at,!!loss);
 const saved=(await pool.query('SELECT battle_summary FROM fleet_battles WHERE id=$1',[declared.battleId])).rows[0].battle_summary;assert.equal(saved.combat_policy.permanent_loss,!!loss);assert.equal(saved.combat_policy.frontier_mutual_optin,atkOpt&&defOpt);
 const settled=await frontier.settleBattle(declared.battleId);assert.equal(settled.result,'raided');assert.equal((await pool.query('SELECT status FROM frontier_cargo WHERE id=$1',[cargo.id])).rows[0].status,'raided');assert.equal(Number((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'",[atk.ownerKey])).rows[0].quantity),5);
 const repeat=await engine.applyBattleResults(declared.battleId,result);assert.equal(repeat.skipped,true);await frontier.settleBattle(declared.battleId);assert.deepEqual(await hull(def.shipId),first);assert.equal(Number((await pool.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code='iron_dust'",[atk.ownerKey])).rows[0].quantity),5);
 console.log('PASS actual cargo PvP '+declared.battleId+': '+mode+' season='+season+' optins='+atkOpt+'/'+defOpt+' loss='+loss+'; simulated kill, first/repeated hull settlement, unchanged exactly-once cargo transfer');
}
async function main(){
 assert.equal((await pool.query('SELECT current_database() db')).rows[0].db,'codex_occupy_review_upgrade_20261010');original=(await pool.query('SELECT key,value FROM settings WHERE key=ANY($1::text[])',[settings])).rows;settingsCaptured=true;
 for(const scenario of [['always',false,false],['always',true,false],['always',false,true],['always',true,true],['off',true,true],['optin',false,false],['optin',true,false],['optin',true,true],['seasonal',true,true,false],['seasonal',true,true,true]])await raid(...scenario);
 // Trust boundaries: a forged summary with no registered row remains ordinary policy, and participant wallets cannot substitute for real hull owners.
 const source=fs.readFileSync(path.join(__dirname,'../services/battleEngine.js'),'utf8');const helper=source.slice(source.indexOf('async function getRegisteredFrontierLossConsent('),source.indexOf('async function getSafeTrainingMode('));const c=vm.createContext({String,Set});vm.runInContext(helper,c);
 const base=[{attacker_wallet:'a',side:'atk',wallet_address:'a',owner_wallet:'a',user_wallet:'a',is_ai:false,full_loss_optin:true},{attacker_wallet:'a',side:'def',wallet_address:'b',owner_wallet:'b',user_wallet:'b',is_ai:false,full_loss_optin:true}];
 const client=rows=>({query:async sql=>({rows:sql.includes('to_regclass')?[{name:'frontier_battles'}]:rows})});assert.equal(await c.getRegisteredFrontierLossConsent(client([]),1),null);assert.equal(await c.getRegisteredFrontierLossConsent(client(base),1),true);
 for(const changed of [{wallet_address:'forged'},{owner_wallet:'forged'},{user_wallet:null},{is_ai:true},{full_loss_optin:false},{side:'atk'},{owner_wallet:'a',user_wallet:'a',wallet_address:'a'}])assert.equal(await c.getRegisteredFrontierLossConsent(client([base[0],{...base[1],...changed}]),1),false);
 console.log('PASS registry absence, participant/owner mismatch, unknown owner, AI participant, one opt-in and same-owner fail safely');
 await setting('full_loss_mode','always');await setting('full_loss_season_active',false);const owner=await commander(true);const board=await frontier.getState(owner.wallet,{training:true});const node=board.nodes.find(n=>n.node_type==='resource');const npcBattle=await frontier.attackNode(owner.wallet,node.id,owner.fleetId,{training:true,dispatch:false});const result=await engine.simulateBattle(npcBattle.battleId);assert.equal(result.winner_side,'atk');await engine.applyBattleResults(npcBattle.battleId,result);
 const ships=(await pool.query("SELECT s.is_alive,s.current_hp,s.max_hp FROM fleet_battle_participants p JOIN ships s ON s.fleet_id=p.fleet_id WHERE p.battle_id=$1 AND p.side='def'",[npcBattle.battleId])).rows;assert.ok(ships.length);assert.ok(ships.every(s=>s.is_alive&&Number(s.current_hp)===Math.round(Number(s.max_hp)*.15)));const policy=(await pool.query('SELECT battle_summary FROM fleet_battles WHERE id=$1',[npcBattle.battleId])).rows[0].battle_summary.combat_policy;assert.equal(policy.safe_training_mode,'frontier_npc');assert.equal(policy.permanent_loss,false);console.log('PASS registered NPC frontier remains safe at 15% hull HP under global always');
}
main().finally(async()=>{if(settingsCaptured)for(const key of settings){const row=original.find(r=>r.key===key);if(row)await pool.query('UPDATE settings SET value=$2::jsonb WHERE key=$1',[key,JSON.stringify(row.value)]);else await pool.query('DELETE FROM settings WHERE key=$1',[key]);}await pool.end();}).catch(e=>{console.error(e);process.exitCode=1;});

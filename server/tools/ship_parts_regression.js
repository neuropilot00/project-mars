#!/usr/bin/env node
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
if(new URL(process.env.DATABASE_URL).pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Disposable upgrade review database required');
process.env.JWT_SECRET='disposable-part-regression';
const {pool}=require('../db');
const {applyShipPartStats,effects,loadShipPartEffects}=require('../services/shipParts');
const app=require('express')();app.use(require('express').json());app.use('/api/ship-parts',require('../routes/shipParts'));
let server,base;
async function call(w,url,body){const options={headers:{}};if(w)options.headers.authorization='Bearer '+require('jsonwebtoken').sign({wallet_address:w},process.env.JWT_SECRET);if(body){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}const res=await fetch(base+url,options);return {status:res.status,data:await res.json()};}
async function user(){const w='0x'+crypto.randomBytes(20).toString('hex');await pool.query("INSERT INTO users(wallet_address,nickname,faction_code,gp_balance,rank_level,level) VALUES($1,'Part Regression','mcc',100,20,20)",[w]);return w;}
async function funds(w,gp=10000,iron=1000,plate=100){await pool.query('UPDATE users SET gp_balance=$2 WHERE wallet_address=$1',[w,gp]);for(const [code,qty] of [['iron_dust',iron],['hull_plate',plate]])await pool.query('INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,$3 FROM resources WHERE code=$2 ON CONFLICT(wallet_address,resource_id) DO UPDATE SET quantity=$3',[w,code,qty]);}
async function balance(w){return Number((await pool.query('SELECT gp_balance FROM users WHERE wallet_address=$1',[w])).rows[0].gp_balance);}
async function main(){
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port+'/api/ship-parts';
 const w=await user(),other=await user();await funds(w,100,20,2);
 assert.equal((await call(null,'')).status,401);
 const craft=await Promise.all([call(w,'/craft',{part_code:'rail_amp'}),call(w,'/craft',{part_code:'rail_amp'})]);
 assert.equal(craft.filter(r=>r.status===200).length,1);assert.equal(craft.filter(r=>r.status===402).length,1);assert.equal(await balance(w),0);
 const p=craft.find(r=>r.status===200).data.part;
 assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ship_part_cards WHERE wallet_address=$1',[w])).rows[0].n,1);
 await funds(w,1000,100,0);const before=await balance(w);assert.equal((await call(w,'/craft',{part_code:'ion_drive'})).data.error,'INSUFFICIENT_MINERALS');assert.equal(await balance(w),before);
 assert.equal(Number((await pool.query("SELECT quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code='iron_dust'",[w])).rows[0].quantity),100);
 await funds(w);const upgrades=await Promise.all([call(w,'/'+p.id+'/upgrade',{expected_level:0}),call(w,'/'+p.id+'/upgrade',{expected_level:0})]);
 assert.equal(upgrades.filter(r=>r.status===200).length,1);assert.equal(upgrades.find(r=>r.status!==200).data.error,'LEVEL_CHANGED');assert.equal(await balance(w),9850);
 assert.equal((await call(w,'/'+p.id+'/upgrade',{expected_level:1})).status,200);assert.equal((await call(w,'/'+p.id+'/upgrade',{expected_level:2})).status,200);
 assert.equal((await call(w,'/'+p.id+'/upgrade',{expected_level:3})).data.error,'MAX_LEVEL');assert.equal(await balance(w),9400);
 const materialBalances=(await pool.query("SELECT r.code,i.quantity FROM user_resource_inventory i JOIN resources r ON r.id=i.resource_id WHERE i.wallet_address=$1 AND r.code IN ('iron_dust','hull_plate')",[w])).rows;
 assert.equal(Number(materialBalances.find(r=>r.code==='iron_dust').quantity),880);assert.equal(Number(materialBalances.find(r=>r.code==='hull_plate').quantity),88);
 const fleet=(await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'Parts fleet') RETURNING id",[w])).rows[0].id;
 const hull=(await pool.query("INSERT INTO ships(owner_wallet,fleet_id,ship_type_code,current_hp,max_hp,bonus_atk,bonus_def,bonus_speed,quality) SELECT $1,$2,code,base_hp,base_hp,20,10,0.1,'legendary' FROM ship_types WHERE code='mcc_frg' RETURNING *",[w,fleet])).rows[0];
 const duplicate=(await call(w,'/craft',{part_code:'burst_lens'})).data.part;
 const fits=await Promise.all([call(w,'/'+p.id+'/equip',{ship_id:hull.id}),call(w,'/'+duplicate.id+'/equip',{ship_id:hull.id})]);
 assert.equal(fits.filter(r=>r.status===200).length,1);assert.equal(fits.find(r=>r.status!==200).data.error,'SLOT_OCCUPIED');
 const equipped=fits.find(r=>r.status===200).data.part,spare=String(equipped.id)===String(p.id)?duplicate:p;
 assert.equal((await call(other,'/'+spare.id+'/equip',{ship_id:hull.id,wallet_address:w})).status,404);
 let state=(await call(w,'')).data;assert.equal(state.catalog.length,32);for(const type of state.catalog)assert.ok(fs.existsSync(path.resolve(__dirname,'../../assets/ships/'+type.code+'.png')));
 const mods=await loadShipPartEffects([hull.id]),type=(await pool.query("SELECT * FROM ship_types WHERE code='mcc_frg'")).rows[0],view=applyShipPartStats({...hull,...type},mods[hull.id]);
 assert.equal(view.bonus_atk,20);assert.equal(view.quality,'legendary');assert.equal(view.max_hp,hull.max_hp);assert.equal(view.base_atk+20,Math.round((type.base_atk+20)*(1+mods[hull.id][0].atk_pct/100)));
 for(const code of ['rail_amp','burst_lens','reactive_plate','layered_plate','ion_drive','vector_drive']){const e=effects({part_code:code,level:3});assert.ok(Object.values(e).includes(12));assert.ok(Object.values(e).includes(-7));}
 const armor=(await call(w,'/craft',{part_code:'reactive_plate'})).data.part;
 // Both preparing participants and fleet flags reserve the hull before a combat snapshot.
 const battle=(await pool.query("INSERT INTO fleet_battles(battle_type,status) VALUES('pvp_duel','preparing') RETURNING id")).rows[0].id;
 await pool.query("INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side) VALUES($1,$2,$3,'atk')",[battle,fleet,w]);
 assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).data.error,'SHIP_IN_BATTLE');assert.equal((await call(w,'/'+equipped.id+'/unequip',{})).data.error,'SHIP_IN_BATTLE');
 await pool.query("UPDATE fleet_battles SET status='ended' WHERE id=$1",[battle]);await pool.query('UPDATE fleets SET is_in_battle=true WHERE id=$1',[fleet]);assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).data.error,'SHIP_IN_BATTLE');await pool.query('UPDATE fleets SET is_in_battle=false WHERE id=$1',[fleet]);
 const mining=(await pool.query("INSERT INTO ship_mining_jobs(wallet_address,fleet_id,ends_at) VALUES($1,$2,NOW()+INTERVAL '1 hour') RETURNING id",[w,fleet])).rows[0].id;
 assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).data.error,'SHIP_MINING');await pool.query("UPDATE ship_mining_jobs SET status='cancelled' WHERE id=$1",[mining]);
 const cargo=(await pool.query("INSERT INTO frontier_cargo(wallet,owner_key,fleet_id,front_key,resource_code,amount,arrives_at) VALUES($1,$3,$2,'public','iron_dust',1,NOW()+INTERVAL '1 hour') RETURNING id",[w,fleet,w])).rows[0].id;
 assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).data.error,'SHIP_TRANSPORTING');await pool.query("UPDATE frontier_cargo SET status='cancelled' WHERE id=$1",[cargo]);
 await pool.query('UPDATE ships SET is_market_listed=true WHERE id=$1',[hull.id]);assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).data.error,'SHIP_LISTED_FOR_SALE');await pool.query('UPDATE ships SET is_market_listed=false WHERE id=$1',[hull.id]);
 assert.equal((await call(w,'/'+armor.id+'/equip',{ship_id:hull.id})).status,200);
 await pool.query('UPDATE ships SET owner_wallet=$1,fleet_id=NULL WHERE id=$2',[other,hull.id]);assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ship_part_cards WHERE ship_id=$1 AND wallet_address=$2',[hull.id,other])).rows[0].n,2);assert.equal((await call(w,'/'+equipped.id+'/unequip',{})).status,404);
 await pool.query("UPDATE ships SET is_alive=false,current_hp=0,destroyed_at=NOW(),destroyed_reason='battle' WHERE id=$1",[hull.id]);assert.equal((await pool.query('SELECT COUNT(*)::int n FROM ship_part_cards WHERE ship_id=$1',[hull.id])).rows[0].n,0);
 const preserved=(await pool.query('SELECT quality,bonus_atk,bonus_def,bonus_speed FROM ships WHERE id=$1',[hull.id])).rows[0];assert.equal(preserved.quality,'legendary');assert.equal(preserved.bonus_atk,20);
 console.log('PASS HTTP JWT identity; concurrent craft affordable once; material rollback; expected-level concurrent upgrade spends once; +3 cap; unique concurrent fitting slot; all32 art; bounded effects retain paid bonuses/HP; preparing/active/mining/cargo/market guards; sale transfers2 parts; destruction removes parts.');
 console.log('Disposable fixtures:',w,other);
}
main().then(async()=>{await pool.end();server.close();}).catch(async e=>{console.error(e);await pool.end();if(server)server.close();process.exitCode=1;});

#!/usr/bin/env node
const assert=require('node:assert/strict'),crypto=require('node:crypto');
if(new URL(process.env.DATABASE_URL).pathname!=='/codex_occupy_review_upgrade_20261010')throw Error('Disposable upgrade review database required');
const {pool}=require('../db');
const {listMyFleets,getFleetDetail}=require('../services/fleet');
async function main(){
 const w='0x'+crypto.randomBytes(20).toString('hex');
 await pool.query("INSERT INTO users(wallet_address,nickname,faction_code) VALUES($1,'Fleet HP Regression','mcc')",[w]);
 const upgraded=(await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'Upgraded HP') RETURNING id",[w])).rows[0].id;
 const ordinary=(await pool.query("INSERT INTO fleets(owner_wallet,name) VALUES($1,'Ordinary HP') RETURNING id",[w])).rows[0].id;
 await pool.query("INSERT INTO ships(owner_wallet,fleet_id,ship_type_code,max_hp,bonus_hp,current_hp,is_flagship) VALUES($1,$2,'mcc_frg',1000,200,1200,true)",[w,upgraded]);
 await pool.query("INSERT INTO ships(owner_wallet,fleet_id,ship_type_code,max_hp,bonus_hp,current_hp,is_alive) VALUES($1,$2,'mcc_frg',1000,500,0,false)",[w,upgraded]);
 await pool.query("INSERT INTO ships(owner_wallet,fleet_id,ship_type_code,max_hp,bonus_hp,current_hp,is_flagship) VALUES($1,$2,'mcc_frg',1000,NULL,1000,true)",[w,ordinary]);
 const fleets=await listMyFleets(w),u=fleets.find(f=>String(f.id)===String(upgraded)),o=fleets.find(f=>String(f.id)===String(ordinary));
 assert.equal(u.total_hp,1200);assert.equal(u.total_max_hp,1200);assert.equal(u.ships_alive,1);assert.equal(u.ships_lost,1);assert.equal(u.flagship.current_hp,1200);assert.equal(u.flagship.max_hp,1200);
 assert.equal(o.total_hp,1000);assert.equal(o.total_max_hp,1000);assert.equal(o.flagship.max_hp,1000);
 const detail=await getFleetDetail(upgraded,w),normal=await getFleetDetail(ordinary,w);
 assert.equal(detail.total_hp,1200);assert.equal(detail.total_max_hp,1200);assert.equal(detail.ships_alive,1);assert.equal(detail.ships.length,1);assert.equal(detail.ships[0].max_hp,1000);assert.equal(detail.ships[0].bonus_hp,200);
 assert.equal(normal.total_hp,1000);assert.equal(normal.total_max_hp,1000);assert.equal(normal.ships[0].max_hp,1000);
 console.log('PASS real DB fleet list/detail/flagship: upgraded hull 1200/1200; base max_hp and bonus_hp unchanged; destroyed hull excluded; ordinary/null-bonus hull remains1000/1000. Disposable fixture:',w);
}
main().then(()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exitCode=1;});

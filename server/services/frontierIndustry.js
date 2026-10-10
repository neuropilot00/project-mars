'use strict';
// Industrial control is a separate right: never changes claims/pixels/governance.
const crypto = require('crypto');
const { pool } = require('../db');
const { assertFleetsNotMining } = require('./fleetOccupancy');
const BALANCE = Object.freeze({ batchMinutes:30, batchCap:4, ironPerBatch:20, platePerBatch:4, cargoMinutes:10, cargoCap:100, warehouseCap:10000, dailyAttacks:3, protectionMinutes:30 });
const integer=(v,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('INVALID_INTEGER');return n;};
const lower=v=>String(v||'').trim().toLowerCase();
function eventId(value){const h=crypto.createHash('sha256').update(value).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
function track(c,wallet,eventName,id,metadata){c.frontierEvents.push({wallet,sessionId:eventId('frontier-session:'+lower(wallet)),eventName,eventKey:eventId(eventName+':'+id),metadata});}
async function transaction(fn){const c=await pool.connect();c.frontierEvents=[];let result,events;try{await c.query('BEGIN');result=await fn(c);await c.query('COMMIT');events=c.frontierEvents;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}for(const event of events){try{await require('./productAnalytics').recordProductEvent(event);}catch(e){console.error('[frontier] analytics:',e.message);}}return result;}
async function context(c,wallet,options={}){
 const user=(await c.query('SELECT wallet_address FROM users WHERE LOWER(wallet_address)=$1',[lower(wallet)])).rows[0];if(!user)throw Error('USER_NOT_FOUND');
 const gm=(await c.query('SELECT guild_id FROM guild_members WHERE LOWER(wallet)=$1 FOR SHARE',[lower(wallet)])).rows[0];
 return {wallet:user.wallet_address,ownerKey:gm&&!options.training?'guild:'+gm.guild_id:'wallet:'+lower(wallet),frontKey:gm&&!options.training?'public':'solo:'+lower(wallet),guildId:gm&&!options.training?Number(gm.guild_id):null,training:options.training===true};
}
async function ensureBoard(c,ctx){
 const sector=(await c.query("SELECT id FROM sectors WHERE tier='frontier' ORDER BY id LIMIT 1")).rows[0];if(!sector)throw Error('FRONTIER_SECTOR_MISSING');
 for(const [type,name] of [['resource','Ares 광산'],['logistics','Phobos 물류'],['repair','Deimos 정비']])await c.query('INSERT INTO frontier_nodes(front_key,node_type,name,sector_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[ctx.frontKey,type,name,sector.id]);
}
async function checkedNode(c,ctx,id){const n=(await c.query('SELECT * FROM frontier_nodes WHERE id=$1 AND front_key=$2 FOR UPDATE',[integer(id),ctx.frontKey])).rows[0];if(!n)throw Error('NODE_NOT_FOUND');return n;}
async function progress(c,ctx,field,amount){
 if(!['produced','delivered','repaired','defended'].includes(field))throw Error('BAD_PROGRESS');
 await c.query(`INSERT INTO frontier_objective_progress(owner_key,wallet,${field}) VALUES($1,$2,$3) ON CONFLICT(owner_key,wallet,day) DO UPDATE SET ${field}=LEAST(10000,frontier_objective_progress.${field}+EXCLUDED.${field})`,[ctx.ownerKey,ctx.wallet,amount]);
}
async function stock(c,key,depot,code,delta){
 await c.query('INSERT INTO frontier_stocks(owner_key,depot,resource_code) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[key,depot,code]);
 const row=(await c.query('UPDATE frontier_stocks SET quantity=quantity+$4 WHERE owner_key=$1 AND depot=$2 AND resource_code=$3 AND quantity+$4 BETWEEN 0 AND 10000 RETURNING quantity',[key,depot,code,delta])).rows[0];if(!row)throw Error(delta<0?'INSUFFICIENT_STOCK':'WAREHOUSE_FULL');return row.quantity;
}
async function fleet(c,ctx,id,{alive=true,allowMoving=false}={}){
 const f=(await c.query('SELECT * FROM fleets WHERE id=$1 AND LOWER(owner_wallet)=LOWER($2) FOR UPDATE',[integer(id),ctx.wallet])).rows[0];if(!f)throw Error('FLEET_NOT_FOUND');
 if(f.is_in_battle||f.current_battle_id)throw Error('FLEET_IN_BATTLE');
 await assertFleetsNotMining(c,[f.id]);
 if(!allowMoving&&(await c.query("SELECT 1 FROM frontier_cargo WHERE fleet_id=$1 AND status='moving'",[f.id])).rowCount)throw Error('FLEET_TRANSPORTING');
 if(alive&&!(await c.query('SELECT 1 FROM ships WHERE fleet_id=$1 AND is_alive AND current_hp>0 LIMIT 1',[f.id])).rowCount)throw Error('FLEET_EMPTY');return f;
}
async function production(c,node){
 if(node.node_type!=='resource'||!node.owner_key||!node.production_at)return;
 // Watermark advances for every elapsed interval, even when storage is full; no catch-up mint after collect.
 const r=(await c.query(`UPDATE frontier_nodes SET stored_batches=LEAST(4,stored_batches+FLOOR(EXTRACT(EPOCH FROM(NOW()-production_at))/1800)::integer),
 production_at=production_at+(FLOOR(EXTRACT(EPOCH FROM(NOW()-production_at))/1800)*INTERVAL '30 minutes') WHERE id=$1 AND production_at<=NOW()-INTERVAL '30 minutes' RETURNING *`,[node.id])).rows[0];
 if(r){const elapsed=Math.floor((new Date(r.production_at)-new Date(node.production_at))/1800000);if(node.owner_key.startsWith('guild:'))await c.query(`INSERT INTO frontier_season_score(owner_key,season,hold_points) VALUES($1,TO_CHAR(NOW(),'YYYY-MM'),$2) ON CONFLICT(owner_key,season) DO UPDATE SET hold_points=LEAST(4464,frontier_season_score.hold_points+EXCLUDED.hold_points)`,[node.owner_key,Math.min(48,elapsed)]);Object.assign(node,r);}
}
async function settleBattleIn(c,battleId){
 const fb=(await c.query('SELECT * FROM frontier_battles WHERE battle_id=$1 FOR UPDATE',[integer(battleId)])).rows[0];if(!fb)throw Error('FRONTIER_BATTLE_NOT_FOUND');if(fb.settled_at)return fb;
 const b=(await c.query('SELECT * FROM fleet_battles WHERE id=$1',[fb.battle_id])).rows[0];if(!b||!['ended','cancelled'].includes(b.status))return {...fb,pending:true};
 const part=(await c.query("SELECT 1 FROM fleet_battle_participants WHERE battle_id=$1 AND LOWER(wallet_address)=LOWER($2) AND side='atk'",[fb.battle_id,fb.wallet])).rowCount;
 const ctx=await context(c,fb.wallet,{training:fb.mission_id!=null&&fb.owner_key==='wallet:'+lower(fb.wallet)});let result='lost';
 if(b.status==='cancelled')result='cancelled';
 else if(b.winner_side==='atk'&&part){
  if(fb.node_id){
   const n=(await c.query('SELECT * FROM frontier_nodes WHERE id=$1 FOR UPDATE',[fb.node_id])).rows[0];
   if(!n||n.generation!==fb.generation||ctx.ownerKey!==fb.owner_key)result='stale';
   else{
    await production(c,n);
    // Uncollected prior-controller batches are lost on takeover; previously delivered stock stays with that owner.
    await c.query(`UPDATE frontier_nodes SET owner_key=$2,controller_wallet=$3,generation=generation+1,captured_at=NOW(),protected_until=NOW()+INTERVAL '30 minutes',production_at=NOW(),stored_batches=CASE WHEN node_type='resource' THEN 1 ELSE 0 END WHERE id=$1`,[n.id,fb.owner_key,fb.wallet]);
    await c.query('DELETE FROM frontier_defense WHERE node_id=$1',[n.id]);result='captured';track(c,fb.wallet,'territory_captured',fb.battle_id,{nodeId:Number(n.id),battleId:Number(fb.battle_id),mode:n.front_key==='public'?'guild_front':'solo_training'});
   }
  }else{
   const cargo=(await c.query('SELECT * FROM frontier_cargo WHERE id=$1 FOR UPDATE',[fb.cargo_id])).rows[0];
   if(!cargo||cargo.status!=='moving'||Number(cargo.raid_battle_id)!==Number(fb.battle_id)||ctx.ownerKey!==fb.owner_key)result='stale';
   else{const loot=Math.floor(cargo.amount/2);if(loot)await stock(c,fb.owner_key,'repair',cargo.resource_code,loot);
    await stock(c,cargo.owner_key,'repair',cargo.resource_code,cargo.amount-loot);
    await c.query("UPDATE frontier_cargo SET status='raided',received=$2,settled_at=NOW() WHERE id=$1",[cargo.id,cargo.amount-loot]);result='raided';}
  }
 }else if(fb.cargo_id)result=b.status==='cancelled'?'cancelled':'defended';
 return (await c.query('UPDATE frontier_battles SET result=$2,settled_at=NOW() WHERE battle_id=$1 RETURNING *',[fb.battle_id,result])).rows[0];
}
async function settleBattle(battleId){return transaction(c=>settleBattleIn(c,battleId));}
async function settlePending(c,ctx){
 // Global public node settlement avoids stale controllers when the next player opens the board.
 const pending=(await c.query(`SELECT f.battle_id FROM frontier_battles f LEFT JOIN frontier_nodes n ON n.id=f.node_id LEFT JOIN frontier_cargo cargo ON cargo.id=f.cargo_id JOIN fleet_battles b ON b.id=f.battle_id WHERE f.settled_at IS NULL AND (n.front_key=$1 OR LOWER(f.wallet)=LOWER($2) OR LOWER(cargo.wallet)=LOWER($2)) AND b.status IN ('ended','cancelled') ORDER BY f.battle_id LIMIT 50`,[ctx.frontKey,ctx.wallet])).rows;
 for(const p of pending){await c.query('SAVEPOINT frontier_settle_job');try{await settleBattleIn(c,p.battle_id);}catch(e){await c.query('ROLLBACK TO SAVEPOINT frontier_settle_job');if(e.message!=='WAREHOUSE_FULL')throw e;}finally{await c.query('RELEASE SAVEPOINT frontier_settle_job');}}
 const arrivals=(await c.query(`SELECT c.* FROM frontier_cargo c WHERE (c.owner_key=$1 OR LOWER(c.wallet)=LOWER($2)) AND c.status='moving' AND c.arrives_at<=NOW()
 AND NOT EXISTS(SELECT 1 FROM frontier_battles f WHERE f.cargo_id=c.id AND f.settled_at IS NULL) ORDER BY c.id FOR UPDATE`,[ctx.ownerKey,ctx.wallet])).rows;
 for(const cargo of arrivals){const capacity=(await c.query("SELECT quantity FROM frontier_stocks WHERE owner_key=$1 AND depot='repair' AND resource_code=$2",[cargo.owner_key,cargo.resource_code])).rows[0];if(Number(capacity?.quantity||0)+cargo.amount>BALANCE.warehouseCap)continue;await stock(c,cargo.owner_key,'repair',cargo.resource_code,cargo.amount);await c.query("UPDATE frontier_cargo SET status='arrived',received=amount,settled_at=NOW() WHERE id=$1",[cargo.id]);await progress(c,{ownerKey:cargo.owner_key,wallet:cargo.wallet},'delivered',cargo.amount);
 if(cargo.owner_key.startsWith('guild:'))await c.query(`INSERT INTO frontier_season_score(owner_key,season,delivery_points) VALUES($1,TO_CHAR(NOW(),'YYYY-MM'),$2) ON CONFLICT(owner_key,season) DO UPDATE SET delivery_points=LEAST(3000,frontier_season_score.delivery_points+EXCLUDED.delivery_points)`,[cargo.owner_key,cargo.amount]);}
}
async function npcDefender(c,node,options={}){
 // One real persisted NPC fleet per node, recycled only while idle; historical ship ids are preserved.
 const wallet='0x'+crypto.createHash('sha256').update('frontier-npc:'+node.id+(options.trainingMission?':starter-training':'')).digest('hex').slice(0,40);
 await c.query("INSERT INTO users(wallet_address,nickname,is_ai,is_frontier_npc,ai_difficulty,faction_code,gp_balance) VALUES($1,'Frontier guard',true,true,'easy','mcc',0) ON CONFLICT(wallet_address) DO UPDATE SET is_frontier_npc=true",[wallet]);
 let f=(await c.query('SELECT * FROM fleets WHERE owner_wallet=$1 ORDER BY id LIMIT 1 FOR UPDATE',[wallet])).rows[0];
 if(!f)f=(await c.query("INSERT INTO fleets(owner_wallet,name,sector_id) VALUES($1,'NPC 산업 경비대',$2) RETURNING *",[wallet,node.sector_id])).rows[0];
 if(f.is_in_battle||f.current_battle_id)throw Error('DEFENDER_BUSY');
 const ships=(await c.query('SELECT id FROM ships WHERE fleet_id=$1 ORDER BY id',[f.id])).rows;
 if(!ships.length){const type=(await c.query(options.trainingMission?"SELECT code,base_hp FROM ship_types WHERE faction_code='mcc' AND size_class='frigate' AND is_active ORDER BY tier,build_gp_cost,code LIMIT 1":"SELECT code,base_hp FROM ship_types WHERE faction_code='mcc' AND size_class='frigate' AND is_active ORDER BY tier,code LIMIT 1")).rows[0];if(!type)throw Error('NPC_SHIP_TYPE_MISSING');
 for(let i=0;i<(options.trainingMission?1:2);i++)await c.query('INSERT INTO ships(fleet_id,owner_wallet,ship_type_code,current_hp,max_hp,is_alive,is_flagship) VALUES($1,$2,$3,$4,$4,true,$5)',[f.id,wallet,type.code,type.base_hp,i===0]);
 }else await c.query('UPDATE ships SET current_hp=max_hp+COALESCE(bonus_hp,0),is_alive=true,destroyed_at=NULL WHERE fleet_id=$1',[f.id]);return {fleet:f,wallet};
}
async function defender(c,node,excludeFleet,options={}){
 const preset=(await c.query('SELECT * FROM frontier_defense WHERE node_id=$1 AND owner_key=$2',[node.id,node.owner_key])).rows[0];
 if(preset&&Number(preset.fleet_id)!==Number(excludeFleet)){
 const ctx=await context(c,preset.wallet);
 if(ctx.ownerKey===node.owner_key){try{const f=await fleet(c,ctx,preset.fleet_id);const ids=(await c.query('SELECT id FROM ships WHERE fleet_id=$1 AND is_alive ORDER BY id',[f.id])).rows.map(r=>Number(r.id));if(JSON.stringify(ids)!==JSON.stringify(preset.preset.shipIds))return npcDefender(c,node,options);await c.query('UPDATE fleets SET formation=$2,movement=$3 WHERE id=$1',[f.id,preset.preset.formation,preset.preset.movement]);return {fleet:f,wallet:ctx.wallet};}catch(e){if(!['FLEET_IN_BATTLE','FLEET_MINING','FLEET_TRANSPORTING','FLEET_EMPTY','FLEET_NOT_FOUND'].includes(e.message))throw e;}}
 }
 return npcDefender(c,node,options);
}
async function declare(c,ctx,atk,def,node,cargo,options={}){
 const summary={is_frontier_battle:true,is_ai_battle:!!(await c.query('SELECT 1 FROM users WHERE wallet_address=$1 AND is_ai',[def.wallet])).rowCount,frontier_node_id:node.id,frontier_cargo_id:cargo?cargo.id:null,frontier_mission_id:options.missionId||null,starter_training:!!options.missionId};
 const b=(await c.query("INSERT INTO fleet_battles(battle_type,status,sector_id,scheduled_start_at,battle_summary) VALUES('event','preparing',$1,NOW(),$2::jsonb) RETURNING id",[node.sector_id,JSON.stringify(summary)])).rows[0];
 for(const [f,w,side] of [[atk,ctx.wallet,'atk'],[def.fleet,def.wallet,'def']]){
 await c.query('INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side,ships_at_start,hp_at_start) SELECT $1,$2,$3,$4,COUNT(*),COALESCE(SUM(current_hp),0) FROM ships WHERE fleet_id=$2 AND is_alive',[b.id,f.id,w,side]);
 await c.query('UPDATE fleets SET is_in_battle=true,current_battle_id=$2 WHERE id=$1',[f.id,b.id]);}
 await c.query('INSERT INTO frontier_battles(battle_id,wallet,owner_key,node_id,cargo_id,generation,mission_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[b.id,ctx.wallet,ctx.ownerKey,cargo?null:node.id,cargo?cargo.id:null,node.generation,options.missionId||null]);return {success:true,battleId:Number(b.id),nodeId:Number(node.id),cargoId:cargo?Number(cargo.id):null};
}
function dispatch(result){require('./battleScheduler').runBattle(result.battleId).catch(e=>console.error('[frontier] battle dispatch:',e.message));return result;}
async function attackQuota(c,ctx){await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ctx.ownerKey]);const used=Number((await c.query('SELECT COUNT(*) AS n FROM frontier_battles WHERE owner_key=$1 AND created_at>=CURRENT_DATE',[ctx.ownerKey])).rows[0].n);if(used>=BALANCE.dailyAttacks)throw Error('DAILY_ATTACK_LIMIT');}
async function attackNode(wallet,nodeId,fleetId,options={}){
 const result=await transaction(async c=>{const ctx=await context(c,wallet,options);await settlePending(c,ctx);const n=await checkedNode(c,ctx,nodeId);
 if(ctx.frontKey==='public'&&options.riskConsent!==true)throw Error('PUBLIC_RISK_CONSENT_REQUIRED');
 if(n.owner_key===ctx.ownerKey)throw Error('ALREADY_CONTROLLED');if(n.protected_until&&new Date(n.protected_until)>new Date())throw Error('NODE_PROTECTED');
 // Owner-key lock serializes team daily quota across every member/node.
 await attackQuota(c,ctx);
 const recaptures=Number((await c.query("SELECT COUNT(*) AS n FROM frontier_battles WHERE owner_key=$1 AND node_id=$2 AND result='captured' AND created_at>=CURRENT_DATE",[ctx.ownerKey,n.id])).rows[0].n);if(recaptures>=2)throw Error('DAILY_RECAPTURE_LIMIT');
 if((await c.query('SELECT 1 FROM frontier_battles WHERE node_id=$1 AND settled_at IS NULL',[n.id])).rowCount)throw Error('NODE_BATTLE_ACTIVE');
 const atk=await fleet(c,ctx,fleetId),def=await defender(c,n,atk.id,{trainingMission:options.training===true&&options.missionId===2});return declare(c,ctx,atk,def,n,null,options);});return options.dispatch===false?result:dispatch(result);
}
async function captureNode(wallet,nodeId,battleId){return transaction(async c=>{const ctx=await context(c,wallet);const f=(await c.query('SELECT * FROM frontier_battles WHERE battle_id=$1',[integer(battleId)])).rows[0];if(!f||Number(f.node_id)!==integer(nodeId)||lower(f.wallet)!==lower(ctx.wallet))throw Error('BATTLE_CONTEXT_MISMATCH');return settleBattleIn(c,f.battle_id);});}
async function collectProduction(wallet,nodeId,options={}){return transaction(async c=>{const ctx=await context(c,wallet,options);await settlePending(c,ctx);const n=await checkedNode(c,ctx,nodeId);if(n.owner_key!==ctx.ownerKey||n.node_type!=='resource')throw Error('NOT_RESOURCE_CONTROLLER');await production(c,n);const batches=n.stored_batches;if(!batches)throw Error('PRODUCTION_NOT_READY');
 await stock(c,ctx.ownerKey,'mine','iron_dust',batches*20);await stock(c,ctx.ownerKey,'mine','hull_plate',batches*4);await c.query('UPDATE frontier_nodes SET stored_batches=0 WHERE id=$1',[n.id]);await progress(c,ctx,'produced',batches*20);const event=(await c.query('INSERT INTO frontier_production_events(wallet,owner_key,node_id,mission_id,batches,iron_dust,hull_plate) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[ctx.wallet,ctx.ownerKey,n.id,options.missionId||null,batches,batches*20,batches*4])).rows[0];track(c,ctx.wallet,'production_collected',event.id,{nodeId:Number(n.id),batches,eventId:Number(event.id)});return {success:true,event,batches,iron_dust:batches*20,hull_plate:batches*4};});}
async function startCargo(wallet,fleetId,amount,resourceCode='iron_dust',options={}){amount=integer(amount,100);if(!['iron_dust','hull_plate'].includes(resourceCode))throw Error('INVALID_RESOURCE');return transaction(async c=>{const ctx=await context(c,wallet,options);await settlePending(c,ctx);const f=await fleet(c,ctx,fleetId);
 const logistics=(await c.query("SELECT 1 FROM frontier_nodes WHERE front_key=$1 AND node_type='logistics' AND owner_key=$2",[ctx.frontKey,ctx.ownerKey])).rowCount;
 const tutorialCargo=options.training===true&&options.missionId===3&&(await c.query("SELECT 1 FROM starter_fleet_grants g JOIN starter_operation_progress p ON LOWER(p.wallet_address)=LOWER(g.wallet_address) WHERE LOWER(g.wallet_address)=LOWER($1) AND g.fleet_id=$2 AND g.grant_code='starter_ops_v1' AND p.mission_id='move_yield' AND p.status='active'",[ctx.wallet,f.id])).rowCount>0;
 const duration=tutorialCargo?1:logistics?9:10;await stock(c,ctx.ownerKey,'mine',resourceCode,-amount);
 const cargo=(await c.query("INSERT INTO frontier_cargo(wallet,owner_key,fleet_id,front_key,resource_code,amount,arrives_at,mission_id) VALUES($1,$2,$3,$4,$5,$6,NOW()+$7*INTERVAL '1 minute',$8) RETURNING *",[ctx.wallet,ctx.ownerKey,f.id,ctx.frontKey,resourceCode,amount,duration,options.missionId||null])).rows[0];return {success:true,cargo};});}
async function cancelCargo(wallet,id){return transaction(async c=>{const ctx=await context(c,wallet);const cargo=(await c.query('SELECT * FROM frontier_cargo WHERE id=$1 AND LOWER(wallet)=LOWER($2) FOR UPDATE',[integer(id),ctx.wallet])).rows[0];if(!cargo||(cargo.owner_key!==ctx.ownerKey&&cargo.owner_key!=='wallet:'+lower(ctx.wallet)))throw Error('CARGO_NOT_FOUND');if(cargo.status!=='moving')return {success:true,cargo};if(cargo.raid_battle_id||Date.now()-new Date(cargo.started_at).getTime()>60000)throw Error('CARGO_CANCEL_WINDOW_CLOSED');await stock(c,cargo.owner_key,'mine',cargo.resource_code,cargo.amount);return {success:true,cargo:(await c.query("UPDATE frontier_cargo SET status='cancelled',settled_at=NOW() WHERE id=$1 RETURNING *",[cargo.id])).rows[0]};});}
async function attackCargo(wallet,id,fleetId,options={}){const result=await transaction(async c=>{const ctx=await context(c,wallet);if(options.riskConsent!==true)throw Error('PUBLIC_RISK_CONSENT_REQUIRED');await settlePending(c,ctx);const cargo=(await c.query('SELECT * FROM frontier_cargo WHERE id=$1 FOR UPDATE',[integer(id)])).rows[0];if(!cargo||cargo.front_key!=='public'||ctx.frontKey!=='public')throw Error('PUBLIC_CARGO_REQUIRED');if(cargo.owner_key===ctx.ownerKey||lower(cargo.wallet)===lower(ctx.wallet))throw Error('CANNOT_RAID_OWN_CARGO');if(cargo.status!=='moving'||cargo.raid_battle_id)throw Error('CARGO_NOT_RAIDABLE');const pct=(Date.now()-new Date(cargo.started_at))/(new Date(cargo.arrives_at)-new Date(cargo.started_at));if(pct<0.2||pct>0.9)throw Error('RAID_WINDOW_CLOSED');await attackQuota(c,ctx);
 const n=(await c.query("SELECT * FROM frontier_nodes WHERE front_key='public' AND node_type='logistics' FOR UPDATE")).rows[0];const atk=await fleet(c,ctx,fleetId),def=await defender(c,{...n,owner_key:cargo.owner_key},cargo.fleet_id);const r=await declare(c,ctx,atk,def,n,cargo,options);await c.query('UPDATE frontier_cargo SET raid_battle_id=$2 WHERE id=$1',[cargo.id,r.battleId]);return r;});return options.dispatch===false?result:dispatch(result);}
async function repairCost(c,ctx,quote,options={}){
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ctx.ownerKey]);
 if(options.training===true&&options.missionId===4&&ctx.ownerKey==='wallet:'+lower(ctx.wallet)){
 const eligible=(await c.query("SELECT 1 FROM starter_fleet_grant_ships g JOIN starter_operation_progress p ON LOWER(p.wallet_address)=LOWER(g.wallet_address) WHERE g.ship_id=$1 AND LOWER(g.wallet_address)=LOWER($2) AND g.grant_code='starter_ops_v1' AND p.mission_id='restore_fleet' AND p.status='active' AND NOT EXISTS(SELECT 1 FROM frontier_repairs r WHERE LOWER(r.wallet)=LOWER($2) AND r.mission_id=4 AND r.tutorial_subsidy=true)",[quote.ship.id,ctx.wallet])).rowCount;
 if(eligible)return {iron_used:10,gp_cost:0,target_hp:quote.target_hp,healed:quote.healed,tutorial_subsidy:true};
 }
 const repairNode=(await c.query("SELECT 1 FROM frontier_nodes WHERE front_key=$1 AND node_type='repair' AND owner_key=$2",[ctx.frontKey,ctx.ownerKey])).rowCount;
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[ctx.ownerKey]);
 const daily=Number((await c.query('SELECT COALESCE(SUM(healed),0) AS n FROM frontier_repairs WHERE owner_key=$1 AND created_at>=CURRENT_DATE',[ctx.ownerKey])).rows[0].n);
 const discount=repairNode&&daily+quote.healed<=1000;const iron=Math.max(1,Math.ceil(quote.iron_used*(discount?0.9:1)));return {iron_used:iron,gp_cost:quote.gp_cost,target_hp:quote.target_hp,healed:quote.healed};
}
async function repairQuote(wallet,shipId,targetHpPct=100,options={}){shipId=integer(shipId);targetHpPct=integer(targetHpPct,100);return transaction(async c=>{const ctx=await context(c,wallet,options);await settlePending(c,ctx);const ship=(await c.query('SELECT fleet_id FROM ships WHERE id=$1 AND LOWER(owner_wallet)=LOWER($2)',[shipId,ctx.wallet])).rows[0];if(!ship)throw Error('SHIP_NOT_FOUND');if(ship.fleet_id)await fleet(c,ctx,ship.fleet_id,{alive:false});const quote=await require('./ship').getRepairQuote(ctx.wallet,shipId,targetHpPct,c,true);return repairCost(c,ctx,quote,options);});}
async function repair(wallet,shipId,targetHpPct=100,options={}){shipId=integer(shipId);targetHpPct=integer(targetHpPct,100);return transaction(async c=>{const ctx=await context(c,wallet,options);await settlePending(c,ctx);
 const s=(await c.query('SELECT * FROM ships WHERE id=$1 AND LOWER(owner_wallet)=LOWER($2)',[shipId,ctx.wallet])).rows[0];if(!s||!s.is_alive)throw Error('SHIP_NOT_FOUND');if(s.is_market_listed)throw Error('SHIP_LISTED_FOR_SALE');if(s.fleet_id)await fleet(c,ctx,s.fleet_id,{alive:false});
 // Same quote/settings and ship HP rules as existing repair; a delivered front stock substitutes its iron cost.
 const quote=await require('./ship').getRepairQuote(ctx.wallet,shipId,targetHpPct,c,true);
 const cost=await repairCost(c,ctx,quote,options);const iron=cost.iron_used;
 if(options.expectedQuote&&(['iron_used','gp_cost','target_hp','healed'].some(k=>Number(options.expectedQuote[k])!==cost[k])||(options.expectedQuote.tutorial_subsidy===true)!==(cost.tutorial_subsidy===true)))throw Error('REPAIR_QUOTE_CHANGED');
 await stock(c,ctx.ownerKey,'repair','iron_dust',-iron);
 if(!(await c.query('UPDATE users SET gp_balance=gp_balance-$2 WHERE wallet_address=$1 AND gp_balance>=$2 RETURNING wallet_address',[ctx.wallet,cost.gp_cost])).rowCount)throw Error('INSUFFICIENT_GP');
 await c.query('UPDATE ships SET current_hp=$2 WHERE id=$1',[shipId,quote.target_hp]);const row=(await c.query('INSERT INTO frontier_repairs(wallet,owner_key,ship_id,healed,iron_used,gp_cost,mission_id,tutorial_subsidy) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[ctx.wallet,ctx.ownerKey,shipId,quote.healed,iron,cost.gp_cost,options.missionId||null,cost.tutorial_subsidy===true])).rows[0];await progress(c,ctx,'repaired',quote.healed);track(c,ctx.wallet,'repair_completed',row.id,{shipId,healed:quote.healed,repairId:Number(row.id)});return {success:true,repair:row,currentHp:quote.target_hp};});}
async function withdrawStock(wallet,depot,resourceCode,amount){amount=integer(amount,100);if(!['mine','repair'].includes(depot)||!['iron_dust','hull_plate'].includes(resourceCode))throw Error('INVALID_STOCK');return transaction(async c=>{const ctx=await context(c,wallet);await stock(c,ctx.ownerKey,depot,resourceCode,-amount);await c.query(`INSERT INTO user_resource_inventory(wallet_address,resource_id,quantity) SELECT $1,id,$3 FROM resources WHERE code=$2 ON CONFLICT(wallet_address,resource_id) DO UPDATE SET quantity=user_resource_inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[ctx.wallet,resourceCode,amount]);return {success:true,resourceCode,amount};});}
async function saveDefense(wallet,nodeId,fleetId,options={}){return transaction(async c=>{const ctx=await context(c,wallet,options);if(ctx.frontKey==='public'&&options.riskConsent!==true)throw Error('PUBLIC_RISK_CONSENT_REQUIRED');const n=await checkedNode(c,ctx,nodeId);if(n.owner_key!==ctx.ownerKey)throw Error('NOT_NODE_CONTROLLER');const f=await fleet(c,ctx,fleetId);
 const shipIds=(await c.query('SELECT id FROM ships WHERE fleet_id=$1 AND is_alive ORDER BY id',[f.id])).rows.map(x=>Number(x.id));const preset={formation:f.formation,movement:f.movement,shipIds,riskConsent:ctx.frontKey==='public'};
 await c.query('INSERT INTO frontier_defense(node_id,wallet,owner_key,fleet_id,preset) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(node_id) DO UPDATE SET wallet=EXCLUDED.wallet,owner_key=EXCLUDED.owner_key,fleet_id=EXCLUDED.fleet_id,preset=EXCLUDED.preset,updated_at=NOW()',[n.id,ctx.wallet,ctx.ownerKey,f.id,JSON.stringify(preset)]);await progress(c,ctx,'defended',1);const event=(await c.query('INSERT INTO frontier_defense_events(wallet,owner_key,node_id,fleet_id,mission_id,preset) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *',[ctx.wallet,ctx.ownerKey,n.id,f.id,options.missionId||null,JSON.stringify(preset)])).rows[0];return {success:true,event,preset};});}
async function getState(wallet,options={}){return transaction(async c=>{const ctx=await context(c,wallet,options);await ensureBoard(c,ctx);await settlePending(c,ctx);const nodes=(await c.query('SELECT * FROM frontier_nodes WHERE front_key=$1 ORDER BY id FOR UPDATE',[ctx.frontKey])).rows;for(const n of nodes)await production(c,n);
 const stocks=(await c.query('SELECT * FROM frontier_stocks WHERE owner_key=$1 ORDER BY depot,resource_code',[ctx.ownerKey])).rows;
 const cargo=(await c.query('SELECT * FROM frontier_cargo WHERE owner_key=$1 OR LOWER(wallet)=LOWER($2) ORDER BY id DESC LIMIT 20',[ctx.ownerKey,ctx.wallet])).rows;
 const raidTargets=ctx.guildId?(await c.query("SELECT id,wallet,amount,resource_code,started_at,arrives_at FROM frontier_cargo WHERE front_key='public' AND owner_key<>$1 AND status='moving' AND raid_battle_id IS NULL ORDER BY id DESC LIMIT 20",[ctx.ownerKey])).rows:[];
 const contributions=(await c.query('SELECT * FROM frontier_objective_progress WHERE owner_key=$1 AND day=CURRENT_DATE ORDER BY wallet',[ctx.ownerKey])).rows;
 const score=(await c.query("SELECT * FROM frontier_season_score WHERE owner_key=$1 AND season=TO_CHAR(NOW(),'YYYY-MM')",[ctx.ownerKey])).rows[0]||{hold_points:0,delivery_points:0};
 const battles=(await c.query('SELECT f.*,b.status,b.winner_side FROM frontier_battles f JOIN fleet_battles b ON b.id=f.battle_id WHERE f.owner_key=$1 ORDER BY f.battle_id DESC LIMIT 20',[ctx.ownerKey])).rows;
 const defenses=(await c.query('SELECT * FROM frontier_defense WHERE node_id=ANY($1::bigint[])',[nodes.map(n=>n.id)])).rows;
 return {success:true,mode:ctx.guildId?'guild_front':'solo_training',...ctx,nodes,stocks,cargo,raidTargets,contributions,score,battles,defenses,balance:BALANCE,tutorialRepairPolicy:options.training?{missionId:4,oncePerAccount:true,ironCost:10,gpCost:0,requiresGrantedHull:true}:null,objective:{target:'생산 → 10분 운송 → 실제 함선 정비 → 방어 편성',teamSize:'3–5',complete:contributions.some(p=>p.produced>0)&&contributions.some(p=>p.delivered>0)&&contributions.some(p=>p.repaired>0)&&contributions.some(p=>p.defended>0)}};});}
module.exports={BALANCE,getState,attackNode,captureNode,settleBattle,collectProduction,startCargo,cancelCargo,attackCargo,repairQuote,repair,withdrawStock,saveDefense};

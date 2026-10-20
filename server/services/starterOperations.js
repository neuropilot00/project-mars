'use strict';
const { pool } = require('../db');
const MISSIONS = [
 {id:'first_sortie', title:'착륙 방어', objectives:[['battle_won','실제 함대전 승리']]},
 {id:'secure_node', title:'광산 확보', objectives:[['node_captured','자원 거점 점령']]},
 {id:'move_yield', title:'화물 호위', objectives:[['production_collected','거점 생산 인수'],['cargo_arrived','화물 도착']]},
 {id:'restore_fleet', title:'전력 복구', objectives:[['fleet_ready','전력 정비 또는 점검 완료']]},
 {id:'hold_front', title:'전선 개방', objectives:[['node_defended','방어 편성 저장']]}
];
const GRANT='starter_ops_v1', LABELS=['돌파','차단','지원 사격'], low=v=>String(v||'').trim().toLowerCase();
const mission=id=>MISSIONS.find(x=>x.id===id);
async function canonicalWallet(c,w){const r=await c.query("SELECT wallet_address FROM users WHERE LOWER(wallet_address)=LOWER($1)",[w]);if(!r.rows[0])throw Error('USER_NOT_FOUND');return r.rows[0].wallet_address;}
async function ensureProgress(c,w){const canonical=await canonicalWallet(c,w);await c.query("INSERT INTO starter_operation_progress(wallet_address,mission_id,status) VALUES($1,'first_sortie','locked') ON CONFLICT DO NOTHING",[canonical]);return canonical;}
async function ensureStarterFleet(c,w){
 let g=(await c.query("SELECT g.fleet_id,f.name FROM starter_fleet_grants g JOIN fleets f ON f.id=g.fleet_id WHERE LOWER(g.wallet_address)=LOWER($1) AND g.grant_code=$2 FOR UPDATE OF g",[w,GRANT])).rows[0];
 if(g){let ships=(await c.query("SELECT s.id ship_id,s.ship_type_code type_code,st.role FROM starter_fleet_grant_ships x JOIN ships s ON s.id=x.ship_id JOIN ship_types st ON st.code=s.ship_type_code WHERE LOWER(x.wallet_address)=LOWER($1) AND x.grant_code=$2 ORDER BY s.id",[w,GRANT])).rows;return {fleetId:Number(g.fleet_id),name:g.name,ships:ships.map((s,i)=>({...s,ship_id:Number(s.ship_id),roleLabel:LABELS[i]}) )};}
 const u=(await c.query("SELECT wallet_address,faction_code FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE",[w])).rows[0];
 if(!u)throw Error('USER_NOT_FOUND');if(!u.faction_code)throw Error('FACTION_REQUIRED');
 const cat=(await c.query("SELECT code,role,base_hp,is_flagship_capable FROM ship_types WHERE LOWER(faction_code)=LOWER($1) AND tier=1 AND min_player_rank<=1 AND is_active=true ORDER BY sort_order,code",[u.faction_code])).rows;
 if(!cat.length)throw Error('STARTER_HULLS_UNAVAILABLE');
 const d=cat.find(x=>x.role==='dps')||cat[0],s=cat.find(x=>x.code!==d.code&&['tackle','tank','ewar'].includes(x.role))||cat.find(x=>x.code!==d.code)||d;
 const t=cat.find(x=>x.code!==d.code&&x.code!==s.code&&x.role==='dps')||cat.find(x=>x.code!==d.code&&x.code!==s.code)||d, chosen=[d,s,t];
 const f=(await c.query("INSERT INTO fleets(owner_wallet,name,formation,movement) VALUES($1,'전초 작전 함대','wedge','advance') RETURNING id,name",[u.wallet_address])).rows[0];
 await c.query("INSERT INTO starter_fleet_grants(wallet_address,grant_code,fleet_id) VALUES($1,$2,$3)",[u.wallet_address,GRANT,f.id]);
 const ships=[];
 for(let i=0;i<3;i++){let x=chosen[i],r=(await c.query("INSERT INTO ships(fleet_id,ship_type_code,owner_wallet,current_hp,max_hp,is_flagship) VALUES($1,$2,$3,$4,$4,$5) RETURNING id",[f.id,x.code,u.wallet_address,x.base_hp,i===0&&x.is_flagship_capable])).rows[0];
 await c.query("INSERT INTO starter_fleet_grant_ships(ship_id,wallet_address,grant_code) VALUES($1,$2,$3)",[r.id,u.wallet_address,GRANT]);ships.push({ship_id:Number(r.id),type_code:x.code,role:x.role,roleLabel:LABELS[i]});}
 return {fleetId:Number(f.id),name:f.name,ships};
}
async function counts(c,w,m){let rs=(await c.query("SELECT objective_key,COUNT(*)::int n FROM starter_operation_events WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 GROUP BY objective_key",[w,m.id])).rows;return Object.fromEntries(rs.map(x=>[x.objective_key,x.n]));}
async function getState(wallet){
 const w=low(wallet),c=await pool.connect();let missions,starterFleet;
 try{await c.query('BEGIN');await ensureProgress(c,w);
 const ps=(await c.query("SELECT mission_id,status,started_at,completed_at,claimed_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1)",[w])).rows,by=Object.fromEntries(ps.map(x=>[x.mission_id,x]));
 missions=[];for(const m of MISSIONS){let p=by[m.id]||{status:'locked'},n=await counts(c,w,m);missions.push({id:m.id,title:m.title,status:p.status,startedAt:p.started_at||null,completedAt:p.completed_at||null,claimedAt:p.claimed_at||null,objectives:m.objectives.map(([key,label])=>({key,label,current:Math.min(n[key]||0,1),target:1,complete:(n[key]||0)>0}))});}
 let gr=(await c.query("SELECT fleet_id FROM starter_fleet_grants WHERE LOWER(wallet_address)=LOWER($1) AND grant_code=$2",[w,GRANT])).rows[0];starterFleet=gr?await ensureStarterFleet(c,w):null;
 await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 const first=missions.find(x=>x.id==='first_sortie');
 if(first&&first.status==='active'){const b=(await pool.query("SELECT b.id FROM fleet_battles b JOIN fleet_battle_participants p ON p.battle_id=b.id JOIN starter_fleet_grants g ON g.fleet_id=p.fleet_id WHERE LOWER(p.wallet_address)=LOWER($1) AND p.side='atk' AND g.grant_code=$2 AND b.status='ended' AND b.winner_side='atk' AND b.battle_summary->>'trusted_source'='starter_ops' AND b.battle_summary->>'starter_wallet'=LOWER($1) AND b.battle_summary->>'missionId'='first_sortie' AND b.ended_at >= $3 ORDER BY b.ended_at DESC LIMIT 1",[w,GRANT,first.startedAt])).rows[0];if(b){await recordEvidence(w,'first_sortie','battle_won','fleet_battle',b.id);return getState(w);}}
 const frontierChanged=await recoverFrontierProgress(w);if(frontierChanged)return getState(w);
 const currentMissionId=missions.find(x=>x.status==='active'||x.status==='completed')?.id||missions.find(x=>x.status==='locked')?.id||null;
 const current=missions.find(x=>x.id===currentMissionId);if(current&&current.status==='locked')current.status='available';
 return {success:true,currentMissionId,missions,starterFleet};
}
async function start(wallet,id,options={}){
 const openingTactic=id==='first_sortie'?require('./starterBattle').validateOpeningTactic(options.openingTactic):null;
 const m=mission(id);if(!m)throw Error('INVALID_MISSION');const w=low(wallet),c=await pool.connect();
 let battle=null, starterFleet=null, recovery=null;
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['starter_ops:'+w]);const canonical=await ensureProgress(c,w);
 const i=MISSIONS.indexOf(m);if(i>0){let p=(await c.query("SELECT status FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 FOR UPDATE",[w,MISSIONS[i-1].id])).rows[0];if(!p||p.status!=='claimed')throw Error('PREVIOUS_MISSION_REQUIRED');}
 let p=(await c.query("SELECT status,started_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 FOR UPDATE",[w,id])).rows[0];if(p&&p.status!=='locked'&&p.status!=='active')throw Error('MISSION_ALREADY_FINISHED');
 await c.query("INSERT INTO starter_operation_progress(wallet_address,mission_id,status,started_at) VALUES($1,$2,'active',NOW()) ON CONFLICT(wallet_address,mission_id) DO UPDATE SET status='active',started_at=COALESCE(starter_operation_progress.started_at,NOW()),updated_at=NOW()",[canonical,id]);
 starterFleet=id==='first_sortie'?await ensureStarterFleet(c,w):null;
 if(id==='restore_fleet')recovery=await recoverStarterShips(c,canonical);
 if(id==='first_sortie'){
   let existing=(await c.query("SELECT b.id,b.status,b.winner_side FROM fleet_battles b JOIN fleet_battle_participants bp ON bp.battle_id=b.id JOIN starter_fleet_grants g ON g.fleet_id=bp.fleet_id WHERE b.battle_summary->>'trusted_source'='starter_ops' AND b.battle_summary->>'missionId'=$1 AND b.battle_summary->>'starter_wallet'=LOWER($2) AND LOWER(bp.wallet_address)=LOWER($2) AND bp.side='atk' AND g.grant_code=$3 AND b.created_at>=COALESCE($4,NOW()-INTERVAL '1 day') ORDER BY b.id DESC LIMIT 1",[id,w,GRANT,p&&p.started_at])).rows[0];
   if(existing&&['preparing','active'].includes(existing.status))battle={battleId:String(existing.id),status:existing.status,reused:true};
   else if(!existing||['ended','cancelled'].includes(existing.status)){
     if(existing&&existing.status==='ended'&&existing.winner_side==='atk')throw Error('MISSION_ALREADY_COMPLETE');
     const factory=require('./starterBattle');battle=await factory.createFirstSortie({client:c,wallet:w,fleetId:starterFleet.fleetId,missionId:id,...(openingTactic?{openingTactic}:{})});
   } else throw Error('BATTLE_IN_PROGRESS');
 }
 await c.query('COMMIT');
 if(battle){require('./starterBattle').dispatchBattle(battle);}
 return {success:true,mission:{id,title:m.title,status:'active'},starterFleet,battle,recovery};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
async function recordEvidence(wallet,id,key,type,sid){
 const w=low(wallet),m=mission(id);if(!m||!m.objectives.some(x=>x[0]===key))throw Error('INVALID_OBJECTIVE');const c=await pool.connect();
 try{await c.query('BEGIN');let p=(await c.query("SELECT wallet_address,status,started_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 FOR UPDATE",[w,id])).rows[0];if(!p)throw Error('MISSION_NOT_ACTIVE');if(p.status!=='active'){let prior=(await c.query("SELECT 1 FROM starter_operation_events WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 AND objective_key=$3",[w,id,key])).rowCount;if(prior){await c.query('COMMIT');return {success:true,completed:p.status==='completed'||p.status==='claimed',duplicate:true};}throw Error('MISSION_NOT_ACTIVE');}let src;
 if(type==='fleet_battle'&&id==='first_sortie')src=(await c.query("SELECT b.id::text source_id,b.ended_at source_created_at FROM fleet_battles b JOIN fleet_battle_participants bp ON bp.battle_id=b.id JOIN starter_fleet_grants g ON g.fleet_id=bp.fleet_id AND LOWER(g.wallet_address)=LOWER($2) WHERE b.id=$1 AND LOWER(bp.wallet_address)=LOWER($2) AND bp.side='atk' AND g.grant_code=$5 AND b.status='ended' AND b.winner_side='atk' AND b.battle_summary->>'trusted_source'='starter_ops' AND b.battle_summary->>'is_starter_battle'='true' AND b.battle_summary->>'starter_wallet'=LOWER($2) AND b.battle_summary->>'missionId'=$3 AND b.ended_at >= $4",[sid,w,id,p.started_at,GRANT])).rows[0];
 else if(type==='frontier_battle'&&id==='secure_node')src=(await c.query("SELECT f.battle_id::text source_id,f.settled_at source_created_at FROM frontier_battles f JOIN frontier_nodes n ON n.id=f.node_id AND n.node_type='resource' JOIN fleet_battle_participants bp ON bp.battle_id=f.battle_id JOIN starter_fleet_grants g ON g.fleet_id=bp.fleet_id AND LOWER(g.wallet_address)=LOWER($2) WHERE f.battle_id=$1 AND LOWER(f.wallet)=LOWER($2) AND f.mission_id=2 AND f.result='captured' AND f.settled_at >= $3 AND LOWER(bp.wallet_address)=LOWER($2) AND bp.side='atk' AND g.grant_code=$4",[sid,w,p.started_at,GRANT])).rows[0];
 else if(type==='frontier_production'&&id==='move_yield')src=(await c.query("SELECT id::text source_id,created_at source_created_at FROM frontier_production_events WHERE id=$1 AND LOWER(wallet)=LOWER($2) AND mission_id=3 AND created_at >= $3 AND batches>0",[sid,w,p.started_at])).rows[0];
 else if(type==='frontier_cargo'&&id==='move_yield')src=(await c.query("SELECT c.id::text source_id,c.settled_at source_created_at FROM frontier_cargo c JOIN starter_fleet_grants g ON g.fleet_id=c.fleet_id AND LOWER(g.wallet_address)=LOWER($2) WHERE c.id=$1 AND LOWER(c.wallet)=LOWER($2) AND c.status='arrived' AND c.mission_id=3 AND c.settled_at >= $3 AND c.received>0 AND g.grant_code=$4",[sid,w,p.started_at,GRANT])).rows[0];
 else if(type==='frontier_repair'&&id==='restore_fleet')src=(await c.query("SELECT r.id::text source_id,r.created_at source_created_at FROM frontier_repairs r JOIN starter_fleet_grant_ships g ON g.ship_id=r.ship_id WHERE r.id=$1 AND LOWER(r.wallet)=LOWER($2) AND r.mission_id=4 AND r.healed>0 AND r.created_at >= $3",[sid,w,p.started_at])).rows[0];
 else if(type==='frontier_defense'&&id==='hold_front')src=(await c.query("SELECT d.id::text source_id,d.created_at source_created_at FROM frontier_defense_events d JOIN starter_fleet_grants g ON g.fleet_id=d.fleet_id AND LOWER(g.wallet_address)=LOWER($2) WHERE d.id=$1 AND LOWER(d.wallet)=LOWER($2) AND d.mission_id=5 AND d.created_at >= $3 AND g.grant_code=$4",[sid,w,p.started_at,GRANT])).rows[0];
 if(!src)throw Error('SOURCE_NOT_VERIFIED');
 const had=await c.query("SELECT 1 FROM starter_operation_events WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 AND objective_key=$3 AND source_type=$4 AND source_id=$5",[w,id,key,type,src.source_id]);
 if(had.rowCount){await c.query('COMMIT');return {success:true,completed:p.status==='completed'||p.status==='claimed',duplicate:true};}
 await c.query("INSERT INTO starter_operation_events(wallet_address,mission_id,objective_key,source_type,source_id,source_created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",[p.wallet_address,id,key,type,src.source_id,src.source_created_at]);
 let n=await counts(c,w,m),done=m.objectives.every(x=>(n[x[0]]||0)>0);if(done)await c.query("UPDATE starter_operation_progress SET status='completed',completed_at=COALESCE(completed_at,NOW()),updated_at=NOW() WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 AND status='active'",[w,id]);await c.query('COMMIT');return {success:true,completed:done};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
async function claim(wallet,id){let m=mission(id);if(!m)throw Error('INVALID_MISSION');let w=low(wallet);await getState(w);let c=await pool.connect(),rewardAmount=5;try{await c.query('BEGIN');let p=(await c.query("SELECT status FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 FOR UPDATE",[w,id])).rows[0];if(!p||!['completed','claimed'].includes(p.status))throw Error('MISSION_NOT_COMPLETE');if(p.status!=='claimed'){
 let ownerKey='wallet:'+w;
 let stock=await c.query("INSERT INTO frontier_stocks(owner_key,depot,resource_code,quantity) VALUES($1,'repair','iron_dust',$2) ON CONFLICT(owner_key,depot,resource_code) DO UPDATE SET quantity=frontier_stocks.quantity+EXCLUDED.quantity WHERE frontier_stocks.quantity+EXCLUDED.quantity<=10000 RETURNING quantity",[ownerKey,rewardAmount]);if(!stock.rowCount)throw Error('FRONTIER_STOCK_FULL');
 await c.query("UPDATE starter_operation_progress SET status='claimed',claimed_at=NOW(),updated_at=NOW() WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2",[w,id]);}
 await c.query('COMMIT');return {success:true,mission:{id,status:'claimed'},reward:{resourceCode:'iron_dust',amount:rewardAmount,depot:'repair'}};}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
async function active(wallet,id){const r=await pool.query("SELECT 1 FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2 AND status='active'",[low(wallet),id]);if(!r.rowCount)throw Error('MISSION_NOT_ACTIVE');}
async function assertGrantFleet(wallet,fleetId){const r=await pool.query("SELECT 1 FROM starter_fleet_grants WHERE LOWER(wallet_address)=LOWER($1) AND fleet_id=$2 AND grant_code=$3",[low(wallet),fleetId,GRANT]);if(!r.rowCount)throw Error('STARTER_FLEET_REQUIRED');}
async function assertGrantShip(wallet,shipId){const r=await pool.query("SELECT 1 FROM starter_fleet_grant_ships WHERE LOWER(wallet_address)=LOWER($1) AND ship_id=$2 AND grant_code=$3",[low(wallet),shipId,GRANT]);if(!r.rowCount)throw Error('STARTER_SHIP_REQUIRED');}
async function recoverFrontierProgress(wallet){
 const w=low(wallet),frontier=require('./frontierIndustry');await frontier.getState(w,{training:true});let changed=false;
 const activeRows=(await pool.query("SELECT mission_id,started_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND status='active' AND mission_id<>'first_sortie'",[w])).rows;
 for(const p of activeRows){let id=p.mission_id,src;
  if(id==='secure_node'){
   src=(await pool.query("SELECT f.battle_id id FROM frontier_battles f JOIN frontier_nodes n ON n.id=f.node_id AND n.node_type='resource' JOIN fleet_battle_participants bp ON bp.battle_id=f.battle_id JOIN starter_fleet_grants g ON g.fleet_id=bp.fleet_id AND LOWER(g.wallet_address)=LOWER($1) WHERE LOWER(f.wallet)=LOWER($1) AND f.mission_id=2 AND f.result='captured' AND f.settled_at >= $2 AND LOWER(bp.wallet_address)=LOWER($1) AND bp.side='atk' AND g.grant_code=$3 ORDER BY f.settled_at DESC LIMIT 1",[w,p.started_at,GRANT])).rows[0];
   if(src){const r=await recordEvidence(w,id,'node_captured','frontier_battle',src.id);changed=changed||!r.duplicate;}
  }else if(id==='move_yield'){
   src=(await pool.query("SELECT id FROM frontier_production_events WHERE LOWER(wallet)=LOWER($1) AND mission_id=3 AND created_at >= $2 AND batches>0 ORDER BY created_at DESC LIMIT 1",[w,p.started_at])).rows[0];
   if(src){const r=await recordEvidence(w,id,'production_collected','frontier_production',src.id);changed=changed||!r.duplicate;}
   src=(await pool.query("SELECT c.id FROM frontier_cargo c JOIN starter_fleet_grants g ON g.fleet_id=c.fleet_id AND LOWER(g.wallet_address)=LOWER($1) WHERE LOWER(c.wallet)=LOWER($1) AND c.mission_id=3 AND c.status='arrived' AND c.settled_at >= $2 AND c.received>0 AND g.grant_code=$3 ORDER BY c.settled_at DESC LIMIT 1",[w,p.started_at,GRANT])).rows[0];
   if(src){const r=await recordEvidence(w,id,'cargo_arrived','frontier_cargo',src.id);changed=changed||!r.duplicate;}
  }else if(id==='restore_fleet'){
   src=(await pool.query("SELECT r.id FROM frontier_repairs r JOIN starter_fleet_grant_ships g ON g.ship_id=r.ship_id WHERE LOWER(r.wallet)=LOWER($1) AND r.mission_id=4 AND r.created_at >= $2 AND r.healed>0 ORDER BY r.created_at DESC LIMIT 1",[w,p.started_at])).rows[0];
   if(src){const r=await recordEvidence(w,id,'fleet_ready','frontier_repair',src.id);changed=changed||!r.duplicate;}
  }else if(id==='hold_front'){
   src=(await pool.query("SELECT id FROM frontier_defense_events WHERE LOWER(wallet)=LOWER($1) AND mission_id=5 AND created_at >= $2 ORDER BY created_at DESC LIMIT 1",[w,p.started_at])).rows[0];
   if(src){const r=await recordEvidence(w,id,'node_defended','frontier_defense',src.id);changed=changed||!r.duplicate;}
  }
 }
 return changed;
}
async function action(wallet,id,body={}){
 await active(wallet,id);const frontier=require('./frontierIndustry'),fleetId=Number(body.fleetId),nodeId=Number(body.nodeId);
 if(id==='secure_node'&&body.action==='attack_node'){
   if(!fleetId||!nodeId)throw Error('FLEET_AND_NODE_REQUIRED');await assertGrantFleet(wallet,fleetId);
   const board=await frontier.getState(wallet,{training:true});if(!board.nodes.some(n=>Number(n.id)===nodeId&&n.node_type==='resource'))throw Error('RESOURCE_NODE_REQUIRED');
   const b=await frontier.attackNode(wallet,nodeId,fleetId,{missionId:2,dispatch:false,training:true,riskConsent:body.riskConsent===true});
   require('./battleScheduler').runBattle(b.battleId).catch(e=>console.error('[starter-ops] frontier battle dispatch failed:',e.message));
   return {success:true,battleId:String(b.battleId),status:'preparing',nodeId};
 }
 if(id==='move_yield'&&body.action==='collect_production'){
   if(!nodeId)throw Error('NODE_REQUIRED');const r=await frontier.collectProduction(wallet,nodeId,{missionId:3,training:true});
   await recordEvidence(wallet,id,'production_collected','frontier_production',r.event.id);return r;
 }
 if(id==='move_yield'&&body.action==='start_cargo'){
   if(!fleetId||!Number.isInteger(Number(body.amount)))throw Error('FLEET_AND_AMOUNT_REQUIRED');await assertGrantFleet(wallet,fleetId);
   return frontier.startCargo(wallet,fleetId,Number(body.amount),body.resourceCode||'iron_dust',{missionId:3,training:true});
 }
 if(id==='move_yield'&&body.action==='check_cargo'){
   await frontier.getState(wallet,{training:true});const r=await pool.query("SELECT c.id FROM frontier_cargo c JOIN starter_fleet_grants g ON g.fleet_id=c.fleet_id AND LOWER(g.wallet_address)=LOWER($1) WHERE LOWER(c.wallet)=LOWER($1) AND c.mission_id=3 AND c.status='arrived' AND c.received>0 AND c.settled_at >= (SELECT started_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id=$2) AND g.grant_code=$3 ORDER BY c.settled_at DESC LIMIT 1",[low(wallet),id,GRANT]);
   if(!r.rows[0])throw Error('CARGO_NOT_ARRIVED');await recordEvidence(wallet,id,'cargo_arrived','frontier_cargo',r.rows[0].id);return {success:true,cargoId:Number(r.rows[0].id)};
 }
 if(id==='restore_fleet'&&body.action==='inspect_fleet')return inspectFleetReadiness(wallet);
 if(id==='restore_fleet'&&body.action==='repair_ship'){
   if(!Number(body.shipId))throw Error('SHIP_REQUIRED');await assertGrantShip(wallet,Number(body.shipId));const target=Number(body.targetHpPct)||100,quote=body.expectedQuote||await frontier.repairQuote(wallet,Number(body.shipId),target,{training:true,missionId:4});const r=await frontier.repair(wallet,Number(body.shipId),target,{missionId:4,training:true,expectedQuote:quote});
   await recordEvidence(wallet,id,'fleet_ready','frontier_repair',r.repair.id);return r;
 }
 if(id==='hold_front'&&body.action==='save_defense'){
   if(!nodeId||!fleetId)throw Error('NODE_AND_FLEET_REQUIRED');await assertGrantFleet(wallet,fleetId);const r=await frontier.saveDefense(wallet,nodeId,fleetId,{missionId:5,training:true,riskConsent:body.riskConsent===true});
   await recordEvidence(wallet,id,'node_defended','frontier_defense',r.event.id);return r;
 }
 throw Error('INVALID_ACTION');
}
async function inspectFleetReadiness(wallet){
 const w=low(wallet),c=await pool.connect();
 try{
  await c.query('BEGIN');
  const p=(await c.query("SELECT wallet_address,status,started_at FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id='restore_fleet' FOR UPDATE",[w])).rows[0];
  if(!p||p.status!=='active')throw Error('MISSION_NOT_ACTIVE');
  const grant=(await c.query("SELECT g.fleet_id,f.is_in_battle,f.current_battle_id FROM starter_fleet_grants g JOIN fleets f ON f.id=g.fleet_id AND LOWER(f.owner_wallet)=LOWER(g.wallet_address) WHERE LOWER(g.wallet_address)=LOWER($1) AND g.grant_code=$2 FOR UPDATE OF g,f",[w,GRANT])).rows[0];
  if(!grant)throw Error('STARTER_FLEET_REQUIRED');
  if(grant.is_in_battle||grant.current_battle_id)throw Error('FLEET_IN_BATTLE');
  await require('./fleetOccupancy').assertFleetsNotMining(c,[grant.fleet_id]);
  if((await c.query("SELECT 1 FROM frontier_cargo WHERE fleet_id=$1 AND status='moving' LIMIT 1",[grant.fleet_id])).rowCount)throw Error('FLEET_TRANSPORTING');
  const ships=(await c.query("SELECT s.id,s.current_hp,(s.max_hp+COALESCE(s.bonus_hp,0)) effective_max_hp,s.is_alive,s.fleet_id,s.owner_wallet FROM starter_fleet_grant_ships g JOIN ships s ON s.id=g.ship_id WHERE LOWER(g.wallet_address)=LOWER($1) AND g.grant_code=$2 ORDER BY s.id FOR UPDATE OF s",[w,GRANT])).rows;
  if(ships.length!==3||ships.some(s=>low(s.owner_wallet)!==w||Number(s.fleet_id)!==Number(grant.fleet_id)||!s.is_alive||Number(s.current_hp)<Number(s.effective_max_hp)))throw Error('REPAIR_REQUIRED');
  const sourceId=`${w}:ready:${new Date(p.started_at).getTime()}`;
  await c.query("INSERT INTO starter_operation_events(wallet_address,mission_id,objective_key,source_type,source_id,source_created_at,payload) VALUES($1,'restore_fleet','fleet_ready','starter_fleet_readiness',$2,NOW(),$3::jsonb) ON CONFLICT DO NOTHING",[p.wallet_address,sourceId,JSON.stringify({fleetId:Number(grant.fleet_id),ships:ships.map(s=>({id:Number(s.id),currentHp:Number(s.current_hp),maxHp:Number(s.effective_max_hp)}))})]);
  const n=await counts(c,w,mission('restore_fleet'));
  const done=mission('restore_fleet').objectives.every(([key])=>(n[key]||0)>0);
  if(done)await c.query("UPDATE starter_operation_progress SET status='completed',completed_at=COALESCE(completed_at,NOW()),updated_at=NOW() WHERE LOWER(wallet_address)=LOWER($1) AND mission_id='restore_fleet' AND status='active'",[w]);
  await c.query('COMMIT');return {success:true,ready:true,completed:done,source:'verified_fleet_readiness'};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
async function recoverStarterShips(c,walletAddress){
 const w=low(walletAddress);
 const grant=(await c.query("SELECT g.fleet_id,f.is_in_battle,f.current_battle_id FROM starter_fleet_grants g JOIN fleets f ON f.id=g.fleet_id WHERE LOWER(g.wallet_address)=LOWER($1) AND g.grant_code=$2 FOR UPDATE OF g,f",[w,GRANT])).rows[0];
 if(!grant)return null;
 const ships=(await c.query("SELECT s.id,s.owner_wallet,s.fleet_id,s.current_hp,s.max_hp,s.is_alive,s.destroyed_reason FROM starter_fleet_grant_ships g JOIN ships s ON s.id=g.ship_id WHERE LOWER(g.wallet_address)=LOWER($1) AND g.grant_code=$2 ORDER BY s.id FOR UPDATE OF s",[w,GRANT])).rows;
 if(ships.length!==3||ships.some(s=>low(s.owner_wallet)!==w))throw Error('STARTER_GRANT_SHIP_UNAVAILABLE');
 const dead=ships.filter(s=>!s.is_alive||Number(s.current_hp)<=0);
 if(!dead.length)return null;
 if(grant.is_in_battle||grant.current_battle_id)throw Error('FLEET_IN_BATTLE');
 await require('./fleetOccupancy').assertFleetsNotMining(c,[grant.fleet_id]);
 if((await c.query("SELECT 1 FROM frontier_cargo WHERE fleet_id=$1 AND status='moving' LIMIT 1",[grant.fleet_id])).rowCount)throw Error('FLEET_TRANSPORTING');
 if(dead.some(s=>s.destroyed_reason&&s.destroyed_reason!=='battle'))throw Error('STARTER_GRANT_SHIP_UNAVAILABLE');
 const prior=(await c.query("SELECT recovered_ship_ids FROM starter_fleet_recoveries WHERE LOWER(wallet_address)=LOWER($1) AND grant_code=$2 AND mission_id='restore_fleet' FOR UPDATE",[w,GRANT])).rows[0];
 if(prior)return {recovered:false,alreadyUsed:true,shipIds:prior.recovered_ship_ids.map(Number)};
 const ids=dead.map(s=>Number(s.id));
 await c.query("UPDATE ships SET fleet_id=$3,current_hp=GREATEST(1,CEIL((max_hp+COALESCE(bonus_hp,0))*0.15)::integer),is_alive=true,destroyed_at=NULL,destroyed_reason=NULL WHERE id=ANY($1::bigint[]) AND LOWER(owner_wallet)=LOWER($2)",[ids,w,grant.fleet_id]);
 await c.query("INSERT INTO starter_fleet_recoveries(wallet_address,grant_code,mission_id,recovered_ship_ids) VALUES($1,$2,'restore_fleet',$3::bigint[])",[w,GRANT,ids]);
 return {recovered:true,shipIds:ids,hpPercent:15,oncePerAccount:true};
}
async function requireTrainingWindow(wallet){
 const r=await pool.query("SELECT 1 FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND status IN('active','completed') AND claimed_at IS NULL LIMIT 1",[low(wallet)]);
 if(!r.rowCount)throw Error('TRAINING_FRONT_LOCKED');
}
async function getFrontierState(wallet){await requireTrainingWindow(wallet);return require('./frontierIndustry').getState(low(wallet),{training:true});}
async function getRepairQuote(wallet,shipId,targetHpPct=100){
 await requireTrainingWindow(wallet);await assertGrantShip(wallet,Number(shipId));
 const restore=(await pool.query("SELECT 1 FROM starter_operation_progress WHERE LOWER(wallet_address)=LOWER($1) AND mission_id='restore_fleet' AND status='active'",[low(wallet)])).rowCount;
 if(!restore)throw Error('MISSION_NOT_ACTIVE');
 return require('./frontierIndustry').repairQuote(low(wallet),Number(shipId),Number(targetHpPct)||100,{training:true,missionId:4});
}
module.exports={MISSIONS,getState,start,claim,action,recordEvidence,ensureStarterFleet,getFrontierState,getRepairQuote};

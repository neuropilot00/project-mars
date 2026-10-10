const crypto=require('crypto');
const {pool}=require('../db');
const {assertFleetsNotMining}=require('./fleetOccupancy');
const CATALOG=Object.freeze([
  {id:'escort',title_ko:'보급선 호위',title_en:'Supply convoy escort',title_ja:'補給船護衛',title_zh:'补给舰护航',target_seconds:120,deadline_seconds:150,max_player_fleets:2,
    description_ko:'보급선이 120초 항로를 완주하도록 보호하세요. 보급 기함 격침·내 함대 전멸은 실패입니다.',description_en:'Protect the convoy through a 120-second route. Losing its flagship or all your fleets fails the operation.',
    description_ja:'補給船を120秒の航路で守りましょう。補給旗艦撃沈・自艦隊全滅で失敗します。',description_zh:'保护补给舰完成120秒航线，补给旗舰沉没或己方舰队全灭即失败。'},
  {id:'hold',title_ko:'중앙 중계소 유지',title_en:'Hold the central relay',title_ja:'中央中継所の維持',title_zh:'守住中央中继站',target_seconds:90,deadline_seconds:150,max_player_fleets:3,
    description_ko:'중앙 원 안에서 적 함대가 진입하지 않은 시간 90초를 누적하세요. 진형과 기동으로 점유를 지키세요.',description_en:'Accumulate 90 seconds inside the central zone while no enemy fleet occupies it. Use formation and movement to retain control.',
    description_ja:'中央円内で敵艦隊のいない時間を90秒蓄積します。陣形と機動で占有を維持しましょう。',description_zh:'在中央区域内累计90秒无敌方舰队占据的时间，利用阵形与机动维持控制。'},
  {id:'flagship',title_ko:'적 지휘함 우선 격파',title_en:'Priority flagship strike',title_ja:'敵指揮艦の優先撃破',title_zh:'优先击破敌指挥舰',target_seconds:120,deadline_seconds:150,max_player_fleets:3,recommended_armed_hulls:6,
    description_ko:'150초 안에 표시된 지휘 기함을 격파하세요. 호위대를 모두 격파할 필요는 없습니다. 전투 함체 6척 이상을 권장합니다.',description_en:'Destroy the marked command flagship within 150 seconds. Eliminating every escort is unnecessary. Six or more combat hulls are recommended.',
    description_ja:'150秒以内に標示された指揮旗艦を撃破します。護衛全滅は不要です。戦闘船体6隻以上を推奨します。',description_zh:'在150秒内击沉标记的指挥旗舰，无需击沉所有护航舰，建议至少六艘战斗舰体。'}
]);
const fail=(code,meta)=>{const e=new Error(code);e.meta=meta;throw e;};
const low=v=>String(v||'').trim().toLowerCase();
const idKey=v=>{const text=String(v);if(!/^[1-9]\d{0,18}$/.test(text)||BigInt(text)>9223372036854775807n||(typeof v==='number'&&!Number.isSafeInteger(v)))fail('INVALID_FLEET_ID');return text;};
const fleetIds=values=>{if(!Array.isArray(values)||!values.length)fail('FLEET_REQUIRED');return [...new Set(values.map(idKey))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);};

async function refreshRuns(db,wallet) {
  await db.query(`UPDATE objective_operation_runs r SET status=CASE WHEN b.winner_side='atk' THEN 'succeeded' ELSE 'failed' END,
    settled_at=COALESCE(r.settled_at,b.ended_at),result=b.battle_summary->'objective_result'
    FROM fleet_battles b WHERE b.id=r.battle_id AND LOWER(r.wallet_address)=$1 AND r.status IN('queued','active') AND b.status='ended'`,[low(wallet)]);
  await db.query(`UPDATE objective_operation_runs r SET status='aborted',settled_at=NOW() FROM fleet_battles b
    WHERE b.id=r.battle_id AND LOWER(r.wallet_address)=$1 AND r.status IN('queued','active') AND b.status='cancelled'`,[low(wallet)]);
}
async function getState(wallet) {
  const w=low(wallet);await refreshRuns(pool,w);
  const {rows:fleets}=await pool.query(`SELECT f.id,f.name,f.is_in_battle,f.current_battle_id,f.formation,f.movement,
    COUNT(s.id)::int AS ships_alive,COUNT(s.id) FILTER(WHERE st.fire_type NOT IN('repair','ew'))::int AS armed_hulls,
    COALESCE(SUM(s.current_hp),0) AS current_hp,
    EXISTS(SELECT 1 FROM ship_mining_jobs m WHERE m.fleet_id=f.id AND m.status='mining') AS mining,
    EXISTS(SELECT 1 FROM frontier_cargo c WHERE c.fleet_id=f.id AND c.status='moving') AS transporting
    FROM fleets f LEFT JOIN ships s ON s.fleet_id=f.id AND s.is_alive AND s.current_hp>0 LEFT JOIN ship_types st ON st.code=s.ship_type_code
    WHERE LOWER(f.owner_wallet)=$1 GROUP BY f.id ORDER BY f.id`,[w]);
  const {rows:runs}=await pool.query(`SELECT r.*,b.status AS battle_status,b.winner_side,b.battle_summary->'objective_result' AS objective_result FROM objective_operation_runs r JOIN fleet_battles b ON b.id=r.battle_id WHERE LOWER(r.wallet_address)=$1 ORDER BY r.started_at DESC LIMIT 12`,[w]);
  return {catalog:CATALOG,fleets,runs,policy:{permanent_loss:false,hull_floor_pct:15,currency_rewards:false,salvage:false,actual_catalog_stats:true,normal_fleet_count:[3,5]}};
}
async function addNpc(db,faction,name,types,isConvoy=false) {
  const wallet='0x'+crypto.randomUUID().replaceAll('-','');
  await db.query(`INSERT INTO users(wallet_address,nickname,faction_code,is_ai,is_objective_npc,ai_difficulty,gp_balance) VALUES($1,$2,$3,true,true,'easy',0)`,[wallet,name,faction]);
  const fleet=(await db.query(`INSERT INTO fleets(owner_wallet,name,is_npc,formation,movement) VALUES($1,$2,true,$3,'advance') RETURNING id`,[wallet,name,isConvoy?'vanguard':'wedge'])).rows[0];
  const ships=[];
  for(let i=0;i<types.length;i++) {
    const st=types[i];
    const ship=(await db.query(`INSERT INTO ships(fleet_id,ship_type_code,owner_wallet,current_hp,max_hp,is_flagship,is_alive,built_at,built_by_wallet,quality)
      VALUES($1,$2,$3,$4,$4,$5,true,NOW(),$3,'common') RETURNING id`,[fleet.id,st.code,wallet,st.base_hp,i===0])).rows[0];ships.push(idKey(ship.id));
  }
  return {id:idKey(fleet.id),wallet,ships};
}
async function createOperation(wallet,mode,body={},options={}) {
  const def=CATALOG.find(x=>x.id===mode);if(!def)fail('INVALID_OPERATION');
  const ids=fleetIds(body.fleetIds);if(ids.length>def.max_player_fleets)fail('TOO_MANY_FLEETS');
  const requestKey=String(body.requestKey||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey))fail('INVALID_REQUEST_KEY');
  const w=low(wallet),db=await pool.connect();let result;
  try {
    await db.query('BEGIN');
    const user=(await db.query(`SELECT wallet_address,faction_code,is_ai FROM users WHERE LOWER(wallet_address)=$1 FOR UPDATE`,[w])).rows[0];
    if(!user||user.is_ai)fail('PLAYER_REQUIRED');if(!user.faction_code)fail('NO_FACTION');
    await refreshRuns(db,w);
    const prior=(await db.query(`SELECT battle_id,mode,fleet_ids FROM objective_operation_runs WHERE wallet_address=$1 AND request_key=$2`,[user.wallet_address,requestKey])).rows[0];
    if(prior){if(prior.mode!==mode||JSON.stringify(prior.fleet_ids)!==JSON.stringify(ids))fail('REQUEST_KEY_REUSED');await db.query('COMMIT');return {success:true,battleId:idKey(prior.battle_id),mode,reused:true};}
    if((await db.query(`SELECT 1 FROM objective_operation_runs WHERE wallet_address=$1 AND status IN('queued','active')`,[user.wallet_address])).rows.length)fail('OPERATION_ALREADY_ACTIVE');
    const fleets=(await db.query(`SELECT * FROM fleets WHERE id=ANY($1::bigint[]) AND LOWER(owner_wallet)=$2 ORDER BY id FOR UPDATE`,[ids,w])).rows;
    if(fleets.length!==ids.length)fail('FLEET_NOT_FOUND');if(fleets.some(f=>f.is_in_battle||f.current_battle_id))fail('FLEET_IN_BATTLE');
    await assertFleetsNotMining(db,ids);
    const ships=(await db.query(`SELECT s.id,s.fleet_id,st.fire_type FROM ships s JOIN ship_types st ON st.code=s.ship_type_code WHERE s.fleet_id=ANY($1::bigint[]) AND LOWER(s.owner_wallet)=$2 AND s.is_alive AND s.current_hp>0 ORDER BY s.id FOR UPDATE OF s`,[ids,w])).rows;
    if(ids.some(id=>!ships.some(s=>idKey(s.fleet_id)===id)))fail('FLEET_EMPTY');
    if(ships.length>30)fail('OPERATION_HULL_LIMIT',{max:30});
    const catalog=(await db.query(`SELECT * FROM ship_types WHERE is_active AND size_class='frigate' AND faction_code IN('mcc','fsp','cv') ORDER BY build_gp_cost,code`)).rows;
    const combat=catalog.find(t=>t.faction_code==='cv'&&t.role==='tackle')||catalog.find(t=>!['repair','ew'].includes(t.fire_type));
    const dps=catalog.find(t=>t.faction_code==='cv'&&t.role==='dps')||combat;
    const logi=catalog.find(t=>t.role==='logi')||combat;
    if(!combat||!dps||!logi)fail('OPERATION_CATALOG_UNAVAILABLE');
    const npcs=[];let convoy,target;
    if(mode==='escort') {convoy=await addNpc(db,logi.faction_code,'보급선 convoy',[logi,combat],true);npcs.push({...convoy,side:'atk'});}
    const primary=await addNpc(db,combat.faction_code,mode==='flagship'?'지휘 기함 command':'차단 경비대 A',mode==='flagship'?[combat,dps,dps]:[combat,dps]);
    const secondary=await addNpc(db,combat.faction_code,'차단 경비대 B',[combat,dps]);
    npcs.push({...primary,side:'def'},{...secondary,side:'def'});target=primary.ships[0];
    const positions={};
    ids.forEach((id,i)=>{positions[id]={cx:mode==='hold'?450:180+i*25,cy:140+i*80};});
    positions[primary.id]={cx:mode==='hold'?820:720,cy:130};positions[secondary.id]={cx:mode==='hold'?800:780,cy:310};
    if(convoy)positions[convoy.id]={cx:200,cy:220};
    const config={version:1,kind:mode,playerWallet:w,playerFleetIds:ids,npcFleetIds:npcs.map(n=>n.id),targetShipId:target,targetFleetId:primary.id,
      convoyFleetId:convoy?.id||null,convoyShipId:convoy?.ships[0]||null,deadlineSeconds:150,holdTargetSeconds:90,
      zone:{cx:500,cy:220,radius:170},route:{start:{cx:200,cy:220},end:{cx:500,cy:220},durationSeconds:120},positions};
    const summary={is_objective_operation:true,is_ai_battle:true,trusted_source:'objective_ops',objective_mode:mode,objective_wallet:w,
      objective:config,risk_policy:{permanent_loss:false,hull_floor_pct:15,generic_rewards:false}};
    const battle=(await db.query(`INSERT INTO fleet_battles(battle_type,status,scheduled_start_at,battle_summary) VALUES('event','preparing',NOW(),$1) RETURNING id`,[JSON.stringify(summary)])).rows[0];
    const battleId=idKey(battle.id);
    for(const participant of [...fleets.map(f=>({id:idKey(f.id),wallet:user.wallet_address,side:'atk'})),...npcs]) {
      await db.query(`INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side,ships_at_start,hp_at_start)
        SELECT $1,$2,$3,$4,COUNT(*),COALESCE(SUM(current_hp),0) FROM ships WHERE fleet_id=$2 AND is_alive`,[battleId,participant.id,participant.wallet,participant.side]);
      await db.query(`UPDATE fleets SET is_in_battle=true,current_battle_id=$2 WHERE id=$1`,[participant.id,battleId]);
    }
    await db.query(`INSERT INTO objective_operation_runs(battle_id,wallet_address,mode,request_key,fleet_ids,config) VALUES($1,$2,$3,$4,$5,$6)`,[battleId,user.wallet_address,mode,requestKey,JSON.stringify(ids),JSON.stringify(config)]);
    await db.query('COMMIT');result={success:true,battleId,mode,reused:false,objective:config,policy:{permanent_loss:false,currency_rewards:false}};
  } catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  if(options.dispatch!==false) require('./battleScheduler').runBattle(result.battleId).catch(error=>console.error('[objective-ops] dispatch failed:',error.message));
  return result;
}
async function getRun(wallet,battleId) {
  const w=low(wallet);await refreshRuns(pool,w);
  const {rows}=await pool.query(`SELECT r.*,b.status AS battle_status,b.winner_side,b.battle_summary->'objective_result' AS objective_result FROM objective_operation_runs r JOIN fleet_battles b ON b.id=r.battle_id WHERE r.battle_id=$1 AND LOWER(r.wallet_address)=$2`,[idKey(battleId),w]);
  if(!rows[0])fail('OPERATION_NOT_FOUND');return {run:rows[0]};
}

// These hooks are called by both authoritative engine loops. No DB or per-tick asset writes.
async function loadRegisteredObjective(db,battle) {
  const participants=(await db.query(`SELECT p.fleet_id,p.wallet_address,p.side,u.is_ai,u.is_objective_npc FROM fleet_battle_participants p JOIN users u ON LOWER(u.wallet_address)=LOWER(p.wallet_address) WHERE p.battle_id=$1`,[battle.id])).rows;
  const summary=battle.battle_summary||{},hasNpc=participants.some(p=>p.is_objective_npc);
  if(!hasNpc && summary.is_objective_operation!==true)return null;
  const row=(await db.query(`SELECT wallet_address,mode,config FROM objective_operation_runs WHERE battle_id=$1`,[battle.id])).rows[0];
  if(!row||summary.trusted_source!=='objective_ops'||summary.is_ai_battle!==true||summary.is_objective_operation!==true||low(summary.objective_wallet)!==low(row.wallet_address))fail('OBJECTIVE_NPC_REQUIRES_REGISTERED_BATTLE');
  const config=row.config;
  if(!CATALOG.some(c=>c.id===row.mode)||config.kind!==row.mode||participants.length<3||participants.length>5||
    participants.some(p=>!p.is_objective_npc&&(p.is_ai||p.side!=='atk'||low(p.wallet_address)!==low(row.wallet_address)))||
    participants.filter(p=>p.side==='def').some(p=>!p.is_objective_npc)||
    config.playerFleetIds.some(id=>!participants.some(p=>idKey(p.fleet_id)===id&&!p.is_objective_npc))||
    config.npcFleetIds.some(id=>!participants.some(p=>idKey(p.fleet_id)===id&&p.is_objective_npc)))fail('UNREGISTERED_OBJECTIVE_PARTICIPANT');
  return config;
}
function initObjective(state,config) {
  if(!config)return;
  state.objective={config,elapsedSeconds:0,holdSeconds:0,lastTick:-1,progress:{kind:config.kind,elapsed_seconds:0,deadline_seconds:config.deadlineSeconds,complete:false}};
  for(const fleet of state.fleets){const position=config.positions[String(fleet.id)];if(position){fleet.cx=position.cx;fleet.cy=position.cy;for(const ship of fleet.ships){ship.x=position.cx;ship.y=position.cy;}}}
}
function beforeTick(state) {
  const objective=state.objective;if(!objective)return;
  const config=objective.config;if(config.kind!=='escort')return;
  const convoy=state.fleets.find(f=>String(f.id)===config.convoyFleetId);if(!convoy)return;
  const ratio=Math.min(1,(objective.elapsedSeconds+(state.liveTickMs||200)/1000)/config.route.durationSeconds);
  convoy.cx=config.route.start.cx+(config.route.end.cx-config.route.start.cx)*ratio;
  convoy.cy=config.route.start.cy+(config.route.end.cy-config.route.start.cy)*ratio;
  convoy.vcx=0;convoy.vcy=0;
}
function evaluateObjective(state) {
  const objective=state.objective;if(!objective)return null;
  if(objective.lastTick===state.tick)return objective.progress.complete?{winner_side:objective.winnerSide,progress:objective.progress}:null;
  const config=objective.config,dt=(state.liveTickMs||200)/1000;
  objective.elapsedSeconds+=dt;objective.lastTick=state.tick;
  const live=f=>!f.retreated&&f.ships.some(s=>s.isAlive&&!s.withdrawn);
  const player=state.fleets.filter(f=>config.playerFleetIds.includes(String(f.id)));
  const targetShip=state.fleets.flatMap(f=>f.ships).find(s=>String(s.id)===config.targetShipId);
  const convoyShip=state.fleets.flatMap(f=>f.ships).find(s=>String(s.id)===config.convoyShipId);
  let winner=null,reason=null;
  const progress={kind:config.kind,elapsed_seconds:Math.round(objective.elapsedSeconds*10)/10,deadline_seconds:config.deadlineSeconds,
    target_ship_id:config.kind==='escort'?config.convoyShipId:config.kind==='flagship'?config.targetShipId:null,target_fleet_id:config.kind==='escort'?config.convoyFleetId:config.kind==='flagship'?config.targetFleetId:null,
    target_hp:config.kind==='escort'?convoyShip?.hp||0:config.kind==='flagship'?targetShip?.hp||0:null};
  if(!player.some(live)){winner='def';reason='player_eliminated';}
  else if(config.kind==='escort') {
    progress.route_progress=Math.min(1,objective.elapsedSeconds/config.route.durationSeconds);
    progress.route_target_seconds=config.route.durationSeconds;
    if(!convoyShip?.isAlive||convoyShip.withdrawn){winner='def';reason='convoy_lost';}
    else if(objective.elapsedSeconds+1e-7>=config.route.durationSeconds){winner='atk';reason='convoy_arrived';}
  } else if(config.kind==='hold') {
    const inZone=f=>Math.hypot(f.cx-config.zone.cx,f.cy-config.zone.cy)<=config.zone.radius;
    const controlling=player.some(f=>live(f)&&inZone(f)),contested=state.fleets.some(f=>f.side==='def'&&live(f)&&inZone(f));
    if(controlling&&!contested)objective.holdSeconds+=dt;
    progress.zone=config.zone;progress.hold_seconds=Math.round(objective.holdSeconds*10)/10;progress.hold_target_seconds=config.holdTargetSeconds;progress.contested=contested;progress.player_in_zone=controlling;
    if(objective.holdSeconds+1e-7>=config.holdTargetSeconds){winner='atk';reason='relay_held';}
  } else if(config.kind==='flagship') {
    if(targetShip&&!targetShip.isAlive){winner='atk';reason='flagship_destroyed';}
  }
  if(!winner&&objective.elapsedSeconds+1e-7>=config.deadlineSeconds){winner='def';reason='objective_deadline';}
  progress.complete=!!winner;progress.success=winner==='atk';progress.reason=reason;objective.progress=progress;objective.winnerSide=winner;
  return winner?{winner_side:winner,progress}:null;
}
module.exports={CATALOG,getState,createOperation,getRun,loadRegisteredObjective,initObjective,beforeTick,evaluateObjective};

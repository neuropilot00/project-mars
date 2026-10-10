const { pool } = require('../db');
const CATALOG = Object.freeze([
 { code:'rail_amp',slot:'weapon',name_en:'Rail Amplifier',name_ko:'레일 증폭기',icon:'⌁',gain:'atk',loss:'def' },
 { code:'burst_lens',slot:'weapon',name_en:'Burst Lens',name_ko:'버스트 렌즈',icon:'◎',gain:'atk',loss:'speed' },
 { code:'reactive_plate',slot:'armor',name_en:'Reactive Plating',name_ko:'반응 장갑',icon:'⬡',gain:'def',loss:'speed' },
 { code:'layered_plate',slot:'armor',name_en:'Layered Plating',name_ko:'적층 장갑',icon:'▱',gain:'def',loss:'atk' },
 { code:'ion_drive',slot:'engine',name_en:'Ion Drive',name_ko:'이온 추진기',icon:'↗',gain:'speed',loss:'def' },
 { code:'vector_drive',slot:'engine',name_en:'Vector Drive',name_ko:'벡터 추진기',icon:'➤',gain:'speed',loss:'atk' }
]);
const key = value => String(value || '').toLowerCase().trim();
const fail = code => { throw Error(code); };
function id(value) { if (!/^[1-9]\d*$/.test(String(value))) fail('INVALID_ID'); return String(value); }
function cost(level=0) { return { gp:100+50*level, minerals:{ iron_dust:20+10*level,hull_plate:2+level } }; }
function effects(part) {
 const type=CATALOG.find(p=>p.code===part.part_code); if(!type) fail('INVALID_PART');
 const level=Number(part.level); if(!Number.isInteger(level)||level<0||level>3) fail('INVALID_LEVEL');
 const result={ part_code:type.code,slot:type.slot,level,atk_pct:0,def_pct:0,speed_pct:0 };
 result[type.gain+'_pct']=6+2*level; result[type.loss+'_pct']=-(4+level); return result;
}
// Multipliers stack additively and apply to the existing total; bonus_* metadata remains intact.
function applyShipPartStats(ship, parts=[]) {
 const result={...ship}; const totals={atk:0,def:0,speed:0};
 for(const part of parts) for(const stat of Object.keys(totals)) totals[stat]+=Number(part[stat+'_pct'])||0;
 for(const stat of Object.keys(totals)) {
   const base=Number(ship['base_'+stat])||0,bonus=Number(ship['bonus_'+stat])||0;
   const total=(base+bonus)*(1+totals[stat]/100);
   result['base_'+stat]=(stat==='speed'?Math.round(total*100)/100:Math.round(total))-bonus;
 }
 result.part_effects=parts; return result;
}
async function loadShipPartEffects(shipIds, db=pool) {
 if(!shipIds.length) return {};
 const {rows}=await db.query(`SELECT p.* FROM ship_part_cards p JOIN ships s ON s.id=p.ship_id
  WHERE p.ship_id=ANY($1::bigint[]) AND s.is_alive AND p.wallet_address=LOWER(s.owner_wallet) ORDER BY p.id`,[shipIds]);
 const out={}; for(const p of rows) (out[p.ship_id] ||= []).push(effects(p)); return out;
}
async function transaction(run) { const c=await pool.connect();try { await c.query('BEGIN');const result=await run(c);await c.query('COMMIT');return result; }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();} }
async function guardShip(c,w,shipId) {
 const initial=(await c.query('SELECT fleet_id FROM ships WHERE id=$1 AND LOWER(owner_wallet)=$2 AND is_alive',[id(shipId),w])).rows[0];
 if(!initial) fail('SHIP_NOT_FOUND');
 if(initial.fleet_id) {
   const fleet=(await c.query('SELECT * FROM fleets WHERE id=$1 FOR UPDATE',[initial.fleet_id])).rows[0];
   if(!fleet || key(fleet.owner_wallet)!==w) fail('SHIP_NOT_FOUND');
   if(fleet.is_in_battle || fleet.current_battle_id) fail('SHIP_IN_BATTLE');
   if((await c.query(`SELECT 1 FROM fleet_battle_participants p JOIN fleet_battles b ON b.id=p.battle_id WHERE p.fleet_id=$1 AND b.status IN ('preparing','active') LIMIT 1`,[fleet.id])).rowCount) fail('SHIP_IN_BATTLE');
   if((await c.query("SELECT 1 FROM ship_mining_jobs WHERE fleet_id=$1 AND status='mining' LIMIT 1",[fleet.id])).rowCount) fail('SHIP_MINING');
   if((await c.query("SELECT 1 FROM frontier_cargo WHERE fleet_id=$1 AND status='moving' LIMIT 1",[fleet.id])).rowCount) fail('SHIP_TRANSPORTING');
   if((await c.query("SELECT 1 FROM siege_fleet_commits c JOIN governor_sieges g ON g.id=c.siege_id WHERE c.fleet_id=$1 AND g.status NOT IN ('ended','cancelled','resolved') LIMIT 1",[fleet.id])).rowCount) fail('SHIP_IN_BATTLE');
 }
 const ship=(await c.query('SELECT * FROM ships WHERE id=$1 AND LOWER(owner_wallet)=$2 AND is_alive FOR UPDATE',[shipId,w])).rows[0];
 if(!ship) fail('SHIP_NOT_FOUND');
 if(String(ship.fleet_id)!==String(initial.fleet_id)) fail('SHIP_CHANGED');
 if(ship.is_market_listed) fail('SHIP_LISTED_FOR_SALE');
 return ship;
}
async function spend(c,w,quote) {
 const user=(await c.query('SELECT wallet_address,gp_balance FROM users WHERE LOWER(wallet_address)=$1 FOR UPDATE',[w])).rows[0];
 if(!user) fail('USER_NOT_FOUND');
 if(Number(user.gp_balance)<quote.gp) fail('INSUFFICIENT_GP');
 const rows=(await c.query(`SELECT r.id,r.code,i.quantity FROM resources r LEFT JOIN user_resource_inventory i ON i.resource_id=r.id AND LOWER(i.wallet_address)=$1
 WHERE r.code=ANY($2::text[]) ORDER BY r.id`,[w,Object.keys(quote.minerals)])).rows;
 for(const [code,need] of Object.entries(quote.minerals)) {
   const resource=rows.find(r=>r.code===code);if(!resource||Number(resource.quantity)<need) fail('INSUFFICIENT_MINERALS');
   if(!(await c.query('UPDATE user_resource_inventory SET quantity=quantity-$1,updated_at=NOW() WHERE LOWER(wallet_address)=$2 AND resource_id=$3 AND quantity >= $1',[need,w,resource.id])).rowCount) fail('INSUFFICIENT_MINERALS');
 }
 if(!(await c.query('UPDATE users SET gp_balance=gp_balance-$1 WHERE wallet_address=$2 AND gp_balance >= $1',[quote.gp,user.wallet_address])).rowCount) fail('INSUFFICIENT_GP');
}
async function event(c,w,part,action,detail={}) { await c.query('INSERT INTO ship_part_events(wallet_address,part_id,ship_id,action,detail) VALUES($1,$2,$3,$4,$5)',[w,part.id,part.ship_id,action,JSON.stringify(detail)]); }
async function craft(wallet,code) { const w=key(wallet),type=CATALOG.find(p=>p.code===code);if(!type) fail('INVALID_PART');
 return transaction(async c=>{await spend(c,w,cost());const part=(await c.query('INSERT INTO ship_part_cards(wallet_address,part_code,slot) VALUES($1,$2,$3) RETURNING *',[w,code,type.slot])).rows[0];await event(c,w,part,'craft',cost());return {success:true,part};}); }
async function mutate(wallet,partId,action,shipId,expectedLevel) { const w=key(wallet);id(partId);
 return transaction(async c=>{
 const initial=(await c.query('SELECT * FROM ship_part_cards WHERE id=$1 AND wallet_address=$2',[partId,w])).rows[0];if(!initial) fail('PART_NOT_FOUND');
 if(action==='equip') { id(shipId);if(initial.ship_id && String(initial.ship_id)!==String(shipId)) fail('PART_ALREADY_EQUIPPED');await guardShip(c,w,shipId); }
 else if(initial.ship_id) await guardShip(c,w,initial.ship_id);
 const part=(await c.query('SELECT * FROM ship_part_cards WHERE id=$1 AND wallet_address=$2 FOR UPDATE',[partId,w])).rows[0];if(!part) fail('PART_NOT_FOUND');
 if(String(part.ship_id)!==String(initial.ship_id)) fail('PART_CHANGED');
 if(action==='upgrade') {
   if(!Number.isInteger(expectedLevel)||expectedLevel!==Number(part.level)) fail('LEVEL_CHANGED');
   if(part.level>=3) fail('MAX_LEVEL');const quote=cost(part.level+1);await spend(c,w,quote);
   part.level=(await c.query('UPDATE ship_part_cards SET level=level+1 WHERE id=$1 RETURNING level',[part.id])).rows[0].level;await event(c,w,part,action,quote);
 } else if(action==='equip') {
   if(String(part.ship_id)===String(shipId)) return {success:true,part};
   if((await c.query('SELECT 1 FROM ship_part_cards WHERE ship_id=$1 AND slot=$2',[shipId,part.slot])).rowCount) fail('SLOT_OCCUPIED');
   part.ship_id=(await c.query('UPDATE ship_part_cards SET ship_id=$2 WHERE id=$1 RETURNING ship_id',[part.id,shipId])).rows[0].ship_id;await event(c,w,part,action);
 } else if(action==='unequip') { await event(c,w,part,action);await c.query('UPDATE ship_part_cards SET ship_id=NULL WHERE id=$1',[part.id]);part.ship_id=null; }
 else fail('INVALID_ACTION');
 return {success:true,part};
 }); }
async function state(wallet) {
 const w=key(wallet);
 const ships=(await pool.query(`SELECT s.*,st.name_en,st.name_ko,st.size_class,st.role,st.faction_code,st.base_atk,st.base_def,st.base_speed,fl.name AS fleet_name
  FROM ships s JOIN ship_types st ON st.code=s.ship_type_code LEFT JOIN fleets fl ON fl.id=s.fleet_id WHERE LOWER(s.owner_wallet)=$1 AND s.is_alive ORDER BY s.id`,[w])).rows;
 const parts=(await pool.query('SELECT * FROM ship_part_cards WHERE wallet_address=$1 ORDER BY id',[w])).rows.map(p=>({...p,effects:effects(p),upgrade_cost:p.level<3?cost(p.level+1):null}));
 const user=(await pool.query('SELECT gp_balance FROM users WHERE LOWER(wallet_address)=$1',[w])).rows[0];if(!user) fail('USER_NOT_FOUND');
 const resources=(await pool.query(`SELECT r.code,COALESCE(i.quantity,0) AS quantity FROM resources r LEFT JOIN user_resource_inventory i ON i.resource_id=r.id AND LOWER(i.wallet_address)=$1 WHERE r.code IN ('iron_dust','hull_plate')`,[w])).rows;
 const catalog=(await pool.query(`SELECT st.code,st.name_en,st.name_ko,st.faction_code,st.size_class,st.role,st.base_hp,st.base_atk,st.base_def,st.base_speed,c.qualities,c.discovered_at,
  (SELECT COUNT(*)::int FROM ships s WHERE LOWER(s.owner_wallet)=$1 AND s.ship_type_code=st.code AND s.is_alive) AS alive_count
  FROM ship_types st LEFT JOIN ship_collection c ON c.ship_type_code=st.code AND c.wallet_address=$1 WHERE st.is_active ORDER BY st.faction_code,st.sort_order`,[w])).rows;
 return {catalog,ships:ships.map(s=>({...s,fitting_stats:applyShipPartStats(s,parts.filter(p=>String(p.ship_id)===String(s.id)).map(p=>p.effects))})),parts,
  part_catalog:CATALOG.map(p=>({...p,craft_cost:cost(),effects:effects({part_code:p.code,level:0})})),gp_balance:Number(user.gp_balance),resources,policy:{max_level:3,permanent_loss:true,trade_follows_hull:true,slots:['weapon','armor','engine']}};
}
module.exports={CATALOG,cost,effects,applyShipPartStats,loadShipPartEffects,state,craft,mutate};

const { pool } = require('../db');
const { addResourcesToInventory } = require('./resource');
// Hard daily maxima, shared by preview and settlement. No GP/PP is issued here.
const DAILY_LIMITS = Object.freeze({ iron_dust:240, hull_plate:80, alloy_frame:40, plasma_coil:18, rare_metal:12 });
const fail = (code,meta) => { const error=new Error(code); error.meta=meta; throw error; };
const walletKey = value => String(value || '').toLowerCase().trim();

function boundedDrops(resources, used = {}) {
  const src=resources && typeof resources==='object' && !Array.isArray(resources) ? resources : {};
  const requested={},drops=[],remaining={};
  for (const [code,limit] of Object.entries(DAILY_LIMITS)) {
    const available=Math.max(0,limit-(Number(used[code])||0));
    remaining[code]=available;
    const raw=Number(src[code]);
    const qty=Number.isFinite(raw) ? Math.max(0,Math.floor(raw)) : 0;
    if (qty>0) {
      requested[code]=qty;
      if (Math.min(qty,available)>0) drops.push({code,quantity:Math.min(qty,available)});
    }
  }
  return { drops, requested, remaining, capped:Object.entries(requested).some(([code,qty])=>qty>remaining[code]) };
}
async function budgetState(wallet, db=pool) {
  const { rows }=await db.query(`SELECT resource_code,quantity,budget_day FROM ship_salvage_daily_budget WHERE wallet_address=$1 AND budget_day=CURRENT_DATE`,[walletKey(wallet)]);
  const used=Object.fromEntries(rows.map(row=>[row.resource_code,Number(row.quantity)]));
  const { rows: dates }=await db.query(`SELECT CURRENT_DATE::text AS budget_day, current_setting('TIMEZONE') AS timezone`);
  return {daily_limits:DAILY_LIMITS,used,remaining:boundedDrops({},used).remaining,budget_day:dates[0].budget_day,timezone:dates[0].timezone,
    policy:{ai_practice:false,self_kill:false,live_hull:false,one_claim_per_lost_hull:true,currency_reward:false}};
}
async function eligibleWreck(db,wallet,id,lock=false) {
  if (!/^[1-9]\d*$/.test(String(id))) fail('INVALID_ID');
  const { rows }=await db.query(`SELECT w.*,s.owner_wallet AS source_owner,s.is_alive AS source_alive,s.destroyed_at,s.destroyed_reason,
      u.wallet_address AS victim_user,u.is_ai AS victim_is_ai,b.status AS battle_status,b.battle_type,b.battle_summary,b.battle_started_at,b.ended_at,
      EXISTS(SELECT 1 FROM fleet_battle_participants p JOIN users pu ON LOWER(pu.wallet_address)=LOWER(p.wallet_address) WHERE p.battle_id=w.battle_id AND COALESCE(pu.is_ai,false)) AS ai_participant,
      EXISTS(SELECT 1 FROM fleet_battle_participants p WHERE p.battle_id=w.battle_id AND LOWER(p.wallet_address)=LOWER(w.killer_wallet) AND p.side=w.killer_side) AS killer_participant,
      EXISTS(SELECT 1 FROM fleet_battle_participants p WHERE p.battle_id=w.battle_id AND LOWER(p.wallet_address)=LOWER(w.original_owner) AND p.side=w.victim_side) AS victim_participant,
      EXISTS(SELECT 1 FROM starter_fleet_grant_ships g WHERE g.ship_id=w.ship_instance_id) AS starter_grant_source
    FROM ship_wrecks w LEFT JOIN ships s ON s.id=w.ship_instance_id LEFT JOIN users u ON LOWER(u.wallet_address)=LOWER(w.original_owner)
    LEFT JOIN fleet_battles b ON b.id=w.battle_id WHERE w.id=$1${lock?' FOR UPDATE OF w':''}`,[id]);
  const wreck=rows[0];
  if (!wreck) fail('WRECK_NOT_FOUND');
  if (walletKey(wreck.killer_wallet)!==wallet) fail('NOT_KILLER');
  if (wreck.salvaged_by) fail('ALREADY_SALVAGED');
  if (!wreck.expires_at || new Date(wreck.expires_at)<=new Date()) fail('WRECK_EXPIRED');
  if (!wreck.victim_user || !wreck.source_owner || walletKey(wreck.source_owner)!==walletKey(wreck.original_owner)) fail('UNVERIFIED_LOSS');
  if (walletKey(wreck.original_owner)===wallet) fail('SELF_SALVAGE_FORBIDDEN');
  if (wreck.starter_grant_source) fail('STARTER_HULL_SALVAGE_FORBIDDEN');
  const summary=wreck.battle_summary || {};
  if (wreck.victim_is_ai || wreck.ai_participant || summary.is_ai_battle===true || summary.is_ai_battle==='true' || summary.is_starter_battle===true || summary.starter_training===true || summary.trusted_source==='starter_ops' || summary.competitive_budget===true || /ai|practice|campaign|ranked/i.test(wreck.battle_type || '')) fail('PRACTICE_SALVAGE_FORBIDDEN');
  if (wreck.source_alive || !wreck.destroyed_at || wreck.destroyed_reason==='scrapped') fail('HULL_NOT_LOST');
  if (wreck.battle_status!=='ended' || !wreck.ended_at || !wreck.killer_participant || !wreck.victim_participant || wreck.killer_side===wreck.victim_side) fail('UNSETTLED_LOSS');
  if (!wreck.battle_started_at || new Date(wreck.destroyed_at)<new Date(wreck.battle_started_at) || new Date(wreck.destroyed_at)>new Date(wreck.ended_at).getTime()+10000) fail('UNVERIFIED_LOSS');
  if (lock) {
    // Keep the actual lost source stable through settlement, including concurrent resurrection.
    const source=await db.query(`SELECT is_alive,owner_wallet FROM ships WHERE id=$1 FOR UPDATE`,[wreck.ship_instance_id]);
    if (!source.rows[0] || source.rows[0].is_alive || walletKey(source.rows[0].owner_wallet)!==walletKey(wreck.original_owner)) fail('HULL_NOT_LOST');
  }
  const {rows:claims}=await db.query(`SELECT wreck_id FROM ship_salvage_claims WHERE source_ship_id=$1`,[wreck.ship_instance_id]);
  if (claims.length) fail('HULL_ALREADY_SALVAGED');
  return wreck;
}
async function quoteSalvage(wallet,id) {
  const w=walletKey(wallet),budget=await budgetState(w);
  try {
    const wreck=await eligibleWreck(pool,w,id);
    const offer=boundedDrops(wreck.resources,budget.used);
    return {eligible:offer.drops.length>0 && !offer.capped,...offer,budget,error:offer.capped?'SALVAGE_DAILY_LIMIT':offer.drops.length?null:'NO_RECOVERABLE_RESOURCES'};
  } catch(error) { return {eligible:false,error:error.message,budget}; }
}
async function claimSalvage(wallet,id) {
  const w=walletKey(wallet),client=await pool.connect();
  try {
    await client.query('BEGIN');
    // One lock for all wrecks claimed by this wallet, not merely the same wreck ID.
    const {rows:users}=await client.query(`SELECT wallet_address,is_ai FROM users WHERE LOWER(wallet_address)=$1 FOR UPDATE`,[w]);
    const user=users[0];
    if (!user) fail('USER_NOT_FOUND');
    if (user.is_ai) fail('PRACTICE_SALVAGE_FORBIDDEN');
    const wreck=await eligibleWreck(client,w,id,true);
    const budget=await budgetState(w,client),offer=boundedDrops(wreck.resources,budget.used);
    if (offer.capped) fail('SALVAGE_DAILY_LIMIT',{budget,requested:offer.requested});
    if (!offer.drops.length) fail('NO_RECOVERABLE_RESOURCES',{budget});
    await client.query(`INSERT INTO ship_salvage_claims(wreck_id,source_ship_id,wallet_address,battle_id,drops) VALUES($1,$2,$3,$4,$5)`,[id,wreck.ship_instance_id,w,wreck.battle_id,JSON.stringify(offer.drops)]);
    for (const drop of offer.drops) await client.query(`INSERT INTO ship_salvage_daily_budget(wallet_address,budget_day,resource_code,quantity) VALUES($1,CURRENT_DATE,$2,$3)
      ON CONFLICT(wallet_address,budget_day,resource_code) DO UPDATE SET quantity=ship_salvage_daily_budget.quantity+EXCLUDED.quantity`,[w,drop.code,drop.quantity]);
    await addResourcesToInventory(client,user.wallet_address,offer.drops);
    // Keep the recorded original wreck resources for audit; the claim ledger holds actual issued drops.
    await client.query(`UPDATE ship_wrecks SET salvaged_by=$1,salvaged_at=NOW() WHERE id=$2`,[w,id]);
    const after=await budgetState(w,client);
    await client.query('COMMIT');
    return {success:true,drops:offer.drops,capped:offer.capped,budget:after,forfeited:Object.fromEntries(Object.entries(offer.requested).map(([code,qty])=>[code,qty-(offer.drops.find(d=>d.code===code)?.quantity||0)]).filter(([,qty])=>qty>0))};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally{client.release();}
}
module.exports={DAILY_LIMITS,boundedDrops,budgetState,quoteSalvage,claimSalvage};

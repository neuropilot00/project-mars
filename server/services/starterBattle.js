// Internal first-sortie factory. No route accepts these trusted summary flags.
const crypto = require('crypto');
const { pool } = require('../db');
const { assertFleetsNotMining } = require('./fleetOccupancy');

function fleetKey(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('INVALID_FLEET_ID');
  if (!['string', 'number', 'bigint'].includes(typeof value)) throw new Error('INVALID_FLEET_ID');
  const text = String(value);
  if (!/^\d+$/.test(text) || text.length > 19) throw new Error('INVALID_FLEET_ID');
  const id = BigInt(text);
  if (id <= 0n || id > 9223372036854775807n) throw new Error('INVALID_FLEET_ID');
  return id.toString();
}

async function createInTransaction(client, { wallet, fleetId, missionId }) {
  if (missionId !== 'first_sortie') throw new Error('INVALID_STARTER_MISSION');
  const address = String(wallet || '').trim().toLowerCase();
  const { rows: users } = await client.query('SELECT wallet_address,faction_code,is_ai FROM users WHERE LOWER(wallet_address)=$1 FOR UPDATE', [address]);
  if (!users[0] || users[0].is_ai) throw new Error('PLAYER_REQUIRED');
  const { rows: fleets } = await client.query('SELECT * FROM fleets WHERE id=$1 AND LOWER(owner_wallet)=$2 FOR UPDATE', [fleetKey(fleetId), address]);
  const fleet = fleets[0];
  if (!fleet) throw new Error('FLEET_NOT_FOUND');
  if (fleet.is_in_battle || fleet.current_battle_id) {
    const existing = await client.query(`SELECT id,status,battle_summary FROM fleet_battles WHERE id=$1 AND status IN('preparing','active')`, [fleet.current_battle_id]);
    const summary = existing.rows[0]?.battle_summary;
    if (summary?.trusted_source === 'starter_ops' && summary?.is_starter_battle === true && summary?.missionId === missionId && summary?.starter_wallet === address) {
      return { battleId: String(existing.rows[0].id), status: existing.rows[0].status, missionId, mode: 'training', risk: 'no_permanent_loss', reused: true };
    }
    throw new Error('FLEET_IN_BATTLE');
  }
  await assertFleetsNotMining(client, [fleet.id]);
  const alive = await client.query('SELECT 1 FROM ships WHERE fleet_id=$1 AND is_alive=true AND current_hp>0 LIMIT 1', [fleet.id]);
  if (!alive.rows.length) throw new Error('FLEET_EMPTY');
  const catalog = await client.query(`SELECT code,base_hp FROM ship_types WHERE faction_code=$1 AND is_active=true
    AND size_class='frigate' AND fire_type NOT IN('repair','ew') ORDER BY tier,build_gp_cost,code LIMIT 1`, [users[0].faction_code]);
  if (!catalog.rows[0]) throw new Error('TRAINING_SHIP_TYPE_MISSING');
  const npcWallet = '0x' + crypto.randomUUID().replaceAll('-', '');
  await client.query(`INSERT INTO users(wallet_address,nickname,faction_code,is_ai,ai_difficulty,gp_balance)
    VALUES($1,'훈련 경비대',$2,true,'easy',0)`, [npcWallet, users[0].faction_code]);
  const npc = await client.query(`INSERT INTO fleets(owner_wallet,name,sector_id,is_npc,formation,movement)
    VALUES($1,'첫 출격 훈련 경비대',$2,true,'sphere','advance') RETURNING id`, [npcWallet, fleet.sector_id]);
  await client.query(`INSERT INTO ships(fleet_id,ship_type_code,owner_wallet,current_hp,max_hp,is_flagship,is_alive,built_by_wallet)
    VALUES($1,$2,$3,$4,$4,true,true,$3)`, [npc.rows[0].id, catalog.rows[0].code, npcWallet, catalog.rows[0].base_hp]);
  const summary = { is_starter_battle: true, is_ai_battle: true, starter_training: true,
    trusted_source: 'starter_ops', missionId, starter_wallet: address,
    objective: 'first_sortie', risk_policy: { permanent_loss: false, hull_floor_pct: 15, generic_rewards: false } };
  const battle = await client.query(`INSERT INTO fleet_battles(battle_type,status,sector_id,scheduled_start_at,battle_summary)
    VALUES('event','preparing',$1,NOW(),$2::jsonb) RETURNING id`, [fleet.sector_id, JSON.stringify(summary)]);
  const battleId = String(battle.rows[0].id);
  for (const [id, participant, side] of [[fleet.id,users[0].wallet_address,'atk'],[npc.rows[0].id,npcWallet,'def']]) {
    await client.query(`INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side,ships_at_start,hp_at_start)
      SELECT $1,$2,$3,$4,COUNT(*),COALESCE(SUM(current_hp),0) FROM ships WHERE fleet_id=$2 AND is_alive=true`, [battleId,id,participant,side]);
    await client.query('UPDATE fleets SET is_in_battle=true,current_battle_id=$2 WHERE id=$1', [id,battleId]);
  }
  return { battleId, status: 'preparing', missionId, mode: 'training', risk: 'no_permanent_loss', reused: false };
}

function dispatchBattle(result) {
  // A preparing result may be a retry after a process stopped before dispatch.
  // runBattle's atomic preparing->active claim makes repeated dispatch harmless.
  if (result.status !== 'active') require('./battleScheduler').runBattle(result.battleId).catch(error => console.error('[starterBattle] dispatch failed:', error.message));
  return result;
}

async function createFirstSortie({ client, wallet, fleetId, missionId = 'first_sortie' }) {
  if (client) return createInTransaction(client, { wallet, fleetId, missionId });
  const connection = await pool.connect();
  let result;
  try {
    await connection.query('BEGIN');
    result = await createInTransaction(connection, { wallet, fleetId, missionId });
    await connection.query('COMMIT');
  } catch (error) { await connection.query('ROLLBACK'); throw error; }
  finally { connection.release(); }
  return dispatchBattle(result);
}

module.exports = { createFirstSortie, dispatchBattle };

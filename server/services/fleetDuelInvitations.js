// Consent gate for fleet duels only. Territory/AI/GP-wager battles use their existing paths.
const crypto = require('node:crypto');
const { pool } = require('../db');
const { assertFleetsNotMining } = require('./fleetOccupancy');
const POLICY_KEYS = ['full_loss_mode', 'full_loss_season_active', 'new_player_combat_grace_enabled',
  'new_player_combat_grace_max_rank', 'new_player_combat_grace_max_age_days'];
function fail(code, status = 409) { const e = new Error(code); e.status = status; throw e; }
function id(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) fail('INVALID_ID', 400);
  if (!/^\d{1,19}$/.test(String(value || ''))) fail('INVALID_ID', 400);
  const n = BigInt(value);
  if (n < 1n || n > 9223372036854775807n) fail('INVALID_ID', 400);
  return n.toString();
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toJSON();
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
async function transaction(work) {
  const c = await pool.connect();
  let committed = false;
  try {
    await c.query('BEGIN');
    const result = await work(c);
    await c.query('COMMIT');
    committed = true;
    if (result && result.error) fail(result.error, result.statusCode);
    return result;
  } catch (e) { if (!committed) await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
async function snapshot(c, ids, wallet, mode = 'normal') {
  const { rows: fleets } = await c.query('SELECT * FROM fleets WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE', [ids]);
  const atk = fleets.find(f => String(f.id) === ids[0]);
  const def = fleets.find(f => String(f.id) === ids[1]);
  if (!atk || atk.owner_wallet.toLowerCase() !== wallet) fail('MY_FLEET_NOT_FOUND', 404);
  if (!def) fail('TARGET_FLEET_NOT_FOUND', 404);
  if (def.owner_wallet.toLowerCase() === wallet) fail('CANNOT_ATTACK_OWN_FLEET', 400);
  if (atk.is_in_battle || atk.current_battle_id) fail('MY_FLEET_IN_BATTLE');
  if (def.is_in_battle || def.current_battle_id) fail('TARGET_IN_BATTLE');
  const { rows: users } = await c.query(
    'SELECT wallet_address, is_ai, full_loss_optin FROM users WHERE wallet_address = ANY($1::text[]) ORDER BY wallet_address FOR SHARE',
    [[atk.owner_wallet, def.owner_wallet]]);
  if (users.length !== 2 || users.some(u => u.is_ai) || fleets.some(f => f.is_npc)) fail('USE_AI_PRACTICE', 400);
  const { rows: mining } = await c.query("SELECT fleet_id FROM ship_mining_jobs WHERE fleet_id = ANY($1::bigint[]) AND status = 'mining' LIMIT 1", [ids]);
  if (mining.length) fail(String(mining[0].fleet_id) === ids[0] ? 'MY_FLEET_MINING' : 'TARGET_FLEET_MINING');
  // Cargo start takes this same fleet lock, so no moving transport can race enqueue.
  try { await assertFleetsNotMining(c, ids); }
  catch (e) { if (e.message === 'FLEET_TRANSPORTING' || e.message === 'FLEET_MINING') fail(e.message); throw e; }
  const { rows: siege } = await c.query(`SELECT c.fleet_id FROM siege_fleet_commits c JOIN governor_sieges g ON g.id=c.siege_id
    WHERE c.fleet_id = ANY($1::bigint[]) AND g.status NOT IN ('ended','cancelled','resolved') LIMIT 1`, [ids]);
  if (siege.length) fail('FLEET_IN_SIEGE');
  const { rows: ships } = await c.query('SELECT * FROM ships WHERE fleet_id = ANY($1::bigint[]) AND is_alive ORDER BY id FOR UPDATE', [ids]);
  if (ships.some(s => s.is_market_listed)) fail('FLEET_SHIP_ON_MARKET');
  if (ships.some(s => !fleets.some(f => String(f.id) === String(s.fleet_id) && f.owner_wallet.toLowerCase() === s.owner_wallet.toLowerCase()))) fail('FLEET_SHIP_OWNER_CHANGED');
  const state = fleets.map(f => ({ id: String(f.id), name: f.name, owner_wallet: f.owner_wallet,
    formation: f.formation, movement: f.movement, sector_id: f.sector_id,
    auto_retreat_pct: f.auto_retreat_pct, formation_spread: f.formation_spread, pos_x: f.pos_x, pos_y: f.pos_y,
    ships: ships.filter(s => String(s.fleet_id) === String(f.id)) }));
  if (!state.find(f => f.id === ids[0]).ships.length) fail('MY_FLEET_EMPTY');
  if (!state.find(f => f.id === ids[1]).ships.length) fail('TARGET_EMPTY');
  let terms;
  if (mode === 'standard_v1') {
    const enabled = await c.query("SELECT value #>> '{}' AS value FROM settings WHERE key='standard_duels_enabled' FOR SHARE");
    if (enabled.rows[0]?.value !== 'true') fail('STANDARD_DUELS_DISABLED');
    const codes = [...new Set(ships.map(s => s.ship_type_code))].sort();
    const { rows: catalog } = await c.query(`SELECT code,faction_code,size_class,role,tier,base_hp,base_atk,base_def,base_speed,
      fire_interval,fire_type,shots,render_radius,build_gp_cost,is_active FROM ship_types WHERE code=ANY($1::text[]) ORDER BY code FOR SHARE`, [codes]);
    if (catalog.length !== codes.length || catalog.some(t => !t.is_active || !['frigate','destroyer','cruiser'].includes(t.size_class)
      || !Number.isSafeInteger(Number(t.build_gp_cost)) || Number(t.build_gp_cost) <= 0)) fail('STANDARD_HULL_INELIGIBLE');
    const fleetBudgets = state.map(f => ({ fleet_id:f.id, ships:f.ships.length,
      catalog_budget:f.ships.reduce((sum,s) => sum + Number(catalog.find(t => t.code === s.ship_type_code).build_gp_cost),0) }));
    if (fleetBudgets.some(f => f.ships > 5)) fail('STANDARD_SHIP_LIMIT');
    if (fleetBudgets.some(f => f.catalog_budget > 5000)) fail('STANDARD_BUDGET_EXCEEDED');
    terms = { version:1, permanent_ship_loss_possible:false, territory_transferred:false,
      standard: { ruleset:'standard_v1', max_ships:5, max_catalog_budget:5000, fleet_budgets:fleetBudgets, catalog },
      warning:'Standard fleet duel: max 5 hulls and 5000 catalog budget per fleet. Quality, upgrades, bonuses, shields and parts are disabled in simulation. Base hull skills and formation remain. Full base HP is simulated. Owned ships are unchanged; no permanent loss, currency charge, rewards or OPS progress.' };
  } else {
    const { rows: settings } = await c.query("SELECT key, value #>> '{}' AS value FROM settings WHERE key = ANY($1::text[]) ORDER BY key FOR SHARE", [POLICY_KEYS]);
    terms = { version: 1, permanent_ship_loss_possible: true, territory_transferred: false,
      policy: settings, optins: users.map(u => ({ wallet: u.wallet_address, opted_in: u.full_loss_optin })),
      warning: 'Ships may be permanently destroyed. Current global loss policy and new-player protection apply at settlement; they can change. No territory is transferred by this duel.' };
  }
  return { state, terms, atk, def };
}
async function create(wallet, myFleetId, targetFleetId, mode = 'normal') {
  if (!['normal','standard_v1'].includes(mode)) fail('INVALID_DUEL_MODE',400);
  const ids = [id(myFleetId), id(targetFleetId)];
  if (ids[0] === ids[1]) fail('CANNOT_ATTACK_SELF', 400);
  return transaction(async c => {
    const s = await snapshot(c, ids, wallet, mode);
    await c.query("UPDATE fleet_duel_invitations SET status='expired', responded_at=NOW() WHERE status='pending' AND expires_at <= NOW() AND (inviter_fleet_id=ANY($1::bigint[]) OR defender_fleet_id=ANY($1::bigint[]))", [ids]);
    const pending = await c.query(`SELECT id FROM fleet_duel_invitations WHERE status='pending'
      AND LEAST(inviter_fleet_id,defender_fleet_id)=LEAST($1::bigint,$2::bigint)
      AND GREATEST(inviter_fleet_id,defender_fleet_id)=GREATEST($1::bigint,$2::bigint)`, ids);
    if (pending.rows.length) fail('INVITATION_ALREADY_PENDING');
    const { rows } = await c.query(`INSERT INTO fleet_duel_invitations
      (inviter_wallet,defender_wallet,inviter_fleet_id,defender_fleet_id,fleet_snapshot,loss_terms,terms_token,mode)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8) RETURNING *`,
      [s.atk.owner_wallet, s.def.owner_wallet, ...ids, JSON.stringify(s.state), JSON.stringify(s.terms), crypto.randomBytes(32).toString('hex'),mode]);
    return rows[0];
  });
}
async function list(wallet) {
  const { rows } = await pool.query(`SELECT *, CASE WHEN status='pending' AND expires_at<=NOW() THEN 'expired' ELSE status END AS status
    FROM fleet_duel_invitations WHERE (LOWER(inviter_wallet)=$1 OR LOWER(defender_wallet)=$1)
    AND created_at>NOW()-INTERVAL '7 days' ORDER BY created_at DESC LIMIT 50`, [wallet]);
  return rows;
}
async function respond(wallet, invitationId, action, body = {}) {
  return transaction(async c => {
    const { rows } = await c.query('SELECT *, expires_at<=clock_timestamp() AS expired FROM fleet_duel_invitations WHERE id=$1 FOR UPDATE', [id(invitationId)]);
    const invite = rows[0];
    if (!invite) fail('INVITATION_NOT_FOUND', 404);
    if (invite.defender_wallet.toLowerCase() !== wallet) fail('ONLY_DEFENDER_CAN_RESPOND', 403);
    if (invite.status !== 'pending') fail('INVITATION_' + invite.status.toUpperCase());
    if (invite.expired) {
      await c.query("UPDATE fleet_duel_invitations SET status='expired',responded_at=NOW() WHERE id=$1", [invite.id]);
      return { error: 'INVITATION_EXPIRED', statusCode: 410 };
    }
    if (action === 'decline') {
      await c.query("UPDATE fleet_duel_invitations SET status='declined',responded_at=NOW() WHERE id=$1", [invite.id]);
      return { invitation_id: invite.id, status: 'declined' };
    }
    if (body.accept_loss_terms !== true || body.terms_token !== invite.terms_token) fail('LOSS_TERMS_CONFIRMATION_REQUIRED', 400);
    const ids = [String(invite.inviter_fleet_id), String(invite.defender_fleet_id)];
    let s;
    try {
      s = await snapshot(c, ids, invite.inviter_wallet.toLowerCase(), invite.mode);
      if (s.def.owner_wallet.toLowerCase() !== wallet || digest(s.state) !== digest(invite.fleet_snapshot)) fail('FLEET_CHANGED');
      if (digest(s.terms) !== digest(invite.loss_terms)) fail('LOSS_TERMS_CHANGED');
    } catch (e) {
      if (!e.status) throw e;
      // Release an invalid invitation so the players can review a fresh snapshot.
      await c.query("UPDATE fleet_duel_invitations SET status='expired',responded_at=NOW() WHERE id=$1", [invite.id]);
      return { error: e.message, statusCode: e.status };
    }
    const validity = await c.query('SELECT expires_at>clock_timestamp() AS valid FROM fleet_duel_invitations WHERE id=$1', [invite.id]);
    if (!validity.rows[0].valid) {
      await c.query("UPDATE fleet_duel_invitations SET status='expired',responded_at=NOW() WHERE id=$1", [invite.id]);
      return { error:'INVITATION_EXPIRED', statusCode:410 };
    }
    const sector = await c.query(`SELECT c.id AS claim_id,c.sector_code,sd.id AS sector_id FROM claims c
      LEFT JOIN sector_definitions sd ON sd.code=c.sector_code WHERE LOWER(c.owner)=$1
      AND c.deleted_at IS NULL AND c.sector_code IS NOT NULL ORDER BY (c.width*c.height) DESC,c.id LIMIT 1`, [wallet]);
    const context = sector.rows[0] || {};
    const battle = await c.query(`INSERT INTO fleet_battles(battle_type,status,phase,sector_id,claim_id,prepare_started_at,scheduled_start_at,battle_summary)
      VALUES('pvp_duel','preparing','main',$1,$2,NOW(),NOW(),$3::jsonb) RETURNING id`,
      [context.sector_id || null, context.claim_id || null, JSON.stringify({ sector_code: context.sector_code || null,
        sector_conflict: !!context.sector_code, duel_invitation_id: invite.id, duel_mode:invite.mode,
        ...(invite.mode === 'standard_v1' ? {standard_ruleset:'standard_v1'} : {}), consent_loss_terms: invite.loss_terms })]);
    const battleId = battle.rows[0].id;
    await c.query('UPDATE fleets SET is_in_battle=true,current_battle_id=$2 WHERE id=ANY($1::bigint[])', [ids,battleId]);
    await c.query(`INSERT INTO fleet_battle_participants(battle_id,fleet_id,wallet_address,side)
      VALUES($1,$2,$3,'atk'),($1,$4,$5,'def')`, [battleId,...[ids[0],invite.inviter_wallet,ids[1],invite.defender_wallet]]);
    await c.query("UPDATE fleet_duel_invitations SET status='accepted',battle_id=$2,responded_at=NOW() WHERE id=$1", [invite.id,battleId]);
    return { invitation_id: invite.id, battle_id: battleId, status: 'preparing' };
  });
}
// Engine callers must trust this persisted registration, never a client summary flag.
async function getAcceptedStandardDuel(battleId, client = pool) {
  const { rows } = await client.query(`SELECT b.battle_type,b.battle_summary,i.* FROM fleet_battles b
    LEFT JOIN fleet_duel_invitations i ON i.battle_id=b.id AND i.mode='standard_v1' WHERE b.id=$1`, [id(battleId)]);
  const invite = rows[0], summary = invite?.battle_summary || {};
  if (!invite?.id) {
    if (summary.duel_mode === 'standard_v1' || summary.standard_ruleset) fail('STANDARD_DUEL_REGISTRATION_MISMATCH');
    return null;
  }
  const invalid = () => fail('STANDARD_DUEL_REGISTRATION_MISMATCH');
  if (invite.status !== 'accepted' || invite.battle_type !== 'pvp_duel' || String(invite.battle_id) !== String(battleId)
    || String(summary.duel_invitation_id) !== String(invite.id) || summary.duel_mode !== 'standard_v1' || summary.standard_ruleset !== 'standard_v1') invalid();
  const parts = (await client.query(`SELECT p.fleet_id,p.wallet_address,p.side,f.owner_wallet FROM fleet_battle_participants p
    JOIN fleets f ON f.id=p.fleet_id WHERE p.battle_id=$1 ORDER BY p.side`, [battleId])).rows;
  const fleetIds = [String(invite.inviter_fleet_id),String(invite.defender_fleet_id)];
  const wallets = [invite.inviter_wallet,invite.defender_wallet];
  if (parts.length !== 2 || !parts.some(p => p.side === 'atk' && String(p.fleet_id) === fleetIds[0]
      && p.wallet_address.toLowerCase() === wallets[0].toLowerCase() && p.owner_wallet.toLowerCase() === wallets[0].toLowerCase())
    || !parts.some(p => p.side === 'def' && String(p.fleet_id) === fleetIds[1]
      && p.wallet_address.toLowerCase() === wallets[1].toLowerCase() && p.owner_wallet.toLowerCase() === wallets[1].toLowerCase())) invalid();
  const standard = invite.loss_terms?.standard;
  if (standard?.ruleset !== 'standard_v1' || standard.max_ships !== 5 || standard.max_catalog_budget !== 5000
    || invite.loss_terms.permanent_ship_loss_possible !== false || !Array.isArray(standard.catalog) || !Array.isArray(invite.fleet_snapshot)) invalid();
  const actual = (await client.query('SELECT id,fleet_id,owner_wallet,ship_type_code FROM ships WHERE fleet_id=ANY($1::bigint[]) AND is_alive ORDER BY id', [fleetIds])).rows;
  const catalogByShipId = {};
  for (let i=0;i<2;i++) {
    const registered = invite.fleet_snapshot.find(f => String(f.id) === fleetIds[i]);
    const current = actual.filter(s => String(s.fleet_id) === fleetIds[i]);
    if (!registered || !current.length || current.length > 5 || current.length !== registered.ships.length) invalid();
    let budget = 0;
    for (const ship of current) {
      if (ship.owner_wallet.toLowerCase() !== wallets[i].toLowerCase()
        || !registered.ships.some(s => String(s.id) === String(ship.id) && s.ship_type_code === ship.ship_type_code)) invalid();
      const type = standard.catalog.find(t => t.code === ship.ship_type_code);
      if (!type || !type.is_active || !['frigate','destroyer','cruiser'].includes(type.size_class)
        || !Number.isSafeInteger(Number(type.build_gp_cost)) || Number(type.build_gp_cost) <= 0 || Number(type.base_hp) <= 0) invalid();
      budget += Number(type.build_gp_cost);
      catalogByShipId[String(ship.id)] = { id:String(ship.id),code:type.code,base_hp:type.base_hp,base_atk:type.base_atk,
        base_def:type.base_def,base_speed:type.base_speed,fire_interval:type.fire_interval,fire_type:type.fire_type,
        shots:type.shots,size_class:type.size_class,role:type.role,render_radius:type.render_radius };
    }
    if (budget > 5000) invalid();
  }
  return { invitationId:String(invite.id),ruleset:'standard_v1',fleetIds,wallets,catalogByShipId };
}
module.exports = { create, list, respond, getAcceptedStandardDuel };

const { pool, logGPActivity } = require('../db');
const fail = code => { throw new Error(code); };
const walletKey = wallet => String(wallet || '').toLowerCase().trim();

function rebuildCost(type) {
  const gp = Number(type.build_gp_cost);
  const recipe = type.recipe_minerals || {};
  const entries = Object.entries(recipe);
  // No zero-cost, assembled or malformed blueprint can mint a marketable hull here.
  if (!Number.isSafeInteger(gp) || gp <= 0 || gp > 100000000 || !entries.length ||
      entries.some(([, qty]) => !Number.isSafeInteger(Number(qty)) || Number(qty) <= 0 || Number(qty) > 10000000)) fail('REBUILD_NOT_AVAILABLE');
  const ordinarySeconds = Number(type.build_time_seconds);
  if (!Number.isSafeInteger(ordinarySeconds) || ordinarySeconds <= 0 || ordinarySeconds > 604800) fail('REBUILD_NOT_AVAILABLE');
  return { gp_cost: gp, minerals_used: Object.fromEntries(entries.map(([code, qty]) => [code, Number(qty)])),
    build_seconds: type.size_class === 'frigate' && type.role !== 'bomb' ? Math.min(300, ordinarySeconds) : ordinarySeconds,
    quality: 'common', bonus_preserved: false };
}

async function listCollection(wallet) {
  const w = walletKey(wallet);
  const { rows } = await pool.query(`SELECT c.*,st.name_ko,st.name_en,st.faction_code,st.size_class,st.role,
    (SELECT COUNT(*)::int FROM ships s WHERE LOWER(s.owner_wallet)=c.wallet_address AND s.ship_type_code=c.ship_type_code AND s.is_alive=true) AS alive_count,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'quality',COALESCE(s.quality,'common'),'destroyed_at',s.destroyed_at,'rebuild_job_id',j.id,'rebuild_status',j.status) ORDER BY s.destroyed_at DESC)
      FROM ships s LEFT JOIN ship_build_jobs j ON j.rebuild_source_ship_id=s.id AND j.status IN ('building','completed')
      WHERE LOWER(s.owner_wallet)=c.wallet_address AND s.ship_type_code=c.ship_type_code AND s.is_alive=false
        AND s.destroyed_at IS NOT NULL AND COALESCE(s.destroyed_reason,'') <> 'scrapped'), '[]'::jsonb) AS lost_hulls
    FROM ship_collection c JOIN ship_types st ON st.code=c.ship_type_code WHERE c.wallet_address=$1 ORDER BY st.sort_order,c.discovered_at`, [w]);
  return { collection: rows, policy: { permanent_unlock: true, duplicate_hulls_tradeable: true, rebuild_quality: 'common', combat_bonuses_replicated: false } };
}

async function getRebuildQuote(wallet, shipId, db = pool, lock = false) {
  const w = walletKey(wallet);
  if (!/^[1-9]\d*$/.test(String(shipId))) fail('INVALID_SHIP_ID');
  const { rows: users } = await db.query(`SELECT wallet_address,faction_code,rank_level,gp_balance FROM users WHERE LOWER(wallet_address)=$1${lock ? ' FOR UPDATE' : ''}`, [w]);
  const user = users[0];
  if (!user) fail('USER_NOT_FOUND');
  const { rows } = await db.query(`SELECT s.id,s.quality,s.is_alive,s.destroyed_at,s.destroyed_reason,st.* FROM ships s JOIN ship_types st ON st.code=s.ship_type_code
    JOIN ship_collection c ON c.wallet_address=$1 AND c.ship_type_code=s.ship_type_code
    WHERE s.id=$2 AND LOWER(s.owner_wallet)=$1${lock ? ' FOR UPDATE OF s' : ''}`, [w, shipId]);
  const source = rows[0];
  if (!source) fail('SHIP_NOT_FOUND');
  if (source.is_alive || !source.destroyed_at || source.destroyed_reason === 'scrapped') fail('SHIP_NOT_DESTROYED');
  if (!source.is_active) fail('REBUILD_NOT_AVAILABLE');
  if (source.faction_code !== user.faction_code) fail('WRONG_FACTION');
  const cost = rebuildCost(source);
  const { rows: jobs } = await db.query(`SELECT id,status,result_ship_id FROM ship_build_jobs WHERE rebuild_source_ship_id=$1 AND status IN ('building','completed')`, [shipId]);
  if (jobs[0]) return { source_ship_id: String(shipId), existing_job: jobs[0], can_rebuild: false, ...cost };
  if (lock && Number(source.max_per_server) > 0) await db.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, ['shipbuild:' + source.code]);
  const { rows: counts } = await db.query(`SELECT
    (SELECT COUNT(*) FROM ships WHERE ship_type_code=$2 AND is_alive)+(SELECT COUNT(*) FROM ship_build_jobs WHERE ship_type_code=$2 AND status='building') AS server_count,
    (SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet)=$1 AND ship_type_code=$2 AND is_alive)+(SELECT COUNT(*) FROM ship_build_jobs WHERE LOWER(wallet_address)=$1 AND ship_type_code=$2 AND status='building') AS type_count,
    (SELECT COUNT(*) FROM ships WHERE LOWER(owner_wallet)=$1 AND is_alive)+(SELECT COUNT(*) FROM ship_build_jobs WHERE LOWER(wallet_address)=$1 AND status='building') AS total_count,
    (SELECT value #>> '{}' FROM settings WHERE key='max_ships_per_player' LIMIT 1) AS total_max`, [w, source.code]);
  const countsRow = counts[0];
  const locks = [];
  if ((user.rank_level || 1) < source.min_player_rank) locks.push('RANK_REQUIRED');
  if (Number(source.max_per_server) > 0 && Number(countsRow.server_count) >= Number(source.max_per_server)) locks.push('SERVER_LIMIT_REACHED');
  if (Number(source.max_per_player) > 0 && Number(countsRow.type_count) >= Number(source.max_per_player)) locks.push('PLAYER_LIMIT_REACHED');
  if (Number(countsRow.total_count) >= (Number(countsRow.total_max) > 0 ? Number(countsRow.total_max) : 200)) locks.push('PLAYER_FLEET_FULL');
  const { rows: minerals } = await db.query(`SELECT r.id,r.code,COALESCE(i.quantity,0) AS have FROM resources r
    LEFT JOIN user_resource_inventory i ON i.resource_id=r.id AND LOWER(i.wallet_address)=$1 WHERE r.code=ANY($2::text[]) ORDER BY r.id`, [w, Object.keys(cost.minerals_used)]);
  const materials = Object.entries(cost.minerals_used).map(([code, need]) => { const item=minerals.find(m=>m.code===code); return { code, need, have:Number(item?.have)||0, resource_id:item?.id || null }; });
  if (materials.some(m => !m.resource_id)) fail('REBUILD_NOT_AVAILABLE');
  if (Number(user.gp_balance) < cost.gp_cost) locks.push('INSUFFICIENT_GP');
  if (materials.some(m => m.have < m.need)) locks.push('INSUFFICIENT_MINERALS');
  return { source_ship_id: String(shipId), ship_type_code: source.code, source_quality: source.quality || 'common', ...cost, materials,
    gp_balance: Number(user.gp_balance), can_rebuild: !locks.length, locks, wallet_address: user.wallet_address };
}

async function startRebuild(wallet, shipId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const quote = await getRebuildQuote(wallet, shipId, client, true);
    if (quote.existing_job) { await client.query('ROLLBACK'); return { success: true, already_started: true, job_id: quote.existing_job.id, status: quote.existing_job.status }; }
    if (!quote.can_rebuild) fail(quote.locks[0]);
    const spent = await client.query(`UPDATE users SET gp_balance=gp_balance-$1 WHERE wallet_address=$2 AND gp_balance >= $1`, [quote.gp_cost,quote.wallet_address]);
    if (!spent.rowCount) fail('INSUFFICIENT_GP');
    for (const material of quote.materials) {
      const taken = await client.query(`UPDATE user_resource_inventory SET quantity=quantity-$1,updated_at=NOW() WHERE LOWER(wallet_address)=LOWER($2) AND resource_id=$3 AND quantity >= $1`, [material.need,quote.wallet_address,material.resource_id]);
      if (!taken.rowCount) fail('INSUFFICIENT_MINERALS');
    }
    const { rows } = await client.query(`INSERT INTO ship_build_jobs(wallet_address,ship_type_code,started_at,completes_at,status,gp_cost,minerals_used,rebuild_source_ship_id)
      VALUES($1,$2,NOW(),NOW()+($3 * INTERVAL '1 second'),'building',$4,$5,$6) RETURNING id,completes_at`,
      [quote.wallet_address,quote.ship_type_code,quote.build_seconds,quote.gp_cost,JSON.stringify(quote.minerals_used),shipId]);
    await client.query(`INSERT INTO ship_build_log(wallet_address,ship_type_code,gp_cost,minerals_used,result) VALUES($1,$2,$3,$4,'success')`, [quote.wallet_address,quote.ship_type_code,quote.gp_cost,JSON.stringify(quote.minerals_used)]);
    await client.query('COMMIT');
    logGPActivity(quote.wallet_address,-quote.gp_cost,'ship_rebuild',`Rebuild ${shipId} → ${quote.ship_type_code}`).catch(()=>{});
    return { success:true, job_id:rows[0].id, completes_at:rows[0].completes_at, quote };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
module.exports = { listCollection, getRebuildQuote, startRebuild, rebuildCost };

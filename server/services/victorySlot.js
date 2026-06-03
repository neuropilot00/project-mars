// 승리 슬롯 — Sink 기반(순발행 0). 풀은 수리 GP 싱크의 일부를 적립, 스핀은 풀에서만 carve 지급.
const { pool, getSetting } = require('../db');

// 수리 GP의 일부를 소각 대신 풀에 적립 (repairShip 트랜잭션 client로 호출)
async function feedPool(client, repairGp) {
  try {
    const pct = parseFloat(await getSetting('victory_slot_repair_feed_pct', '20')) || 0;
    if (pct <= 0 || !(repairGp > 0)) return 0;
    const add = +(repairGp * pct / 100).toFixed(6);
    if (add <= 0) return 0;
    await client.query(`UPDATE victory_slot_pool SET pool_gp = pool_gp + $1 WHERE id = 1`, [add]);
    return add;
  } catch (_) { return 0; }
}

async function getPool() {
  try { const r = await pool.query(`SELECT pool_gp FROM victory_slot_pool WHERE id = 1`); return Math.floor(parseFloat(r.rows[0] && r.rows[0].pool_gp) || 0); }
  catch (_) { return 0; }
}

// 승자 여부 + 이미 스핀했는지 상태
async function status(wallet, battleId) {
  const w = String(wallet || '').toLowerCase();
  const out = { enabled: String(await getSetting('victory_slot_enabled', 'true')) === 'true', pool: await getPool(), eligible: false, spun: false, payout: 0, multiplier: 0 };
  if (!w || !battleId) return out;
  try {
    const wr = await pool.query(`SELECT 1 FROM fleet_battle_rewards WHERE battle_id=$1 AND LOWER(wallet_address)=LOWER($2) AND is_winner=true LIMIT 1`, [battleId, w]);
    out.eligible = !!wr.rows[0];
    const cl = await pool.query(`SELECT payout_gp, multiplier FROM victory_slot_claims WHERE battle_id=$1 AND wallet=$2`, [battleId, w]);
    if (cl.rows[0]) { out.spun = true; out.payout = Math.floor(parseFloat(cl.rows[0].payout_gp) || 0); out.multiplier = parseFloat(cl.rows[0].multiplier) || 0; }
  } catch (_) {}
  return out;
}

async function spin(wallet, battleId) {
  const w = String(wallet || '').toLowerCase();
  if (!w || !battleId) return { error: 'INVALID' };
  if (String(await getSetting('victory_slot_enabled', 'true')) !== 'true') return { error: 'DISABLED' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 승자 검증
    const wr = await client.query(`SELECT 1 FROM fleet_battle_rewards WHERE battle_id=$1 AND LOWER(wallet_address)=LOWER($2) AND is_winner=true LIMIT 1`, [battleId, w]);
    if (!wr.rows[0]) { await client.query('ROLLBACK'); return { error: 'NOT_WINNER' }; }
    // 중복 스핀 방지
    const ins = await client.query(`INSERT INTO victory_slot_claims (battle_id, wallet) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING battle_id`, [battleId, w]);
    if (!ins.rows[0]) { await client.query('ROLLBACK'); return { error: 'ALREADY_SPUN' }; }
    // 배수 추첨(가중치)
    let weights = [];
    try { weights = JSON.parse(await getSetting('victory_slot_weights', '[]')) || []; } catch (_) { weights = []; }
    if (!weights.length) weights = [{ m: 1, w: 1 }];
    const tot = weights.reduce((s, x) => s + (parseFloat(x.w) || 0), 0) || 1;
    let roll = Math.random() * tot, mult = 0;
    for (const x of weights) { roll -= (parseFloat(x.w) || 0); if (roll <= 0) { mult = parseFloat(x.m) || 0; break; } }
    const base = parseInt(await getSetting('victory_slot_base_gp', '50')) || 50;
    // 풀 잠금 + 상한 (carve — 풀에서만)
    const pr = await client.query(`SELECT pool_gp FROM victory_slot_pool WHERE id=1 FOR UPDATE`);
    const poolGp = parseFloat(pr.rows[0] && pr.rows[0].pool_gp) || 0;
    let payout = Math.max(0, Math.floor(base * mult));
    if (payout > poolGp) payout = Math.floor(poolGp);
    if (payout > 0) {
      // (v7.395 하드닝) 가드 차감 — FOR UPDATE+클램프에 더해 pool_gp>=payout 보장(음수 불가).
      const ded = await client.query(`UPDATE victory_slot_pool SET pool_gp = pool_gp - $1 WHERE id=1 AND pool_gp >= $1`, [payout]);
      if (ded.rowCount !== 1) { await client.query('ROLLBACK'); return { error: 'POOL_INSUFFICIENT' }; }
      await client.query(`UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)`, [payout, w]);
    }
    await client.query(`UPDATE victory_slot_claims SET payout_gp=$1, multiplier=$2 WHERE battle_id=$3 AND wallet=$4`, [payout, mult, battleId, w]);
    await client.query('COMMIT');
    try { require('../db').logGPActivity(w, payout, 'victory_slot', 'Victory slot (carve from pool)').catch(() => {}); } catch (_) {}
    return { success: true, multiplier: mult, payout, pool_remaining: Math.max(0, Math.floor(poolGp - payout)) };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[victorySlot] spin error:', e.message);
    return { error: 'internal_error' };
  } finally { client.release(); }
}

module.exports = { feedPool, getPool, status, spin };

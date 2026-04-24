// server/services/resourceCraft.js
// ═══════════════════════════════════════════════════════════════
// Resource Crafting Service (Migration 091 · tier-3 parts)
//
// hull_plate / plasma_coil / alloy_frame 같은 craftable=true 자원을
// 하위 tier 자원을 소모해 비동기 제작.
//
// 주요 기능:
//   getRecipes()       : 제작 가능 자원 목록 (craft_recipe + craft_time)
//   getMyJobs(wallet)  : 진행 중 제작 작업
//   startCraft(w, code, qty) : 재료 차감 + 작업 큐 INSERT
//   claimJob(id, wallet)     : 완료된 작업 수령
//   cancelJob(id, wallet)    : 취소 + 50% 환불
//   processCompletedJobs()   : 스케줄러용 자동 수령
// ═══════════════════════════════════════════════════════════════

const { pool } = require('../db');

// ─── 제작 가능 레시피 목록 ─────────────────────────────────────
async function getRecipes() {
  const { rows } = await pool.query(`
    SELECT code, name_en, name_ko, name_ja, name_zh, icon_emoji,
           tier, rarity, base_pp_value, color_hex,
           description_ko, description_en,
           craft_recipe, craft_time_seconds
    FROM resources
    WHERE is_craftable = true AND is_active = true
    ORDER BY tier ASC, code ASC
  `);
  return rows;
}

// ─── 내 진행 중 제작 작업 ──────────────────────────────────────
async function getMyJobs(walletAddress) {
  const { rows } = await pool.query(`
    SELECT j.id, j.resource_code, j.quantity, j.started_at, j.completes_at,
           j.status, j.materials_used,
           r.name_ko, r.icon_emoji, r.color_hex,
           EXTRACT(EPOCH FROM (j.completes_at - NOW())) AS seconds_remaining,
           EXTRACT(EPOCH FROM (j.completes_at - j.started_at)) AS total_seconds
    FROM resource_crafting_jobs j
    JOIN resources r ON r.code = j.resource_code
    WHERE j.wallet_address = $1 AND j.status = 'crafting'
    ORDER BY j.completes_at ASC
  `, [walletAddress]);

  return rows.map(j => ({
    ...j,
    seconds_remaining: Math.max(0, parseFloat(j.seconds_remaining) || 0),
    total_seconds: parseFloat(j.total_seconds) || 1,
    is_ready: (parseFloat(j.seconds_remaining) || 0) <= 0,
    progress_pct: Math.min(100, Math.max(0,
      (1 - (parseFloat(j.seconds_remaining) || 0) / (parseFloat(j.total_seconds) || 1)) * 100
    )),
  }));
}

// ─── 제작 시작 ─────────────────────────────────────────────────
/**
 * @returns { job_id, resource_code, quantity, completes_at, materials_used }
 */
async function startCraft(walletAddress, resourceCode, quantity = 1) {
  if (quantity < 1 || quantity > 50) throw new Error('INVALID_QUANTITY');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 유저 존재 확인
    const { rows: userRows } = await client.query(
      `SELECT wallet_address FROM users WHERE wallet_address = $1 FOR UPDATE`,
      [walletAddress]
    );
    if (!userRows[0]) throw new Error('USER_NOT_FOUND');

    // 자원 조회
    const { rows: resRows } = await client.query(
      `SELECT code, name_ko, craft_recipe, craft_time_seconds, is_craftable
       FROM resources WHERE code = $1`,
      [resourceCode]
    );
    if (!resRows[0]) throw new Error('RESOURCE_NOT_FOUND');
    const res = resRows[0];
    if (!res.is_craftable) throw new Error('NOT_CRAFTABLE');

    const recipe = res.craft_recipe || {};
    const craftSeconds = parseInt(res.craft_time_seconds) || 600;
    const recipeEntries = Object.entries(recipe);
    if (recipeEntries.length === 0) throw new Error('RECIPE_EMPTY');

    // 재료 재고 체크 (quantity 배수로 차감)
    const mineralCodes = recipeEntries.map(([c]) => c);
    const { rows: invRows } = await client.query(`
      SELECT resource_code, quantity
      FROM user_resource_inventory
      WHERE wallet_address = $1 AND resource_code = ANY($2::text[])
      FOR UPDATE
    `, [walletAddress, mineralCodes]);

    const inv = {};
    for (const r of invRows) inv[r.resource_code] = parseInt(r.quantity);

    const missing = [];
    const totalNeeded = {};
    for (const [code, need] of recipeEntries) {
      const totalNeed = need * quantity;
      totalNeeded[code] = totalNeed;
      const have = inv[code] || 0;
      if (have < totalNeed) missing.push({ code, need: totalNeed, have });
    }
    if (missing.length > 0) {
      const err = new Error('INSUFFICIENT_MATERIALS');
      err.meta = { missing };
      throw err;
    }

    // 재료 차감
    for (const [code, totalNeed] of Object.entries(totalNeeded)) {
      await client.query(`
        UPDATE user_resource_inventory
        SET quantity = quantity - $1
        WHERE wallet_address = $2 AND resource_code = $3
      `, [totalNeed, walletAddress, code]);
    }

    // 작업 INSERT
    const { rows: jobRows } = await client.query(`
      INSERT INTO resource_crafting_jobs
        (wallet_address, resource_code, quantity, started_at, completes_at, status, materials_used)
      VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' seconds')::INTERVAL, 'crafting', $5)
      RETURNING id, started_at, completes_at
    `, [walletAddress, resourceCode, quantity, String(craftSeconds * quantity), JSON.stringify(totalNeeded)]);
    const job = jobRows[0];

    await client.query('COMMIT');

    // 시즌 점수 (fire-and-forget)
    try {
      const seasonSvc = require('./season');
      seasonSvc.addSeasonScore(walletAddress, 'crafting', quantity).catch(() => {});
    } catch (_) {}

    return {
      job_id: job.id,
      resource_code: resourceCode,
      quantity,
      started_at: job.started_at,
      completes_at: job.completes_at,
      craft_seconds: craftSeconds * quantity,
      materials_used: totalNeeded,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 완료 수령 ─────────────────────────────────────────────────
async function claimJob(jobId, walletAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: jobRows } = await client.query(
      `SELECT * FROM resource_crafting_jobs
       WHERE id = $1 AND wallet_address = $2 FOR UPDATE`,
      [jobId, walletAddress]
    );
    if (!jobRows[0]) throw new Error('JOB_NOT_FOUND');
    const job = jobRows[0];

    if (job.status !== 'crafting') {
      return { already_claimed: true, job };
    }
    if (new Date(job.completes_at) > new Date()) {
      throw new Error('NOT_YET_COMPLETE');
    }

    // 결과물 지급
    await client.query(`
      INSERT INTO user_resource_inventory (wallet_address, resource_code, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet_address, resource_code)
      DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity
    `, [walletAddress, job.resource_code, job.quantity]);

    await client.query(`
      UPDATE resource_crafting_jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [jobId]);

    await client.query('COMMIT');

    return {
      success: true,
      job_id: jobId,
      resource_code: job.resource_code,
      quantity: job.quantity,
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 취소 (50% 재료 환불) ──────────────────────────────────────
async function cancelJob(jobId, walletAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: jobRows } = await client.query(
      `SELECT * FROM resource_crafting_jobs
       WHERE id = $1 AND wallet_address = $2 FOR UPDATE`,
      [jobId, walletAddress]
    );
    if (!jobRows[0]) throw new Error('JOB_NOT_FOUND');
    const job = jobRows[0];
    if (job.status !== 'crafting') throw new Error('JOB_NOT_CANCELLABLE');

    const refundPct = 50;
    const materials = job.materials_used || {};
    const refunded = {};
    for (const [code, qty] of Object.entries(materials)) {
      const refundQty = Math.floor(qty * refundPct / 100);
      if (refundQty > 0) {
        refunded[code] = refundQty;
        await client.query(`
          INSERT INTO user_resource_inventory (wallet_address, resource_code, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (wallet_address, resource_code)
          DO UPDATE SET quantity = user_resource_inventory.quantity + EXCLUDED.quantity
        `, [walletAddress, code, refundQty]);
      }
    }

    await client.query(`
      UPDATE resource_crafting_jobs
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = $1
    `, [jobId]);

    await client.query('COMMIT');
    return { success: true, refunded, refund_pct: refundPct };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// ─── 스케줄러: 완료된 작업 자동 수령 ───────────────────────────
async function processCompletedJobs() {
  const { rows } = await pool.query(`
    SELECT id, wallet_address FROM resource_crafting_jobs
    WHERE status = 'crafting' AND completes_at <= NOW()
    ORDER BY completes_at ASC
    LIMIT 100
  `);
  const results = { success: 0, failed: 0, errors: [] };
  for (const row of rows) {
    try { await claimJob(row.id, row.wallet_address); results.success++; }
    catch (err) {
      results.failed++;
      results.errors.push({ job_id: row.id, error: err.message });
    }
  }
  return results;
}

module.exports = {
  getRecipes,
  getMyJobs,
  startCraft,
  claimJob,
  cancelJob,
  processCompletedJobs,
};

'use strict';
const { pool } = require('../db');

// ── helpers ──────────────────────────────────────────────────────────────────
async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query(
      'SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

// ── Recipe helpers ────────────────────────────────────────────────────────────

/**
 * Return all active recipes, optionally filtered by category.
 * For each recipe we compute `canCraft` = does wallet own all ingredients?
 */
async function getRecipes(category, wallet) {
  let q = 'SELECT * FROM crafting_recipes WHERE is_active=true';
  const params = [];
  if (category && category !== 'all') {
    params.push(category);
    q += ` AND category=$${params.length}`;
  }
  q += ' ORDER BY sort_order ASC, id ASC';
  const { rows: recipes } = await pool.query(q, params);

  if (!wallet || !recipes.length) return recipes.map(r => ({ ...r, canCraft: false }));

  // Load wallet item quantities once
  const { rows: items } = await pool.query(
    'SELECT item_type_id, quantity FROM user_items WHERE wallet=$1 AND quantity>0',
    [wallet.toLowerCase()]
  );
  const owned = {};
  items.forEach(it => { owned[it.item_type_id] = Number(it.quantity); });

  return recipes.map(r => {
    const ingredients = Array.isArray(r.ingredients) ? r.ingredients : (JSON.parse(r.ingredients || '[]'));
    const canCraft = ingredients.every(ing => (owned[ing.item_type_id] || 0) >= ing.qty);
    return { ...r, canCraft, ingredients };
  });
}

/**
 * Get a single recipe with ingredient availability check.
 */
async function getRecipe(recipeId, wallet) {
  const { rows } = await pool.query(
    'SELECT * FROM crafting_recipes WHERE id=$1 AND is_active=true', [recipeId]);
  if (!rows.length) return null;
  const r = rows[0];
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : JSON.parse(r.ingredients || '[]');

  let canCraft = false;
  if (wallet) {
    const { rows: items } = await pool.query(
      'SELECT item_type_id, quantity FROM user_items WHERE wallet=$1 AND quantity>0',
      [wallet.toLowerCase()]
    );
    const owned = {};
    items.forEach(it => { owned[it.item_type_id] = Number(it.quantity); });
    canCraft = ingredients.every(ing => (owned[ing.item_type_id] || 0) >= ing.qty);
  }
  return { ...r, canCraft, ingredients };
}

// ── Core craft function ───────────────────────────────────────────────────────

/**
 * Attempt to craft an item. Must be called inside an existing transaction.
 * Returns { success, outputQty, gpCost, gpRefunded, outcome }
 */
async function craftItem(client, wallet, recipeId) {
  const walletLower = wallet.toLowerCase();

  // 1. Check global enabled
  // [v7.363] 로컬 getSetting은 game_settings의 JSONB를 네이티브 타입(boolean true)으로 반환 →
  //   문자열 'true'와 직접 비교 시 true!=='true'로 항상 disabled 되던 버그. String() 정규화.
  const enabled = await getSetting('crafting_enabled', 'true');
  if (String(enabled) !== 'true') throw new Error('Crafting is currently disabled');

  // 2. Load recipe
  const { rows: recipeRows } = await client.query(
    'SELECT * FROM crafting_recipes WHERE id=$1 AND is_active=true', [recipeId]);
  if (!recipeRows.length) throw new Error('Recipe not found or inactive');
  const recipe = recipeRows[0];
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : JSON.parse(recipe.ingredients || '[]');

  // 3. Daily limit check — advisory lock prevents concurrent bypass [v7.63]
  // pg_advisory_xact_lock serializes same-wallet crafts within this transaction
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [walletLower]);
  const maxPerDay = parseInt(await getSetting('crafting_max_per_day', '20'), 10);
  const { rows: todayRows } = await client.query(
    `SELECT COUNT(*) AS cnt FROM crafting_log
     WHERE wallet=$1 AND created_at >= NOW() - INTERVAL '1 day'`,
    [walletLower]
  );
  if (parseInt(todayRows[0].cnt, 10) >= maxPerDay) {
    throw new Error(`Daily crafting limit reached (${maxPerDay}/day)`);
  }

  // 4. Verify ingredients ownership & deduct
  // [v7.364] recipe ingredients는 {qty, code}(자원 코드). 기존엔 item_type_id로 user_items를 조회해
  //   항상 매칭 실패("Item #undefined")로 워아이템 크래프트가 깨져 있었음 → 자원 인벤토리에서 차감.
  //   레거시 item_type_id 형식 레시피는 user_items 경로로 폴백.
  for (const ing of ingredients) {
    const need = parseInt(ing.qty) || 0;
    if (need <= 0) continue;
    const code = ing.code || ing.resource_code;
    if (code) {
      // 자원(user_resource_inventory) 차감
      const { rows: invRows } = await client.query(
        `SELECT uri.quantity FROM user_resource_inventory uri
           JOIN resources r ON r.id = uri.resource_id
          WHERE uri.wallet_address = $1 AND r.code = $2 FOR UPDATE`,
        [walletLower, code]
      );
      const owned = invRows.length ? Number(invRows[0].quantity) : 0;
      if (owned < need) throw new Error(`Not enough ${code} (need ${need}, have ${owned})`);
      const ded = await client.query(
        `UPDATE user_resource_inventory SET quantity = quantity - $1, updated_at = NOW()
          WHERE wallet_address = $2 AND resource_id = (SELECT id FROM resources WHERE code = $3) AND quantity >= $1`,
        [need, walletLower, code]
      );
      if (ded.rowCount === 0) throw new Error(`Not enough ingredients (${code})`);
    } else if (ing.item_type_id) {
      // 레거시: 아이템(user_items) 차감
      const { rows: itemRows } = await client.query(
        'SELECT quantity FROM user_items WHERE wallet=$1 AND item_type_id=$2 FOR UPDATE',
        [walletLower, ing.item_type_id]
      );
      const owned = itemRows.length ? Number(itemRows[0].quantity) : 0;
      if (owned < need) throw new Error(`Not enough item #${ing.item_type_id} (need ${need}, have ${owned})`);
      const ded = await client.query(
        `UPDATE user_items SET quantity = quantity - $1 WHERE wallet=$2 AND item_type_id=$3 AND quantity >= $1`,
        [need, walletLower, ing.item_type_id]
      );
      if (ded.rowCount === 0) throw new Error(`Not enough ingredients (item #${ing.item_type_id})`);
      await client.query('DELETE FROM user_items WHERE wallet=$1 AND item_type_id=$2 AND quantity<=0', [walletLower, ing.item_type_id]);
    }
  }

  // 5. Deduct GP cost
  const gpCost = Number(recipe.gp_cost);
  if (gpCost > 0) {
    const { rows: balRows } = await client.query(
      'SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [walletLower]);
    const balance = balRows.length ? Number(balRows[0].balance) : 0;
    if (balance < gpCost) throw new Error(`Insufficient GP (need ${gpCost}, have ${balance.toFixed(2)})`);
    const gpDeductRes = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1',
      [gpCost, walletLower]
    );
    if (gpDeductRes.rowCount === 0) throw new Error('INSUFFICIENT_GP');
  }

  // 6. Roll success
  const roll = Math.random() * 100;
  const success = roll < Number(recipe.success_rate);

  let gpRefunded = 0;
  let outputQty = 0;

  if (success) {
    // 7a. Award output item
    outputQty = recipe.output_qty;
    await client.query(
      `INSERT INTO user_items (wallet, item_type_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet, item_type_id)
       DO UPDATE SET quantity = user_items.quantity + EXCLUDED.quantity`,
      [walletLower, recipe.output_item_type_id, outputQty]
    );
  } else {
    // 7b. Partial GP refund on fail
    const refundPct = Number(recipe.fail_refund_pct);
    if (refundPct > 0 && gpCost > 0) {
      gpRefunded = parseFloat((gpCost * refundPct / 100).toFixed(6));
      await client.query(
        'UPDATE users SET gp_balance = gp_balance + $1 WHERE LOWER(wallet_address)=LOWER($2)',
        [gpRefunded, walletLower]
      );
    }
  }

  // 8. Log the attempt
  await client.query(
    `INSERT INTO crafting_log (wallet, recipe_id, recipe_name, gp_cost, gp_refunded, success)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [walletLower, recipeId, recipe.name, gpCost, gpRefunded, success]
  );

  return {
    success,
    outputQty,
    outputItemTypeId: recipe.output_item_type_id,
    outputName: recipe.output_name || `Item #${recipe.output_item_type_id}`,
    gpCost,
    gpRefunded,
    recipeName: recipe.name
  };
}

// ── History / stats ───────────────────────────────────────────────────────────

async function getMyCraftingLog(wallet, limit = 30) {
  const { rows } = await pool.query(
    `SELECT * FROM crafting_log WHERE wallet=$1 ORDER BY created_at DESC LIMIT $2`,
    [wallet.toLowerCase(), limit]
  );
  return rows;
}

async function getAdminStats() {
  const [totals, recent, settings] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE success)  AS total_success,
         COUNT(*) FILTER (WHERE NOT success) AS total_fail,
         COUNT(*)                          AS total_attempts,
         COALESCE(SUM(gp_cost - gp_refunded), 0) AS total_gp_burned,
         COALESCE(SUM(gp_refunded), 0)     AS total_gp_refunded
       FROM crafting_log`
    ),
    pool.query(
      `SELECT cl.*, cr.output_name, cr.category
       FROM crafting_log cl
       LEFT JOIN crafting_recipes cr ON cr.id = cl.recipe_id
       ORDER BY cl.created_at DESC LIMIT 50`
    ),
    pool.query(
      `SELECT key, value FROM game_settings WHERE category='crafting' ORDER BY key`
    )
  ]);
  return {
    totals: totals.rows[0],
    recentLog: recent.rows,
    settings: settings.rows
  };
}

// ── Admin recipe CRUD ─────────────────────────────────────────────────────────

async function adminCreateRecipe(data) {
  const { rows } = await pool.query(
    `INSERT INTO crafting_recipes
       (name, description, category, ingredients, gp_cost, output_item_type_id,
        output_qty, output_name, success_rate, fail_refund_pct,
        is_active, is_seasonal, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      data.name, data.description || null, data.category || 'general',
      JSON.stringify(data.ingredients || []),
      data.gp_cost || 0, data.output_item_type_id, data.output_qty || 1,
      data.output_name || null, data.success_rate ?? 80,
      data.fail_refund_pct ?? 0,
      data.is_active !== false, data.is_seasonal || false, data.sort_order || 0
    ]
  );
  return rows[0];
}

async function adminUpdateRecipe(id, data) {
  const fields = [];
  const vals = [];
  let idx = 1;
  const allowed = ['name','description','category','ingredients','gp_cost',
    'output_item_type_id','output_qty','output_name','success_rate',
    'fail_refund_pct','is_active','is_seasonal','sort_order'];
  for (const k of allowed) {
    if (data[k] !== undefined) {
      fields.push(`${k}=$${idx++}`);
      vals.push(k === 'ingredients' ? JSON.stringify(data[k]) : data[k]);
    }
  }
  if (!fields.length) throw new Error('No fields to update');
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE crafting_recipes SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`,
    vals
  );
  return rows[0];
}

async function adminDeleteRecipe(id) {
  await pool.query('UPDATE crafting_recipes SET is_active=false WHERE id=$1', [id]);
}

async function getItemTypes() {
  const { rows } = await pool.query(
    'SELECT id, name, category FROM item_types ORDER BY category, name');
  return rows;
}

module.exports = {
  getRecipes,
  getRecipe,
  craftItem,
  getMyCraftingLog,
  getAdminStats,
  adminCreateRecipe,
  adminUpdateRecipe,
  adminDeleteRecipe,
  getItemTypes
};

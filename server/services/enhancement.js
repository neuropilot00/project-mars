const { pool, getSetting } = require('../db');
let jobService; try { jobService = require('./job'); } catch (_e) {}

// ── Materialize: split 1 from user_items stack → individual item_instance ──
async function materializeItem(client, wallet, itemTypeId) {
  const w = wallet.toLowerCase();

  // Verify item is cosmetic
  const itemRes = await client.query(
    "SELECT id, code, name, category FROM item_types WHERE id = $1 AND active = true",
    [itemTypeId]
  );
  if (!itemRes.rows.length) throw new Error('Item type not found');
  const item = itemRes.rows[0];
  if (item.category !== 'cosmetic') throw new Error('Only cosmetic items can be materialized');

  // Check user has at least 1
  const invRes = await client.query(
    'SELECT quantity FROM user_items WHERE wallet = $1 AND item_type_id = $2 AND quantity > 0',
    [w, itemTypeId]
  );
  if (!invRes.rows.length) throw new Error('You do not own this item');

  // Deduct 1 from stack
  await client.query(
    'UPDATE user_items SET quantity = quantity - 1 WHERE wallet = $1 AND item_type_id = $2',
    [w, itemTypeId]
  );

  // Create individual instance
  const instRes = await client.query(
    'INSERT INTO item_instances (wallet, item_type_id, enhancement_level) VALUES ($1, $2, 0) RETURNING *',
    [w, itemTypeId]
  );

  return { instance: instRes.rows[0], item };
}

// ── De-materialize: return instance back to stack (only +0 items) ──
async function dematerializeItem(client, wallet, instanceId) {
  const w = wallet.toLowerCase();

  const instRes = await client.query(
    'SELECT * FROM item_instances WHERE id = $1 AND wallet = $2',
    [instanceId, w]
  );
  if (!instRes.rows.length) throw new Error('Instance not found or not owned');
  const inst = instRes.rows[0];
  if (inst.enhancement_level > 0) throw new Error('Cannot de-materialize enhanced items');

  // Delete instance
  await client.query('DELETE FROM item_instances WHERE id = $1', [instanceId]);

  // Return to stack
  await client.query(
    `INSERT INTO user_items (wallet, item_type_id, quantity) VALUES ($1, $2, 1)
     ON CONFLICT (wallet, item_type_id) DO UPDATE SET quantity = user_items.quantity + 1`,
    [w, inst.item_type_id]
  );

  return { success: true };
}

// ── Get enhancement cost for a given level ──
async function getEnhancementCost(level) {
  const baseCost = parseFloat(await getSetting('enhance_base_cost_gp') || '50');
  const multiplier = parseFloat(await getSetting('enhance_cost_multiplier') || '1.8');
  return Math.floor(baseCost * Math.pow(multiplier, level));
}

// ── Get full cost table ──
async function getEnhancementCosts() {
  const maxLevel = parseInt(await getSetting('enhance_max_level') || '10');
  const baseCost = parseFloat(await getSetting('enhance_base_cost_gp') || '50');
  const multiplier = parseFloat(await getSetting('enhance_cost_multiplier') || '1.8');

  const costs = [];
  for (let i = 0; i < maxLevel; i++) {
    costs.push({ from: i, to: i + 1, cost: Math.floor(baseCost * Math.pow(multiplier, i)) });
  }
  return costs;
}

// ── Get success rates (optionally hidden by setting) ──
async function getEnhancementRates() {
  const showRates = (await getSetting('enhance_show_rates') || 'true') === 'true';
  if (!showRates) return null;

  const maxLevel = parseInt(await getSetting('enhance_max_level') || '10');
  let rates;
  try {
    rates = JSON.parse(await getSetting('enhance_success_rates') || '[]');
  } catch (_) {
    rates = [95, 90, 80, 70, 55, 40, 30, 20, 12, 7];
  }

  const result = [];
  for (let i = 0; i < maxLevel; i++) {
    result.push({ from: i, to: i + 1, rate: rates[i] !== undefined ? rates[i] : 5 });
  }
  return result;
}

// ── Enhance an item instance ──
async function enhanceItem(client, wallet, instanceId) {
  const w = wallet.toLowerCase();

  // Check system enabled
  const enabled = (await getSetting('enhance_enabled') || 'true') === 'true';
  if (!enabled) throw new Error('Enhancement system is currently disabled');

  // Load instance
  const instRes = await client.query(
    'SELECT ii.*, it.name, it.code, it.icon, it.category FROM item_instances ii JOIN item_types it ON it.id = ii.item_type_id WHERE ii.id = $1 AND ii.wallet = $2',
    [instanceId, w]
  );
  if (!instRes.rows.length) throw new Error('Item instance not found or not owned');
  const inst = instRes.rows[0];

  if (inst.category !== 'cosmetic') throw new Error('Only cosmetic items can be enhanced');

  const maxLevel = parseInt(await getSetting('enhance_max_level') || '10');
  if (inst.enhancement_level >= maxLevel) throw new Error('Item is already at maximum enhancement level');

  const currentLevel = inst.enhancement_level;

  // Calculate cost
  let cost = await getEnhancementCost(currentLevel);
  // ✅ [Job System] Crafter enhancement cost buff
  try { if (jobService) cost = Math.max(1, Math.floor(cost * await jobService.getJobBuff(w, 'crafter_enhancement_cost', 1.0))); } catch (_je) {}

  // Check GP balance
  const balRes = await client.query(
    'SELECT gp_balance FROM users WHERE wallet_address = $1',
    [w]
  );
  if (!balRes.rows.length) throw new Error('User not found');
  const gpBal = parseFloat(balRes.rows[0].gp_balance);
  if (gpBal < cost) throw new Error(`Insufficient GP. Need ${cost}, have ${Math.floor(gpBal)}`);

  // Deduct GP
  await client.query(
    'UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2',
    [cost, w]
  );

  // Log transaction
  await client.query(
    `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
     VALUES ('enhance_attempt', $1, 0, 0, $2)`,
    [w, JSON.stringify({ instanceId, item: inst.code, level: currentLevel, cost })]
  );

  // Determine success/failure
  let rates;
  try {
    rates = JSON.parse(await getSetting('enhance_success_rates') || '[]');
  } catch (_) {
    rates = [95, 90, 80, 70, 55, 40, 30, 20, 12, 7];
  }
  let successRate = rates[currentLevel] !== undefined ? rates[currentLevel] : 5;
  // ✅ [Job System] Crafter enhancement success rate buff
  try { if (jobService) successRate = Math.min(99, successRate * await jobService.getJobBuff(w, 'crafter_enhancement_success', 1.0)); } catch (_je) {}
  const roll = Math.random() * 100;
  const success = roll < successRate;

  let outcome, newLevel;

  if (success) {
    outcome = 'success';
    newLevel = currentLevel + 1;
    await client.query(
      'UPDATE item_instances SET enhancement_level = $1 WHERE id = $2',
      [newLevel, instanceId]
    );
  } else {
    // Failure: stay / downgrade / destroy
    const stayPct = parseInt(await getSetting('enhance_fail_stay_pct') || '50');
    let destroyPct = parseInt(await getSetting('enhance_fail_destroy_pct') || '10');
    // ✅ [Job System] Crafter break protection buff (buff_value 0.50 = 파괴율 50% 감소)
    try { if (jobService) destroyPct = Math.max(0, Math.round(destroyPct * await jobService.getJobBuff(w, 'crafter_enhancement_break_protection', 1.0))); } catch (_je) {}
    const failRoll = Math.random() * 100;

    if (failRoll < stayPct) {
      outcome = 'stay';
      newLevel = currentLevel;
    } else if (failRoll < stayPct + destroyPct) {
      outcome = 'destroy';
      newLevel = 0;
      // Delete the instance
      await client.query('DELETE FROM item_instances WHERE id = $1', [instanceId]);
    } else {
      outcome = 'downgrade';
      newLevel = Math.max(0, currentLevel - 1);
      await client.query(
        'UPDATE item_instances SET enhancement_level = $1 WHERE id = $2',
        [newLevel, instanceId]
      );
    }
  }

  // Log enhancement attempt
  await client.query(
    `INSERT INTO enhancement_log (instance_id, wallet, from_level, to_level, success, outcome, gp_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [instanceId, w, currentLevel, newLevel, success, outcome, cost]
  );

  return {
    success,
    outcome,
    fromLevel: currentLevel,
    toLevel: newLevel,
    cost,
    item: { id: inst.item_type_id, name: inst.name, code: inst.code, icon: inst.icon },
    instanceId: outcome === 'destroy' ? null : instanceId
  };
}

// ── Get user's item instances ──
async function getInstances(wallet) {
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT ii.id, ii.item_type_id, ii.enhancement_level, ii.created_at,
            it.code, it.name, it.icon, it.category, it.description
     FROM item_instances ii
     JOIN item_types it ON it.id = ii.item_type_id
     WHERE ii.wallet = $1
     ORDER BY ii.enhancement_level DESC, it.name`,
    [w]
  );
  return res.rows;
}

// ── Admin: get enhancement stats ──
async function getEnhancementStats() {
  const res = await pool.query(`
    SELECT
      COUNT(*) AS total_attempts,
      COUNT(*) FILTER (WHERE success = true) AS successes,
      COUNT(*) FILTER (WHERE outcome = 'stay') AS stays,
      COUNT(*) FILTER (WHERE outcome = 'downgrade') AS downgrades,
      COUNT(*) FILTER (WHERE outcome = 'destroy') AS destroys,
      COALESCE(SUM(gp_cost), 0) AS total_gp_spent,
      COALESCE(AVG(gp_cost), 0) AS avg_gp_cost
    FROM enhancement_log
  `);
  const stats = res.rows[0];

  // Highest enhanced items
  const topItems = await pool.query(`
    SELECT ii.id, ii.enhancement_level, ii.wallet, it.name, it.icon, it.code
    FROM item_instances ii
    JOIN item_types it ON it.id = ii.item_type_id
    WHERE ii.enhancement_level > 0
    ORDER BY ii.enhancement_level DESC, ii.created_at
    LIMIT 20
  `);

  // Recent attempts
  const recent = await pool.query(`
    SELECT el.*, it.name AS item_name, it.icon AS item_icon
    FROM enhancement_log el
    JOIN item_instances ii ON ii.id = el.instance_id
    JOIN item_types it ON it.id = ii.item_type_id
    ORDER BY el.created_at DESC
    LIMIT 30
  `);

  return {
    ...stats,
    topItems: topItems.rows,
    recentAttempts: recent.rows
  };
}

module.exports = {
  materializeItem,
  dematerializeItem,
  enhanceItem,
  getEnhancementCost,
  getEnhancementCosts,
  getEnhancementRates,
  getInstances,
  getEnhancementStats
};

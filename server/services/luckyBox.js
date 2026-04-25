'use strict';
// ⚠ STATUS: 🔴 PHANTOM TABLES — 이 서비스가 의존하는 테이블이 DB에 없음.
// 호출 시 silent 실패 (catch에서 'internal_error' 반환). 살리려면 마이그레이션
// 추가 또는 services + route + 스케줄러 등록 일괄 삭제 결정 필요.
// 자세한 내용: CLAUDE.md §13.A 참조.
const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

// Weighted random pick from loot table
function rollLoot(lootTable) {
  if (!Array.isArray(lootTable) || !lootTable.length) return null;
  const total = lootTable.reduce(function(s, e) { return s + (Number(e.weight) || 0); }, 0);
  if (!total) return lootTable[0];
  let r = Math.random() * total;
  for (const entry of lootTable) {
    r -= Number(entry.weight) || 0;
    if (r <= 0) return entry;
  }
  return lootTable[lootTable.length - 1];
}

// ── Open a lucky box ──────────────────────────────────────────────────────────
async function openBox(wallet, boxTypeId) {
  const wLower = wallet.toLowerCase();
  const enabled = await getSetting('lucky_box_enabled', 'true');
  if (enabled !== 'true') throw new Error('Lucky box system is disabled');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load box type
    const { rows: boxRows } = await client.query(
      'SELECT * FROM lucky_box_types WHERE id=$1 AND is_active=true', [boxTypeId]);
    if (!boxRows.length) throw new Error('Box type not found or inactive');
    const box = boxRows[0];
    const lootTable = Array.isArray(box.loot_table) ? box.loot_table : JSON.parse(box.loot_table || '[]');

    // Daily limit per user
    if (box.max_per_day > 0) {
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) AS c FROM lucky_box_openings
         WHERE wallet=$1 AND box_type_id=$2 AND created_at > NOW() - INTERVAL '24 hours'`,
        [wLower, boxTypeId]);
      if (Number(countRows[0].c) >= box.max_per_day) {
        throw new Error(`Daily limit reached (${box.max_per_day}/day for this box)`);
      }
    }

    // Check GP balance
    const { rows: balRows } = await client.query(
      'SELECT balance FROM gp_balances WHERE wallet=$1 FOR UPDATE', [wLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < Number(box.cost_gp)) {
      throw new Error(`Insufficient GP (need ${box.cost_gp}, have ${bal.toFixed(2)})`);
    }

    // Deduct GP cost
    await client.query(
      'UPDATE gp_balances SET balance = balance - $1 WHERE wallet=$2',
      [box.cost_gp, wLower]);

    // Roll loot
    const reward = rollLoot(lootTable);
    if (!reward) throw new Error('No loot configured for this box');

    let rewardGP = 0;
    let rewardItemId = null;
    let rewardItemQty = 1;
    let rewardLabel = reward.label || 'Mystery Reward';

    if (reward.type === 'gp') {
      rewardGP = Number(reward.amount) || 0;
      if (rewardGP > 0) {
        // Pay out GP reward from prize pool (not a circular deduction from cost)
        await client.query(
          `INSERT INTO gp_balances (wallet, balance) VALUES ($1, $2)
           ON CONFLICT (wallet) DO UPDATE SET balance = gp_balances.balance + EXCLUDED.balance`,
          [wLower, rewardGP]);
      }
    } else if (reward.type === 'gp_percent') {
      // Reward is a % of the cost back
      rewardGP = parseFloat((Number(box.cost_gp) * Number(reward.amount) / 100).toFixed(6));
      if (rewardGP > 0) {
        await client.query(
          `INSERT INTO gp_balances (wallet, balance) VALUES ($1, $2)
           ON CONFLICT (wallet) DO UPDATE SET balance = gp_balances.balance + EXCLUDED.balance`,
          [wLower, rewardGP]);
      }
      rewardLabel = rewardLabel || `${reward.amount}% back`;
    } else if (reward.type === 'item' && reward.item_type_id) {
      rewardItemId = reward.item_type_id;
      rewardItemQty = Number(reward.amount) || 1;
      // Grant item
      await client.query(
        `INSERT INTO user_items (wallet, item_type_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (wallet, item_type_id) DO UPDATE
           SET quantity = user_items.quantity + EXCLUDED.quantity`,
        [wLower, rewardItemId, rewardItemQty]);
    }

    // Log opening
    const { rows: logRows } = await client.query(
      `INSERT INTO lucky_box_openings
         (wallet, box_type_id, gp_spent, reward_type, reward_amount, reward_item_id, reward_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [wLower, boxTypeId, box.cost_gp, reward.type,
       reward.type === 'item' ? rewardItemQty : rewardGP,
       rewardItemId, rewardLabel]);

    await client.query('COMMIT');
    return {
      openingId: logRows[0].id,
      boxName: box.name,
      boxIcon: box.icon,
      gpSpent: Number(box.cost_gp),
      reward: {
        type:    reward.type,
        amount:  reward.type === 'item' ? rewardItemQty : rewardGP,
        itemId:  rewardItemId,
        label:   rewardLabel
      }
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Get all active box types ──────────────────────────────────────────────────
async function getBoxTypes() {
  const { rows } = await pool.query(
    `SELECT id, name, icon, description, cost_gp, max_per_day, category, sort_order, loot_table
     FROM lucky_box_types WHERE is_active=true ORDER BY sort_order, id`);
  return rows;
}

// ── Get recent openings feed (all players) ────────────────────────────────────
async function getRecentOpenings(limit) {
  const lim = Math.min(parseInt(limit || 20, 10), 100);
  const { rows } = await pool.query(
    `SELECT lbo.*, lbt.name AS box_name, lbt.icon AS box_icon,
            up.nickname AS nick
     FROM lucky_box_openings lbo
     JOIN lucky_box_types lbt ON lbt.id = lbo.box_type_id
     LEFT JOIN user_profiles up ON up.wallet = lbo.wallet
     ORDER BY lbo.created_at DESC LIMIT $1`, [lim]);
  return rows;
}

// ── Get player's opening history ──────────────────────────────────────────────
async function getMyOpenings(wallet, limit) {
  const lim = Math.min(parseInt(limit || 20, 10), 100);
  const { rows } = await pool.query(
    `SELECT lbo.*, lbt.name AS box_name, lbt.icon AS box_icon
     FROM lucky_box_openings lbo
     JOIN lucky_box_types lbt ON lbt.id = lbo.box_type_id
     WHERE lbo.wallet=$1
     ORDER BY lbo.created_at DESC LIMIT $2`,
    [wallet.toLowerCase(), lim]);
  return rows;
}

// ── Admin stats ───────────────────────────────────────────────────────────────
async function getAdminStats() {
  const [totals, boxStats, types, settings, recent] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_opens, SUM(gp_spent) AS total_gp_spent,
              SUM(CASE WHEN reward_type='gp' OR reward_type='gp_percent' THEN reward_amount ELSE 0 END) AS total_gp_paid_out,
              COUNT(DISTINCT wallet) AS unique_players
       FROM lucky_box_openings`),
    pool.query(
      `SELECT lbt.id, lbt.name, lbt.icon, lbt.cost_gp,
              COUNT(lbo.id) AS opens, COALESCE(SUM(lbo.gp_spent),0) AS gp_spent
       FROM lucky_box_types lbt
       LEFT JOIN lucky_box_openings lbo ON lbo.box_type_id = lbt.id
       GROUP BY lbt.id ORDER BY lbt.sort_order`),
    pool.query(
      'SELECT * FROM lucky_box_types ORDER BY sort_order, id'),
    pool.query(
      `SELECT key, value FROM game_settings WHERE category='lucky_box' ORDER BY key`),
    pool.query(
      `SELECT lbo.*, lbt.name AS box_name, up.nickname AS nick
       FROM lucky_box_openings lbo
       JOIN lucky_box_types lbt ON lbt.id = lbo.box_type_id
       LEFT JOIN user_profiles up ON up.wallet = lbo.wallet
       ORDER BY lbo.created_at DESC LIMIT 30`)
  ]);
  return {
    totals: totals.rows[0],
    boxStats: boxStats.rows,
    types: types.rows,
    settings: settings.rows,
    recent: recent.rows
  };
}

module.exports = {
  openBox, getBoxTypes, getRecentOpenings, getMyOpenings, getAdminStats
};

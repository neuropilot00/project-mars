'use strict';
/**
 * Achievement Service — Migration 104
 * Checks and unlocks permanent milestone achievements.
 * Rewards (GP) are auto-granted on first unlock.
 * All public check functions are safe to call fire-and-forget.
 */

const { pool, getSetting, notifyPlayer, logGPActivity } = require('../db');
let newsService;
try { newsService = require('./news'); } catch (_) {}

// ── Current-value resolvers ──────────────────────────────────────────────────

async function getCurrentValue(wallet, conditionType) {
  const w = wallet.toLowerCase();
  switch (conditionType) {
    case 'claim_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM claims WHERE owner = $1 AND deleted_at IS NULL`, [w]
      )).rows[0]?.n) || 0;

    case 'ship_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM ships WHERE owner_wallet = $1 AND is_alive = true`, [w]
      )).rows[0]?.n) || 0;

    case 'battle_win_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM battles
          WHERE winner_wallet = $1 AND status = 'completed'`, [w]
      )).rows[0]?.n) || 0;

    case 'marketplace_buy_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM marketplace_listings WHERE buyer = $1 AND status = 'sold'`, [w]
      )).rows[0]?.n) || 0;

    case 'marketplace_sell_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM marketplace_listings WHERE seller = $1 AND status = 'sold'`, [w]
      )).rows[0]?.n) || 0;

    case 'gp_balance':
      return parseFloat((await pool.query(
        `SELECT COALESCE(gp_balance, 0) AS n FROM users WHERE wallet_address = $1`, [w]
      )).rows[0]?.n) || 0;

    case 'guild_membership':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM guild_members WHERE wallet = $1`, [w]
      )).rows[0]?.n) || 0;

    case 'referral_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM users
          WHERE referred_by = (
            SELECT referral_code FROM users WHERE wallet_address = $1 LIMIT 1
          )`, [w]
      )).rows[0]?.n) || 0;

    case 'cosmetic_count':
      return parseInt((await pool.query(
        `SELECT COALESCE(SUM(ui.quantity), 0) AS n
           FROM user_items ui
           JOIN item_types it ON it.id = ui.item_type_id
          WHERE ui.wallet = $1 AND it.category = 'cosmetic'`, [w]
      )).rows[0]?.n) || 0;

    case 'enhancement_count':
      return parseInt((await pool.query(
        `SELECT COUNT(*) AS n FROM enhancement_log WHERE wallet = $1 AND success = true`, [w]
      )).rows[0]?.n) || 0;

    case 'max_enhancement_level':
      return parseInt((await pool.query(
        `SELECT COALESCE(MAX(to_level), 0) AS n FROM enhancement_log WHERE wallet = $1 AND success = true`, [w]
      )).rows[0]?.n) || 0;

    default:
      return 0;
  }
}

// ── Core unlock logic ────────────────────────────────────────────────────────

async function unlockAchievement(wallet, key, rewardGp) {
  const w = wallet.toLowerCase();
  const mult = parseFloat(await getSetting('achievement_reward_mult').catch(() => '1.0')) || 1.0;
  const finalGp = Math.round(rewardGp * mult);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO user_achievements (wallet, achievement_key)
       VALUES ($1, $2)
       ON CONFLICT (wallet, achievement_key) DO NOTHING
       RETURNING achievement_key`,
      [w, key]
    );
    if (!ins.rows.length) { await client.query('ROLLBACK'); return false; } // already unlocked

    if (finalGp > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE wallet_address = $1`,
        [w, finalGp]
      );
      // Log GP activity
      if (logGPActivity) {
        logGPActivity(w, finalGp, 'achievement_reward', `Achievement: ${key}`).catch(() => {});
      }
    }

    await client.query('COMMIT');

    // Fire-and-forget notification
    if (notifyPlayer) {
      notifyPlayer(w, `🏆 Achievement Unlocked! +${finalGp} GP`, 'achievement').catch(() => {});
    }
    // News feed for epic/legendary
    if (newsService) {
      pool.query(`SELECT name_en, rarity FROM achievements WHERE key = $1`, [key])
        .then(r => {
          if (r.rows.length) newsService.onAchievementUnlock(w, r.rows[0].name_en, r.rows[0].rarity).catch(() => {});
        }).catch(() => {});
    }
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Achievements] unlock error:', e.message);
    return false;
  } finally {
    client.release();
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check a specific condition type and unlock any newly met achievements.
 * Safe to call fire-and-forget: checkAndUnlock(wallet, 'claim_count').catch(()=>{})
 */
async function checkAndUnlock(wallet, conditionType) {
  const enabled = await getSetting('achievements_enabled').catch(() => 'true');
  if (enabled === 'false') return;

  const w = wallet.toLowerCase();

  // Get all achievements of this type not yet earned by this wallet
  const achRes = await pool.query(
    `SELECT a.key, a.condition_value, a.reward_gp
       FROM achievements a
      WHERE a.condition_type = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_achievements ua
           WHERE ua.wallet = $2 AND ua.achievement_key = a.key
        )
      ORDER BY a.condition_value ASC`,
    [conditionType, w]
  );
  if (!achRes.rows.length) return;

  const current = await getCurrentValue(w, conditionType);
  for (const ach of achRes.rows) {
    if (current >= ach.condition_value) {
      await unlockAchievement(w, ach.key, parseFloat(ach.reward_gp));
    }
  }
}


/**
 * Check ALL condition types for a wallet and unlock any newly met achievements.
 * Called when the user loads the achievements page — ensures unlocks are always current.
 */
async function checkAllForWallet(wallet) {
  const enabled = await getSetting('achievements_enabled').catch(() => 'true');
  if (enabled === 'false') return;

  // Get distinct condition types from achievements not yet earned
  const typesRes = await pool.query(
    `SELECT DISTINCT a.condition_type
       FROM achievements a
      WHERE NOT EXISTS (
        SELECT 1 FROM user_achievements ua
         WHERE ua.wallet = $1 AND ua.achievement_key = a.key
      )`,
    [wallet.toLowerCase()]
  ).catch(() => ({ rows: [] }));

  // Run all condition checks in parallel
  await Promise.allSettled(
    typesRes.rows.map(r => checkAndUnlock(wallet, r.condition_type))
  );
}

/**
 * Get all achievements with unlock status for a wallet.
 * Returns [{...achievement, unlocked, unlocked_at}]
 */
async function getUserAchievements(wallet) {
  // Lazily unlock any newly met achievements before returning the list
  await checkAllForWallet(wallet).catch(() => {});
  const w = wallet.toLowerCase();
  const res = await pool.query(
    `SELECT a.*,
            ua.unlocked_at,
            (ua.wallet IS NOT NULL) AS unlocked
       FROM achievements a
       LEFT JOIN user_achievements ua
              ON ua.achievement_key = a.key AND ua.wallet = $1
      ORDER BY a.category, a.condition_value ASC, a.key`,
    [w]
  );
  return res.rows;
}

/**
 * Get aggregate stats for admin panel.
 */
async function getAdminStats() {
  const [totalRes, todayRes, topRes] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)                    AS total_unlocks,
             COALESCE(SUM(a.reward_gp), 0) AS total_gp_given
        FROM user_achievements ua
        JOIN achievements a ON a.key = ua.achievement_key
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT COUNT(*) AS today_unlocks
        FROM user_achievements
       WHERE unlocked_at >= CURRENT_DATE
    `).catch(() => ({ rows: [{}] })),
    pool.query(`
      SELECT a.key, a.name_en, a.icon, a.rarity,
             COUNT(ua.wallet) AS unlock_count
        FROM achievements a
        LEFT JOIN user_achievements ua ON ua.achievement_key = a.key
       GROUP BY a.key, a.name_en, a.icon, a.rarity
       ORDER BY unlock_count DESC
       LIMIT 20
    `).catch(() => ({ rows: [] })),
  ]);

  return {
    total_unlocks: parseInt(totalRes.rows[0]?.total_unlocks) || 0,
    total_gp_given: parseFloat(totalRes.rows[0]?.total_gp_given) || 0,
    today_unlocks: parseInt(todayRes.rows[0]?.today_unlocks) || 0,
    top: topRes.rows,
  };
}

module.exports = { checkAndUnlock, checkAllForWallet, getUserAchievements, unlockAchievement, getAdminStats };

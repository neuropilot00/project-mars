const express = require('express');
const { makeRateLimiter } = require('../utils/rateLimiters');
const { pool, getSetting, getPPToGPRate, awardXP, notifyPlayer } = require('../db');
const { requireAuth, getAuthWallet, sanitize } = require('../utils/apiHelpers');
const { cfg } = require('../utils/settingsCache');

const router = express.Router();

const readLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests. Please slow down.' }
});

const writeLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many write requests. Please wait.' }
});

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randReward(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 10000) / 10000;
}

async function generateQuestsForUser(wallet) {
  const w = sanitize(wallet, 255).toLowerCase();
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT tier FROM user_quests WHERE LOWER(wallet) = LOWER($1) AND status IN ('active','completed')",
      [w]
    );

    const tplRes = await client.query('SELECT * FROM quest_templates WHERE active = true');
    const templates = tplRes.rows;
    const questsToAdd = [];
    const tierSlots = { free: 3, activity: 2, spending: 1 };

    for (const [tier, maxSlots] of Object.entries(tierSlots)) {
      const currentCount = existing.rows.filter(r => r.tier === tier).length;
      const slotsNeeded = maxSlots - currentCount;
      if (slotsNeeded <= 0) continue;

      const tierTemplates = templates.filter(t => t.tier === tier);
      if (tierTemplates.length === 0) continue;

      const recentRes = await client.query(
        `SELECT template_id FROM user_quests
         WHERE LOWER(wallet) = LOWER($1) AND tier = $2 AND status = 'claimed'
         AND claimed_at > NOW() - INTERVAL '1 hour' * (SELECT cooldown_hours FROM quest_templates WHERE id = user_quests.template_id)`,
        [w, tier]
      );
      const cooldownIds = new Set(recentRes.rows.map(r => r.template_id));
      const available = tierTemplates.filter(t => !cooldownIds.has(t.id));
      if (available.length === 0) continue;

      const usedIds = new Set();
      for (let i = 0; i < slotsNeeded; i++) {
        const unused = available.filter(t => !usedIds.has(t.id));
        const pick = unused.length > 0 ? unused : available;
        const tpl = pick[randInt(0, pick.length - 1)];
        usedIds.add(tpl.id);

        const reqValue = randInt(parseInt(tpl.requirement_min), parseInt(tpl.requirement_max));
        const rewardPP = randReward(parseFloat(tpl.reward_pp_min), parseFloat(tpl.reward_pp_max));
        const expiryHours = tier === 'free' ? 24 : tier === 'activity' ? 48 : 72;

        questsToAdd.push({
          wallet: w,
          template_id: tpl.id,
          tier,
          title: tpl.title_template,
          description: tpl.description_template.replace('{n}', reqValue),
          requirement_type: tpl.requirement_type,
          requirement_value: reqValue,
          reward_pp: rewardPP,
          expires_at: new Date(Date.now() + expiryHours * 3600000)
        });
      }
    }

    for (const q of questsToAdd) {
      await client.query(
        `INSERT INTO user_quests (wallet, template_id, tier, title, description, requirement_type, requirement_value, reward_pp, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [q.wallet, q.template_id, q.tier, q.title, q.description, q.requirement_type, q.requirement_value, q.reward_pp, q.expires_at]
      );
    }

    return questsToAdd.length;
  } finally {
    client.release();
  }
}

router.get('/quests', requireAuth, readLimiter, async (req, res) => {
  try {
    const w = getAuthWallet(req);
    if (!w) return res.status(400).json({ error: 'wallet required' });

    await generateQuestsForUser(w);

    await pool.query(
      "UPDATE user_quests SET status = 'expired' WHERE LOWER(wallet) = LOWER($1) AND status = 'active' AND expires_at < NOW()",
      [w]
    );

    const result = await pool.query(
      `SELECT id, tier, title, description, requirement_type, requirement_value,
              current_progress, reward_pp, status, assigned_at, expires_at
       FROM user_quests
       WHERE LOWER(wallet) = LOWER($1) AND status IN ('active','completed')
       ORDER BY
         CASE tier WHEN 'free' THEN 1 WHEN 'activity' THEN 2 WHEN 'spending' THEN 3 END,
         assigned_at DESC`,
      [w]
    );

    const claimed = await pool.query(
      `SELECT id, tier, title, reward_pp, claimed_at
       FROM user_quests
       WHERE LOWER(wallet) = LOWER($1) AND status = 'claimed' AND claimed_at > NOW() - INTERVAL '24 hours'
       ORDER BY claimed_at DESC LIMIT 10`,
      [w]
    );

    const s = await cfg();
    const poolBalance = 1;
    const poolMultiplier = 1.0;
    const questRate = await getPPToGPRate();
    const questFloor = {
      free: parseInt(await getSetting('quest_min_gp_free', '3'), 10) || 3,
      activity: parseInt(await getSetting('quest_min_gp_activity', '8'), 10) || 8,
      spending: parseInt(await getSetting('quest_min_gp_spending', '20'), 10) || 20
    };

    res.json({
      quests: result.rows.map(r => {
        const ar = Math.min(
          Math.round(parseFloat(r.reward_pp) * poolMultiplier * 10000) / 10000,
          r.tier === 'free' ? (parseFloat(s.quest_max_reward_free) || 0.05) :
          r.tier === 'activity' ? (parseFloat(s.quest_max_reward_activity) || 0.3) :
          (parseFloat(s.quest_max_reward_spending) || 1.0)
        );
        return {
          ...r,
          reward_pp: parseFloat(r.reward_pp),
          actual_reward: ar,
          reward_gp: Math.max(questFloor[r.tier] || 0, Math.round(ar * questRate * 1e6) / 1e6),
          requirement_value: parseFloat(r.requirement_value),
          current_progress: parseFloat(r.current_progress),
          progress_pct: Math.min(100, Math.round((parseFloat(r.current_progress) / parseFloat(r.requirement_value)) * 100))
        };
      }),
      recentlyClaimed: claimed.rows.map(r => ({
        ...r,
        reward_pp: parseFloat(r.reward_pp),
        reward_gp: Math.max(questFloor[r.tier] || 0, Math.round(parseFloat(r.reward_pp) * questRate * 1e6) / 1e6)
      })),
      pool: {
        balance: poolBalance,
        multiplier: poolMultiplier,
        active: poolBalance > 0
      }
    });
  } catch (e) {
    console.error('[API] quests error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/quests/:id/progress', requireAuth, writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const { amount } = req.body;
    const w = getAuthWallet(req);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });
    const increment = parseFloat(amount) || 1;

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'active' FOR UPDATE",
      [questId, w]
    );
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quest not found or not active' });
    }

    const quest = qRes.rows[0];
    const newProgress = Math.min(parseFloat(quest.current_progress) + increment, parseFloat(quest.requirement_value));
    const isComplete = newProgress >= parseFloat(quest.requirement_value);

    await client.query(
      `UPDATE user_quests SET current_progress = $1, status = $2, completed_at = $3
       WHERE id = $4`,
      [newProgress, isComplete ? 'completed' : 'active', isComplete ? new Date() : null, questId]
    );

    await client.query('COMMIT');

    if (isComplete) {
      notifyPlayer(
        w.toLowerCase(),
        'quest_complete',
        'Quest complete. Claim your reward.',
        { questId }
      ).catch(() => {});
    }

    res.json({
      questId,
      current_progress: newProgress,
      requirement_value: parseFloat(quest.requirement_value),
      status: isComplete ? 'completed' : 'active',
      progress_pct: Math.min(100, Math.round((newProgress / parseFloat(quest.requirement_value)) * 100))
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] quest progress error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

router.post('/quests/:id/claim', requireAuth, writeLimiter, async (req, res) => {
  const client = await pool.connect();
  try {
    const questId = parseInt(req.params.id);
    const w = getAuthWallet(req);
    if (!w || !questId) return res.status(400).json({ error: 'Invalid params' });

    await client.query('BEGIN');

    const qRes = await client.query(
      "SELECT * FROM user_quests WHERE id = $1 AND LOWER(wallet) = LOWER($2) AND status = 'completed' FOR UPDATE",
      [questId, w]
    );
    if (qRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Quest not completed or already claimed' });
    }

    const quest = qRes.rows[0];
    const baseReward = parseFloat(quest.reward_pp);
    const s = await cfg();
    const multiplier = 1.0;
    const poolBalance = 0;
    const tierCaps = {
      free: parseFloat(s.quest_max_reward_free) || 0.05,
      activity: parseFloat(s.quest_max_reward_activity) || 0.3,
      spending: parseFloat(s.quest_max_reward_spending) || 1.0
    };
    const tierCap = tierCaps[quest.tier] || 0.05;
    const userDailyCap = parseFloat(s.quest_max_daily_per_user) || 2.0;

    const userTodayRes = await client.query(
      "SELECT COALESCE(SUM(pp_amount),0) AS total FROM transactions WHERE type='quest' AND LOWER(from_wallet)=LOWER($1) AND created_at > CURRENT_DATE",
      [w]
    );
    const userTodayTotal = parseFloat(userTodayRes.rows[0].total);
    const userDailyRemaining = Math.max(0, userDailyCap - userTodayTotal);

    let actualReward = Math.round(baseReward * multiplier * 10000) / 10000;
    actualReward = Math.min(actualReward, tierCap);
    actualReward = Math.min(actualReward, userDailyRemaining);
    actualReward = Math.round(actualReward * 10000) / 10000;

    if (actualReward <= 0) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Daily reward limit reached ($'+userDailyCap+'/day)' });
    }

    const ppToGpRate = await getPPToGPRate(client);
    const questFloorClaim = {
      free: parseInt(await getSetting('quest_min_gp_free', '3'), 10) || 3,
      activity: parseInt(await getSetting('quest_min_gp_activity', '8'), 10) || 8,
      spending: parseInt(await getSetting('quest_min_gp_spending', '20'), 10) || 20
    };
    const actualRewardGP = Math.max(
      questFloorClaim[quest.tier] || 0,
      Math.round(actualReward * ppToGpRate * 1000000) / 1000000
    );

    await client.query(
      'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE LOWER(wallet_address) = LOWER($2)',
      [actualRewardGP, w]
    );

    await client.query(
      "UPDATE user_quests SET status = 'claimed', claimed_at = NOW() WHERE id = $1",
      [questId]
    );

    await client.query(
      `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
       VALUES ('quest', $1, $2, 0, $3)`,
      [w, actualReward, JSON.stringify({
        currency: 'gp',
        gp_amount: actualRewardGP,
        pp_equivalent: actualReward,
        quest_id: questId,
        tier: quest.tier,
        title: quest.title,
        base_reward: baseReward,
        multiplier,
        pool_balance: poolBalance
      })]
    );

    const questXP = quest.tier === 'challenge' ? 10 : quest.tier === 'activity' ? 5 : 3;
    const questRankUp = await awardXP(client, w, questXP);

    await client.query('COMMIT');

    res.json({
      success: true,
      questId,
      rewardPP: actualReward,
      rewardGP: actualRewardGP,
      xpEarned: questXP,
      rankUp: questRankUp || null,
      baseReward,
      multiplier,
      tier: quest.tier,
      title: quest.title
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[API] quest claim error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

router.post('/quests/track', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { action, amount } = req.body;
    const w = getAuthWallet(req);
    if (!w || !action) return res.status(400).json({ error: 'Invalid params' });
    const increment = parseFloat(amount) || 1;

    const result = await pool.query(
      `UPDATE user_quests SET
         current_progress = LEAST(current_progress + $1, requirement_value),
         status = CASE WHEN LEAST(current_progress + $1, requirement_value) >= requirement_value THEN 'completed' ELSE status END,
         completed_at = CASE WHEN LEAST(current_progress + $1, requirement_value) >= requirement_value AND completed_at IS NULL THEN NOW() ELSE completed_at END
       WHERE wallet = $2 AND requirement_type = $3 AND status = 'active'
       RETURNING id, title, tier, current_progress, requirement_value, status, reward_pp`,
      [increment, w, action]
    );

    const updated = result.rows.map(r => ({
      id: r.id,
      title: r.title,
      tier: r.tier,
      progress: parseFloat(r.current_progress),
      required: parseFloat(r.requirement_value),
      status: r.status,
      reward_pp: parseFloat(r.reward_pp),
      justCompleted: r.status === 'completed'
    }));

    res.json({ tracked: updated.length, quests: updated });
  } catch (e) {
    console.error('[API] quest track error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;

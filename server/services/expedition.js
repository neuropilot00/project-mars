'use strict';
const { pool } = require('../db');

async function getSetting(key, fallback) {
  try {
    const { rows } = await pool.query('SELECT value FROM game_settings WHERE key=$1', [key]);
    if (rows.length) return rows[0].value;
  } catch (_) {}
  return String(fallback);
}

// ── Available expedition types ────────────────────────────────────────────────
const EXP_TYPES = {
  salvage:   { icon: '🔍', label: 'Salvage Run',    costMult: 1.0 },
  survey:    { icon: '📡', label: 'Resource Survey', costMult: 1.2 },
  raid:      { icon: '⚔️', label: 'Border Raid',     costMult: 1.5 },
  deep_dive: { icon: '🚀', label: 'Deep Space Dive', costMult: 2.0 }
};

// ── Launch an expedition ──────────────────────────────────────────────────────
async function launchExpedition(wallet, claimId, expeditionType, durationH) {
  const wLower = wallet.toLowerCase();
  const enabled = await getSetting('expedition_enabled', 'true');
  if (enabled !== 'true') throw new Error('Expedition system is disabled');

  const expType = EXP_TYPES[expeditionType] || EXP_TYPES.salvage;
  const baseCost = parseFloat(await getSetting('expedition_base_cost_gp', '15'));
  const maxDur   = parseInt(await getSetting('expedition_max_duration_h', '24'), 10);
  const dur = Math.min(Math.max(1, parseInt(durationH, 10) || 1), maxDur);
  const cost = parseFloat((baseCost * dur * expType.costMult).toFixed(6));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify claim ownership
    const { rows: claimRows } = await client.query(
      `SELECT c.id, c.owner, COUNT(p.id) AS pixel_count
       FROM claims c
       LEFT JOIN pixels p ON p.claim_id = c.id
       WHERE c.id=$1 AND c.owner=$2
       GROUP BY c.id, c.owner`, [claimId, wLower]);
    if (!claimRows.length) throw new Error('Claim not found or not owned by you');
    const claim = claimRows[0];
    const pixelCount = parseInt(claim.pixel_count, 10) || 1;

    // Check no active expedition on this claim
    const { rows: activeRows } = await client.query(
      `SELECT id FROM expeditions WHERE claim_id=$1 AND status='active'`, [claimId]);
    if (activeRows.length) throw new Error('This territory already has an active expedition');

    // Check GP balance
    const { rows: balRows } = await client.query(
      'SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wLower]);
    const bal = balRows.length ? Number(balRows[0].balance) : 0;
    if (bal < cost) throw new Error(`Insufficient GP (need ${cost.toFixed(2)}, have ${bal.toFixed(2)})`);

    // Deduct GP
    const deductExpedition = await client.query(
      'UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [cost, wLower]);
    if (deductExpedition.rowCount === 0) throw new Error('INSUFFICIENT_GP');

    // Create expedition
    const returnsAt = new Date(Date.now() + dur * 3600000);
    const { rows: expRows } = await client.query(
      `INSERT INTO expeditions
         (wallet, claim_id, expedition_type, gp_spent, duration_h, returns_at, claim_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [wLower, claimId, expeditionType || 'salvage', cost, dur, returnsAt, pixelCount]);

    await client.query('COMMIT');
    return {
      expeditionId: expRows[0].id,
      type: expeditionType,
      icon: expType.icon,
      label: expType.label,
      gpSpent: cost,
      durationH: dur,
      returnsAt
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Resolve completed expeditions (scheduler) ─────────────────────────────────
async function resolveExpeditions() {
  // Find all expeditions that have returned but not been resolved
  const { rows: ready } = await pool.query(
    `SELECT e.*, up.nickname
     FROM expeditions e
     LEFT JOIN users up ON LOWER(up.wallet_address) = LOWER(e.wallet)
     WHERE e.status='active' AND e.returns_at <= NOW()
     LIMIT 50`);

  if (!ready.length) return;

  const sizeBonusPctPerHundred = parseFloat(await getSetting('expedition_size_bonus_pct', '2'));
  const nothingPct    = parseFloat(await getSetting('expedition_nothing_pct', '10')) / 100;
  let rewardTableStr;
  try { rewardTableStr = await getSetting('expedition_reward_table', '{"gp_min":0.5,"gp_max":3.0,"jackpot_mult":10,"jackpot_pct":3}'); }
  catch(_) { rewardTableStr = '{"gp_min":0.5,"gp_max":3.0,"jackpot_mult":10,"jackpot_pct":3}'; }
  let rt;
  try { rt = JSON.parse(rewardTableStr); } catch(_) { rt = { gp_min: 0.5, gp_max: 3.0, jackpot_mult: 10, jackpot_pct: 3 }; }

  for (const exp of ready) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check VIP status for bonus
      let vipBonus = 0;
      try {
        const { rows: vipRows } = await client.query(
          `SELECT vt.gp_earn_bonus_pct FROM vip_passes vp
           JOIN vip_tiers vt ON vt.id = vp.tier_id
           WHERE LOWER(vp.wallet)=LOWER($1) AND vp.is_active=true AND vp.expires_at > NOW()`,
          [exp.wallet]);
        if (vipRows.length) vipBonus = parseInt(vipRows[0].gp_earn_bonus_pct, 10) || 0;
      } catch (_) {}

      // Calculate reward
      const sizeBonus = Math.floor(Number(exp.claim_size) / 100) * sizeBonusPctPerHundred;
      const bonusMult = 1 + (sizeBonus + vipBonus) / 100;

      let rewardType, rewardAmount, rewardLabel;
      const roll = Math.random();

      if (roll < nothingPct) {
        rewardType = 'nothing'; rewardAmount = 0; rewardLabel = 'Nothing found';
      } else {
        const isJackpot = (Math.random() * 100) < (rt.jackpot_pct || 3);
        const gpMin = (rt.gp_min || 0.5) * Number(exp.gp_spent);
        const gpMax = (rt.gp_max || 3.0) * Number(exp.gp_spent);
        let baseReward = gpMin + Math.random() * (gpMax - gpMin);
        if (isJackpot) baseReward = Number(exp.gp_spent) * (rt.jackpot_mult || 10);
        rewardAmount = parseFloat((baseReward * bonusMult).toFixed(6));
        rewardType   = 'gp';
        rewardLabel  = isJackpot
          ? `🎉 JACKPOT! ${rewardAmount.toFixed(2)} GP`
          : `${rewardAmount.toFixed(2)} GP`;

        // Pay reward
        await client.query(
          `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
          [exp.wallet, rewardAmount]);
      }

      // Mark completed — [v7.64] AND status='active' 이중 정산 방지
      const { rowCount: expRowCount } = await client.query(
        `UPDATE expeditions SET status='completed', reward_type=$1, reward_amount=$2,
           reward_label=$3, completed_at=NOW()
         WHERE id=$4 AND status='active'`,
        [rewardType, rewardAmount, rewardLabel, exp.id]);
      if (expRowCount === 0) {
        // 이미 다른 인스턴스가 처리했으면 GP 지급 없이 ROLLBACK
        await client.query('ROLLBACK');
        continue;
      }

      // Notify player
      try {
        const expInfo = EXP_TYPES[exp.expedition_type] || EXP_TYPES.salvage;
        await client.query(
          `INSERT INTO player_notifications (wallet, type, message, meta)
           VALUES ($1,'expedition_returned',$2,$3)`,
          [exp.wallet,
           `${expInfo.icon} Expedition returned: ${rewardLabel}`,
           JSON.stringify({ expedition_id: exp.id, claim_id: exp.claim_id })]);
      } catch (_) {}

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[EXPEDITION] resolve error for #' + exp.id + ':', err.message);
    } finally {
      client.release();
    }
  }

  if (ready.length > 0) console.log(`[EXPEDITION] Resolved ${ready.length} expedition(s)`);
}

// ── Cancel an active expedition (partial refund) ──────────────────────────────
async function cancelExpedition(wallet, expeditionId) {
  const wLower = wallet.toLowerCase();

  // [v7.64] SELECT 을 트랜잭션 내 FOR UPDATE 로 이동 — 동시 취소 이중 환불 방지
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM expeditions WHERE id=$1 AND LOWER(wallet)=LOWER($2) AND status='active' FOR UPDATE`,
      [expeditionId, wLower]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      throw new Error('Expedition not found or already completed');
    }
    const exp = rows[0];

    // Calculate refund: 50% of remaining time value
    const totalMs = new Date(exp.returns_at) - new Date(exp.launched_at);
    const remainMs = new Date(exp.returns_at) - new Date();
    const refund = remainMs > 0 ? parseFloat((Number(exp.gp_spent) * 0.5 * (remainMs / totalMs)).toFixed(6)) : 0;

    const { rowCount: cancelRowCount } = await client.query(
      `UPDATE expeditions SET status='cancelled' WHERE id=$1 AND status='active'`, [expeditionId]);
    if (cancelRowCount === 0) {
      await client.query('ROLLBACK');
      throw new Error('Expedition not found or already completed');
    }
    if (refund > 0) {
      await client.query(
        `UPDATE users SET gp_balance = gp_balance + $2 WHERE LOWER(wallet_address) = LOWER($1)`,
        [wLower, refund]);
    }
    await client.query('COMMIT');
    return { ok: true, refund };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Get my expeditions ────────────────────────────────────────────────────────
async function getMyExpeditions(wallet) {
  const { rows } = await pool.query(
    `SELECT e.*, c.custom_name AS claim_name
     FROM expeditions e
     LEFT JOIN claims c ON c.id = e.claim_id
     WHERE LOWER(e.wallet)=LOWER($1)
     ORDER BY e.launched_at DESC LIMIT 30`,
    [wallet.toLowerCase()]);
  return rows;
}

// ── Get available durations and costs ────────────────────────────────────────
async function getExpeditionInfo() {
  const [baseCost, maxDur, durations, enabled] = await Promise.all([
    getSetting('expedition_base_cost_gp', '15'),
    getSetting('expedition_max_duration_h', '24'),
    getSetting('expedition_durations', '1,3,6,12,24'),
    getSetting('expedition_enabled', 'true')
  ]);
  const durList = durations.split(',').map(Number).filter(n => n > 0 && n <= parseInt(maxDur, 10));
  const costs = {};
  for (const [type, info] of Object.entries(EXP_TYPES)) {
    costs[type] = durList.map(d => ({
      hours: d,
      cost: parseFloat((parseFloat(baseCost) * d * info.costMult).toFixed(2))
    }));
  }
  return { enabled: enabled === 'true', types: EXP_TYPES, durations: durList, costs };
}

// ── Admin stats ───────────────────────────────────────────────────────────────
async function getAdminStats() {
  const [totals, recent, settings] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_expeditions, SUM(gp_spent) AS total_gp_spent,
              SUM(CASE WHEN status='completed' THEN reward_amount ELSE 0 END) AS total_gp_rewarded,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_expeditions,
              COUNT(DISTINCT wallet) AS unique_players
       FROM expeditions`),
    pool.query(
      `SELECT e.*, up.nickname, c.custom_name AS claim_name
       FROM expeditions e
       LEFT JOIN users up ON LOWER(up.wallet_address) = LOWER(e.wallet)
       LEFT JOIN claims c ON c.id = e.claim_id
       ORDER BY e.launched_at DESC LIMIT 30`),
    pool.query(`SELECT key, value FROM game_settings WHERE category='expedition' ORDER BY key`)
  ]);
  return { totals: totals.rows[0], recent: recent.rows, settings: settings.rows };
}

module.exports = {
  launchExpedition, resolveExpeditions, cancelExpedition,
  getMyExpeditions, getExpeditionInfo, getAdminStats, EXP_TYPES
};

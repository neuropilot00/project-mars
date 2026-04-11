// ════════════════════════════════════════════════════════════════
//  MISSIONS SERVICE  (single-player OPS: invasion + exploration)
// ────────────────────────────────────────────────────────────────
//  Missions are long-running operations launched from a player's
//  territory. Two types:
//    INVASION     — ballistic strike on another player's tile.
//                   On success, steals N% of that player's pixels
//                   and credits PP/GP/XP/items.
//    EXPLORATION  — straight-line scout to a random Mars coordinate.
//                   Always pays out (100% deliver) but rewards vary.
//
//  Distances are partitioned into NEAR (<30°), MID (30-90°), FAR
//  (>=90°) tiers. Every timing/cost/reward value is driven by
//  settings keys created in migration 057_missions.sql — nothing
//  is hardcoded except the tier thresholds themselves, which are
//  also sourced from settings.
// ════════════════════════════════════════════════════════════════

const { pool, getSetting, ensureUser, creditReferralCommission, awardXP } = require('../db');

// ── Helpers ──────────────────────────────────────────────────────

function toRad(d) { return d * Math.PI / 180; }

/** Great-circle distance in DEGREES (0 – 180). */
function greatCircleDeg(lat1, lng1, lat2, lng2) {
  const p1 = toRad(lat1), p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1), dl = toRad(lng2 - lng1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (c * 180) / Math.PI;
}

/** Parse a "min,max" range setting into [min, max] floats. */
async function parseRange(key, fallback) {
  const raw = (await getSetting(key)) || fallback;
  const parts = String(raw).split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || !isFinite(parts[0]) || !isFinite(parts[1])) {
    return [0, 0];
  }
  return parts;
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randIntBetween(min, max) {
  return Math.floor(randBetween(min, max + 1));
}

/** Classify distance into NEAR/MID/FAR. */
async function distanceTier(distDeg) {
  const near = parseFloat(await getSetting('mission_dist_near_max_deg') || '30');
  const mid  = parseFloat(await getSetting('mission_dist_mid_max_deg')  || '90');
  if (distDeg < near) return 'near';
  if (distDeg < mid)  return 'mid';
  return 'far';
}

/** Current concurrent-mission slot cap for a wallet. */
async function slotCapForWallet(wallet) {
  const base = parseInt(await getSetting('mission_base_slots') || '2');
  const step = parseInt(await getSetting('mission_slot_level_step') || '10');
  const r = await pool.query('SELECT rank_level FROM users WHERE wallet_address = $1', [wallet]);
  const lvl = parseInt(r.rows[0]?.rank_level || 1);
  return base + Math.floor(lvl / Math.max(1, step));
}

/** Find the player's closest-to-target owned pixel (the launch origin). */
async function findClosestOwnedPixel(wallet, targetLat, targetLng) {
  const r = await pool.query(
    `SELECT lat, lng FROM pixels WHERE owner = $1`,
    [wallet]
  );
  if (!r.rows.length) return null;
  let best = null, bestDist = Infinity;
  for (const row of r.rows) {
    const d = greatCircleDeg(parseFloat(row.lat), parseFloat(row.lng), targetLat, targetLng);
    if (d < bestDist) { bestDist = d; best = { lat: parseFloat(row.lat), lng: parseFloat(row.lng) }; }
  }
  return best ? { ...best, distance: bestDist } : null;
}

// ── LAUNCH ───────────────────────────────────────────────────────
//
//  Types:
//    'invasion'    — attacker picks a target wallet. Resolved on tick.
//    'exploration' — target is a random Mars coordinate. 100% payout.
//
async function launchMission(wallet, type, targetLat, targetLng, targetWallet) {
  if (!wallet) return { error: 'Wallet required' };
  if (type !== 'invasion' && type !== 'exploration') return { error: 'Invalid mission type' };
  if (type === 'invasion' && !targetWallet) return { error: 'Target wallet required for invasion' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUser(client, wallet);

    // ── Slot check
    const slotCap = await slotCapForWallet(wallet);
    const active = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM missions
       WHERE wallet = $1 AND status IN ('traveling','complete')`,
      [wallet]
    );
    if ((active.rows[0]?.cnt || 0) >= slotCap) {
      await client.query('ROLLBACK');
      return { error: `All ${slotCap} mission slots in use. Claim a completed mission first.` };
    }

    // ── Daily cap
    const dailyCap = parseInt(await getSetting('mission_daily_cap') || '12');
    const daily = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM missions
       WHERE wallet = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [wallet]
    );
    if ((daily.rows[0]?.cnt || 0) >= dailyCap) {
      await client.query('ROLLBACK');
      return { error: `Daily mission cap reached (${dailyCap}/24h)` };
    }

    // ── Find origin (closest owned pixel)
    const origin = await findClosestOwnedPixel(wallet, targetLat, targetLng);
    if (!origin) {
      await client.query('ROLLBACK');
      return { error: 'You must own territory to launch missions' };
    }

    // ── Invasion-specific validation
    if (type === 'invasion') {
      if (targetWallet.toLowerCase() === wallet.toLowerCase()) {
        await client.query('ROLLBACK');
        return { error: "Can't invade yourself" };
      }
      // Target must actually own something
      const tgtOwned = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1',
        [targetWallet.toLowerCase()]
      );
      if ((tgtOwned.rows[0]?.cnt || 0) === 0) {
        await client.query('ROLLBACK');
        return { error: 'Target has no territory' };
      }
    }

    const tier = await distanceTier(origin.distance);

    // ── Duration (seconds)
    const durKey = type === 'invasion'
      ? `mission_invade_${tier}_sec`
      : `mission_explore_${tier}_sec`;
    const durFallback = type === 'invasion'
      ? (tier === 'near' ? '900' : tier === 'mid' ? '3600' : '10800')
      : (tier === 'near' ? '1200' : tier === 'mid' ? '4500' : '13500');
    const durationSec = parseInt(await getSetting(durKey) || durFallback);

    // ── Launch cost
    const costKey = type === 'invasion'
      ? `mission_invade_cost_${tier}`
      : `mission_explore_cost_${tier}`;
    const costFallback = type === 'invasion'
      ? (tier === 'near' ? '0.5' : tier === 'mid' ? '1.5' : '3.0')
      : (tier === 'near' ? '0.2' : tier === 'mid' ? '0.8' : '2.0');
    const costPP = parseFloat(await getSetting(costKey) || costFallback);

    // ── Deduct PP fuel
    const balRes = await client.query(
      'SELECT pp_balance FROM users WHERE wallet_address = $1 FOR UPDATE',
      [wallet]
    );
    const bal = parseFloat(balRes.rows[0]?.pp_balance || 0);
    if (bal < costPP) {
      await client.query('ROLLBACK');
      return { error: `Need ${costPP} PP fuel. You have ${bal.toFixed(2)} PP.` };
    }
    await client.query(
      'UPDATE users SET pp_balance = pp_balance - $1 WHERE wallet_address = $2',
      [costPP, wallet]
    );

    // ── Insert mission row
    const ins = await client.query(
      `INSERT INTO missions
         (wallet, type, origin_lat, origin_lng, target_lat, target_lng, target_wallet,
          distance_deg, duration_sec, launch_cost_pp, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'traveling')
       RETURNING id, start_time`,
      [
        wallet, type,
        origin.lat, origin.lng,
        targetLat, targetLng,
        type === 'invasion' ? targetWallet.toLowerCase() : null,
        origin.distance, durationSec, costPP
      ]
    );
    const mission = ins.rows[0];

    await client.query('COMMIT');

    console.log(
      `[MISSION] ${type.toUpperCase()} #${mission.id} ${wallet.slice(0, 8)}`
      + ` tier=${tier} dist=${origin.distance.toFixed(1)}° dur=${durationSec}s cost=${costPP}PP`
    );

    return {
      success: true,
      mission: {
        id: mission.id,
        type,
        tier,
        originLat: origin.lat,
        originLng: origin.lng,
        targetLat, targetLng,
        targetWallet: type === 'invasion' ? targetWallet.toLowerCase() : null,
        distanceDeg: origin.distance,
        durationSec,
        launchCostPP: costPP,
        startTime: mission.start_time,
        status: 'traveling'
      }
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MISSION] launch error:', e.message);
    return { error: e.message };
  } finally {
    client.release();
  }
}

// ── TICK RESOLVER ────────────────────────────────────────────────
//
//  Called on a schedule (every ~30s). Finds every mission whose
//  start_time + duration has elapsed and is still in 'traveling'
//  status, resolves its outcome, and sets status='complete' with
//  reward_json filled in. The claim step is separate — players
//  must open their OPS panel and click CLAIM to actually receive
//  the rewards (keeps economy audit-clean).
//
async function tickMissions() {
  // Select a batch of elapsed traveling missions
  const due = await pool.query(
    `SELECT id FROM missions
     WHERE status = 'traveling'
       AND start_time + (duration_sec || ' seconds')::interval <= NOW()
     ORDER BY start_time ASC
     LIMIT 50`
  );
  if (!due.rows.length) return { resolved: 0 };

  let count = 0;
  for (const row of due.rows) {
    try {
      await resolveMission(row.id);
      count++;
    } catch (e) {
      console.warn(`[MISSION] resolve #${row.id} failed:`, e.message);
    }
  }
  if (count > 0) console.log(`[MISSION] tick resolved ${count} missions`);
  return { resolved: count };
}

/** Roll a reward object for a mission, given its type + tier. */
async function rollRewards(type, tier) {
  const prefix = type === 'invasion' ? 'mission_invade_reward' : 'mission_explore_reward';
  const [ppMin, ppMax] = await parseRange(`${prefix}_${tier}_pp`, '0.1,1.0');
  const [gpMin, gpMax] = await parseRange(`${prefix}_${tier}_gp`, '5,30');
  const [xpMin, xpMax] = await parseRange(`${prefix}_${tier}_xp`, '10,50');

  const pp = Math.round(randBetween(ppMin, ppMax) * 1000000) / 1000000;
  const gp = Math.round(randBetween(gpMin, gpMax));
  const xp = randIntBetween(Math.floor(xpMin), Math.floor(xpMax));

  // Item drop chance
  let item = null;
  const dropKey = type === 'invasion'
    ? `mission_invade_item_drop_${tier}`
    : `mission_explore_rare_drop_${tier}`;
  const dropPct = parseFloat(await getSetting(dropKey) || '5');
  if (Math.random() * 100 < dropPct) {
    try {
      const pool_ = require('../db').pool;
      const filter = type === 'invasion'
        ? "category IN ('combat','booster') AND active = true"
        : "category IN ('cosmetic','booster') AND active = true";
      const itRes = await pool_.query(
        `SELECT code, name, icon FROM item_types WHERE ${filter} ORDER BY RANDOM() LIMIT 1`
      );
      if (itRes.rows.length) {
        item = { code: itRes.rows[0].code, name: itRes.rows[0].name, icon: itRes.rows[0].icon, qty: 1 };
      }
    } catch (_e) { /* item_types table may not exist yet */ }
  }

  return { pp, gp, xp, item };
}

/** Compute invasion success rate using settings + target posture. */
async function invasionSuccessRate(attackerWallet, targetWallet) {
  const base     = parseFloat(await getSetting('mission_invade_base_success')    || '0.50');
  const minR     = parseFloat(await getSetting('mission_invade_min_success')     || '0.10');
  const maxR     = parseFloat(await getSetting('mission_invade_max_success')     || '0.90');
  const pixelBonusMax = parseFloat(await getSetting('mission_invade_pixel_ratio_bonus') || '0.20');
  const shieldMaxPen  = parseFloat(await getSetting('mission_invade_shield_penalty')    || '0.30');

  // Pixel ratio bonus — attacker bigger than defender = bonus
  const [atkR, defR] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1', [attackerWallet]),
    pool.query('SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1', [targetWallet])
  ]);
  const atkPx = atkR.rows[0]?.cnt || 0;
  const defPx = defR.rows[0]?.cnt || 1;
  const ratio = atkPx / Math.max(1, defPx);
  // clamp ratio contribution: >=3x → full bonus, <=1/3 → full penalty half
  const pxBonus = Math.max(-pixelBonusMax / 2, Math.min(pixelBonusMax, (Math.log(ratio) / Math.log(3)) * pixelBonusMax));

  // Shield penalty — if defender has active shield effect, reduce success
  let shieldPen = 0;
  try {
    const sh = await pool.query(
      `SELECT 1 FROM user_active_effects
       WHERE wallet = $1 AND effect_type = 'shield' AND active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [targetWallet]
    );
    if (sh.rows.length) shieldPen = shieldMaxPen;
  } catch (_e) { /* user_active_effects may not exist */ }

  return Math.max(minR, Math.min(maxR, base + pxBonus - shieldPen));
}

/** Resolve a single mission to complete/failed with rewards attached. */
async function resolveMission(missionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query(
      `SELECT * FROM missions WHERE id = $1 AND status = 'traveling' FOR UPDATE`,
      [missionId]
    );
    if (!mRes.rows.length) { await client.query('ROLLBACK'); return; }
    const m = mRes.rows[0];

    const tier = await distanceTier(parseFloat(m.distance_deg));

    if (m.type === 'exploration') {
      // Always succeeds — exploration pays on delivery
      const reward = await rollRewards('exploration', tier);
      await client.query(
        `UPDATE missions
           SET status = 'complete', success = true, reward_json = $1
         WHERE id = $2`,
        [JSON.stringify(reward), missionId]
      );
    } else {
      // Invasion — roll success
      const rate = await invasionSuccessRate(m.wallet, m.target_wallet);
      const won = Math.random() < rate;

      if (won) {
        // Roll base rewards
        const reward = await rollRewards('invasion', tier);

        // Steal pixels (mechanic: transfer N% of defender's pixels closest to target)
        const stealMin = parseInt(await getSetting('mission_invade_steal_pct_min') || '3');
        const stealMax = parseInt(await getSetting('mission_invade_steal_pct_max') || '8');
        const stealPct = randIntBetween(stealMin, stealMax);

        const defCountR = await client.query(
          'SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1',
          [m.target_wallet]
        );
        const defTotal = defCountR.rows[0]?.cnt || 0;
        const stealCount = Math.max(1, Math.floor(defTotal * stealPct / 100));

        // Resolve to stolen_pixels metadata only — actual transfer happens on claim
        reward.stolenPixels = stealCount;
        reward.stealPct = stealPct;

        await client.query(
          `UPDATE missions
             SET status = 'complete', success = true, reward_json = $1
           WHERE id = $2`,
          [JSON.stringify(reward), missionId]
        );
      } else {
        // Failed invasion — partial refund of launch cost
        const refundPct = parseInt(await getSetting('mission_invade_fail_refund_pct') || '30');
        const refund = Math.round(parseFloat(m.launch_cost_pp) * refundPct / 100 * 1000000) / 1000000;
        const failReward = { pp: refund, gp: 0, xp: 5, item: null, failed: true, refundPct };
        await client.query(
          `UPDATE missions
             SET status = 'failed', success = false, reward_json = $1
           WHERE id = $2`,
          [JSON.stringify(failReward), missionId]
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── CLAIM ────────────────────────────────────────────────────────
//
//  Credits rewards to the caller's account. For successful invasion,
//  additionally transfers pixels from defender to attacker (those
//  closest to the target coordinate).
//
async function claimMission(wallet, missionId) {
  if (!wallet || !missionId) return { error: 'Missing args' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query(
      `SELECT * FROM missions
       WHERE id = $1 AND wallet = $2
         AND status IN ('complete','failed')
         AND claimed_at IS NULL
       FOR UPDATE`,
      [missionId, wallet]
    );
    if (!mRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Mission not ready or already claimed' };
    }
    const m = mRes.rows[0];
    const reward = typeof m.reward_json === 'string' ? JSON.parse(m.reward_json) : (m.reward_json || {});

    // ── PP + GP credit
    if ((reward.pp || 0) > 0) {
      // PP rewards come from the quest reward pool where possible
      let ppPayout = parseFloat(reward.pp);
      try {
        const poolRes = await client.query('SELECT balance FROM quest_reward_pool WHERE id = 1');
        const poolBal = poolRes.rows[0] ? parseFloat(poolRes.rows[0].balance) : 0;
        const capped = Math.min(ppPayout, poolBal);
        if (capped > 0) {
          await client.query(
            `UPDATE quest_reward_pool
               SET balance = balance - $1,
                   total_paid = total_paid + $1,
                   today_paid = today_paid + $1,
                   updated_at = NOW()
             WHERE id = 1`,
            [capped]
          );
          ppPayout = capped;
        }
      } catch (_e) { /* pool missing, fall through and mint */ }
      if (ppPayout > 0) {
        await client.query(
          'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
          [ppPayout, wallet]
        );
        reward.pp = ppPayout;
      }
    }
    if ((reward.gp || 0) > 0) {
      await client.query(
        'UPDATE users SET gp_balance = COALESCE(gp_balance, 0) + $1 WHERE wallet_address = $2',
        [reward.gp, wallet]
      );
    }

    // ── Item credit
    if (reward.item && reward.item.code) {
      try {
        const itRes = await client.query(
          'SELECT id FROM item_types WHERE code = $1 AND active = true',
          [reward.item.code]
        );
        if (itRes.rows.length) {
          await client.query(
            `INSERT INTO user_items (wallet, item_type_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (wallet, item_type_id)
             DO UPDATE SET quantity = user_items.quantity + $3`,
            [wallet, itRes.rows[0].id, reward.item.qty || 1]
          );
        }
      } catch (_e) { /* item_types table missing */ }
    }

    // ── XP
    let rankUp = null;
    if ((reward.xp || 0) > 0) {
      try { rankUp = await awardXP(client, wallet, parseInt(reward.xp)); }
      catch (_e) { /* non-critical */ }
    }

    // ── Invasion: transfer stolen pixels on success
    if (m.type === 'invasion' && m.success && reward.stolenPixels > 0 && m.target_wallet) {
      // Pick N defender pixels closest to the mission target coord,
      // re-assign ownership, and spawn a new "captured" claim for the attacker.
      const defPixR = await client.query(
        'SELECT lat, lng, price FROM pixels WHERE owner = $1',
        [m.target_wallet]
      );
      const pixels = defPixR.rows.map(r => ({
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        price: parseFloat(r.price)
      }));
      // Sort by distance to the target point
      const tgtLat = parseFloat(m.target_lat), tgtLng = parseFloat(m.target_lng);
      pixels.sort((a, b) =>
        greatCircleDeg(a.lat, a.lng, tgtLat, tgtLng)
        - greatCircleDeg(b.lat, b.lng, tgtLat, tgtLng)
      );
      const take = pixels.slice(0, reward.stolenPixels);

      if (take.length) {
        // Create a new claim so the captured patch is grouped and discoverable
        let mnLat = Infinity, mxLat = -Infinity, mnLng = Infinity, mxLng = -Infinity;
        for (const p of take) {
          if (p.lat < mnLat) mnLat = p.lat;
          if (p.lat > mxLat) mxLat = p.lat;
          if (p.lng < mnLng) mnLng = p.lng;
          if (p.lng > mxLng) mxLng = p.lng;
        }
        const GRID_SIZE = 0.22;
        const cx = (mnLat + mxLat) / 2;
        const cy = (mnLng + mxLng) / 2;
        const w = Math.round((mxLng - mnLng) / GRID_SIZE) + 1;
        const h = Math.round((mxLat - mnLat) / GRID_SIZE) + 1;
        const totalPaid = take.reduce((s, p) => s + p.price, 0);

        const claimRes = await client.query(
          `INSERT INTO claims (owner, center_lat, center_lng, width, height, total_paid)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [wallet, cx, cy, w, h, totalPaid]
        );
        const claimId = claimRes.rows[0].id;

        // Reassign pixels in chunks
        const chunk = 400;
        for (let i = 0; i < take.length; i += chunk) {
          const slice = take.slice(i, i + chunk);
          const values = [];
          const params = [];
          let idx = 1;
          for (const p of slice) {
            values.push(`($${idx++}, $${idx++})`);
            params.push(p.lat, p.lng);
          }
          await client.query(
            `UPDATE pixels
                SET owner = $${idx}, claim_id = $${idx + 1}, updated_at = NOW()
              WHERE (lat, lng) IN (${values.join(',')})`,
            [...params, wallet, claimId]
          );
        }

        // Log transaction
        await client.query(
          `INSERT INTO transactions (type, from_wallet, pp_amount, fee, meta)
           VALUES ('hijack', $1, 0, 0, $2)`,
          [wallet, JSON.stringify({
            source: 'mission_invasion',
            missionId: m.id,
            victim: m.target_wallet,
            pixels: take.length,
            claimId
          })]
        );

        // Refresh guild pixel counts for both sides (best-effort)
        try {
          const guildSrv = require('./guild');
          const [atkG, defG] = await Promise.all([
            client.query('SELECT guild_id FROM users WHERE wallet_address = $1', [wallet]),
            client.query('SELECT guild_id FROM users WHERE wallet_address = $1', [m.target_wallet])
          ]);
          if (atkG.rows[0]?.guild_id) await guildSrv.refreshGuildPixelCount(atkG.rows[0].guild_id);
          if (defG.rows[0]?.guild_id) await guildSrv.refreshGuildPixelCount(defG.rows[0].guild_id);
        } catch (_e) { /* non-critical */ }

        reward.stolenPixelsActual = take.length;
      }
    }

    // ── Referral commission on PP paid out (missions count as earn events)
    if ((reward.pp || 0) > 0) {
      try {
        await creditReferralCommission(client, wallet, 'harvest', reward.pp, 'pp');
      } catch (_e) { /* non-critical */ }
    }

    // ── Mark claimed
    await client.query(
      `UPDATE missions
         SET status = 'claimed', claimed_at = NOW(), reward_json = $1
       WHERE id = $2`,
      [JSON.stringify(reward), missionId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      mission: {
        id: m.id,
        type: m.type,
        won: m.success === true,
        reward,
        rankUp
      }
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[MISSION] claim error:', e.message);
    return { error: e.message };
  } finally {
    client.release();
  }
}

// ── QUERY: active missions for a wallet ──────────────────────────
async function getActiveMissions(wallet) {
  if (!wallet) return [];
  const r = await pool.query(
    `SELECT id, type, origin_lat, origin_lng, target_lat, target_lng, target_wallet,
            distance_deg, duration_sec, launch_cost_pp, status, success,
            reward_json, start_time, claimed_at, created_at
     FROM missions
     WHERE wallet = $1
       AND status IN ('traveling','complete','failed')
     ORDER BY start_time DESC
     LIMIT 20`,
    [wallet]
  );
  return r.rows.map(m => {
    const start = new Date(m.start_time).getTime();
    const dur = parseInt(m.duration_sec) * 1000;
    const now = Date.now();
    const remaining = Math.max(0, start + dur - now);
    return {
      id: m.id,
      type: m.type,
      originLat: parseFloat(m.origin_lat),
      originLng: parseFloat(m.origin_lng),
      targetLat: parseFloat(m.target_lat),
      targetLng: parseFloat(m.target_lng),
      targetWallet: m.target_wallet,
      distanceDeg: parseFloat(m.distance_deg),
      durationSec: parseInt(m.duration_sec),
      launchCostPP: parseFloat(m.launch_cost_pp),
      status: m.status,
      success: m.success,
      reward: m.reward_json || {},
      startTime: m.start_time,
      remainingMs: remaining,
      readyToClaim: m.status === 'complete' || m.status === 'failed'
    };
  });
}

/** Cancel a traveling mission (partial refund). Admin/debug aid. */
async function cancelMission(wallet, missionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT * FROM missions WHERE id = $1 AND wallet = $2 AND status = 'traveling' FOR UPDATE`,
      [missionId, wallet]
    );
    if (!r.rows.length) { await client.query('ROLLBACK'); return { error: 'Mission not cancellable' }; }
    const m = r.rows[0];
    const refundPct = parseInt(await getSetting('mission_invade_fail_refund_pct') || '30');
    const refund = Math.round(parseFloat(m.launch_cost_pp) * refundPct / 100 * 1000000) / 1000000;
    if (refund > 0) {
      await client.query(
        'UPDATE users SET pp_balance = pp_balance + $1 WHERE wallet_address = $2',
        [refund, wallet]
      );
    }
    await client.query(
      `UPDATE missions SET status = 'cancelled', claimed_at = NOW() WHERE id = $1`,
      [missionId]
    );
    await client.query('COMMIT');
    return { success: true, refund };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

module.exports = {
  launchMission,
  tickMissions,
  resolveMission,
  claimMission,
  getActiveMissions,
  cancelMission,
  // expose helpers for tests/admin
  greatCircleDeg,
  distanceTier,
  slotCapForWallet
};

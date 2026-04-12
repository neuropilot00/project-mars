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

/** Find the player's closest-to-target owned pixel (legacy fallback). */
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

/**
 * Resolve a launch pad (claim) for a player. Returns the claim's centroid +
 * great-circle distance to the target. Enforces ownership.
 */
async function resolveLaunchPad(wallet, originClaimId, targetLat, targetLng) {
  const r = await pool.query(
    `SELECT id, owner, center_lat AS lat, center_lng AS lng
       FROM claims
      WHERE id = $1 AND deleted_at IS NULL`,
    [originClaimId]
  );
  if (!r.rows.length) return { error: 'Launch pad not found' };
  if ((r.rows[0].owner || '').toLowerCase() !== (wallet || '').toLowerCase()) {
    return { error: 'You do not own that launch pad' };
  }
  const lat = parseFloat(r.rows[0].lat);
  const lng = parseFloat(r.rows[0].lng);
  const distance = greatCircleDeg(lat, lng, targetLat, targetLng);
  return { claimId: r.rows[0].id, lat, lng, distance };
}

// ── Adjacency / merged-territory helpers ────────────────────────
//
//  The map merges touching claims into a single visible "territory".
//  Launch pads must do the same — otherwise a player with one big
//  merged territory split into 5 internal claims would see 5 separate
//  pads. We run union-find on each wallet's claims and treat each
//  connected group as one pad.
//
const PAD_GRID = 0.22; // matches GRID_SIZE on server/routes/api.js

/** Union-find groups of touching claim rows from a single wallet. */
function _groupAdjacentClaims(rows) {
  const n = rows.length;
  const parent = rows.map((_, i) => i);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
  // Adjacency: bounding boxes overlap or touch within 1 grid cell
  for (let i = 0; i < n; i++) {
    const a = rows[i];
    const aw = (a.width || 1) * PAD_GRID / 2;
    const ah = (a.height || 1) * PAD_GRID / 2;
    for (let j = i + 1; j < n; j++) {
      const b = rows[j];
      const bw = (b.width || 1) * PAD_GRID / 2;
      const bh = (b.height || 1) * PAD_GRID / 2;
      const margin = PAD_GRID * 1.1;
      if (Math.abs(a.lat - b.lat) < ah + bh + margin &&
          Math.abs(a.lng - b.lng) < aw + bw + margin) {
        union(i, j);
      }
    }
  }
  const buckets = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!buckets[root]) buckets[root] = [];
    buckets[root].push(i);
  }
  return Object.values(buckets); // Array<Array<index>>
}

/** Resolve all claim IDs in the merged group containing repClaimId. */
async function resolveClaimGroup(wallet, repClaimId) {
  const rows = await _fetchOwnerClaims(wallet);
  if (!rows.length) return null;
  const groups = _groupAdjacentClaims(rows);
  for (const idxs of groups) {
    if (idxs.some(i => rows[i].id === parseInt(repClaimId))) {
      return idxs.map(i => rows[i]);
    }
  }
  return null;
}

async function _fetchOwnerClaims(wallet) {
  const r = await pool.query(
    `SELECT id, center_lat AS lat, center_lng AS lng, width, height
       FROM claims
      WHERE owner = $1 AND deleted_at IS NULL
      ORDER BY id ASC`,
    [wallet]
  );
  return r.rows.map(row => ({
    id: row.id,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    width: row.width,
    height: row.height
  }));
}

/** List the player's MERGED launch pads (one entry per connected territory). */
async function listLaunchPads(wallet) {
  if (!wallet) return [];
  const rows = await _fetchOwnerClaims(wallet);
  if (!rows.length) return [];

  // Pixel counts per claim
  const ids = rows.map(r => r.id);
  const pxRes = await pool.query(
    'SELECT claim_id, COUNT(*)::int AS cnt FROM pixels WHERE claim_id = ANY($1::int[]) GROUP BY claim_id',
    [ids]
  );
  const pxMap = {};
  pxRes.rows.forEach(r => { pxMap[r.claim_id] = r.cnt; });

  // Active missions per claim (most recent unresolved per claim)
  const mRes = await pool.query(
    `SELECT origin_claim_id, id, type, start_time, duration_sec,
            target_lat, target_lng, target_wallet, status
       FROM missions
      WHERE origin_claim_id = ANY($1::int[])
        AND status IN ('traveling','complete')
      ORDER BY start_time DESC`,
    [ids]
  );
  const activeByClaim = {};
  mRes.rows.forEach(m => {
    if (!activeByClaim[m.origin_claim_id]) {
      activeByClaim[m.origin_claim_id] = {
        id: m.id,
        type: m.type,
        startTime: m.start_time,
        durationSec: m.duration_sec,
        targetLat: m.target_lat,
        targetLng: m.target_lng,
        targetWallet: m.target_wallet,
        status: m.status
      };
    }
  });

  const groups = _groupAdjacentClaims(rows);
  return groups.map(idxs => {
    const memberRows = idxs.map(i => rows[i]);
    // Sum pixels, find centroid (weighted by pixel count), pick rep = largest claim
    let totalPx = 0, latSum = 0, lngSum = 0;
    let rep = memberRows[0];
    let repPx = pxMap[rep.id] || 0;
    let activeMission = null;
    for (const m of memberRows) {
      const px = pxMap[m.id] || 0;
      totalPx += px;
      latSum += m.lat * Math.max(1, px);
      lngSum += m.lng * Math.max(1, px);
      if (px > repPx) { rep = m; repPx = px; }
      if (!activeMission && activeByClaim[m.id]) activeMission = activeByClaim[m.id];
    }
    const wsum = Math.max(1, totalPx);
    return {
      id: rep.id,                   // representative claim id (used as originClaimId)
      memberIds: memberRows.map(m => m.id),
      lat: latSum / wsum,
      lng: lngSum / wsum,
      pixelCount: totalPx,
      claimCount: memberRows.length,
      activeMission
    };
  }).sort((a, b) => b.pixelCount - a.pixelCount);
}

/**
 * Reward multiplier for a launch pad — sums pixels across the merged
 * territory the rep claim belongs to, so a player who actually owns
 * a big contiguous block gets the bonus.
 */
async function padRewardMultiplier(repClaimId, wallet) {
  const baseline = parseFloat(await getSetting('mission_pad_baseline_pixels') || '25');
  const min = parseFloat(await getSetting('mission_pad_mult_min') || '0.5');
  const max = parseFloat(await getSetting('mission_pad_mult_max') || '3.0');

  let totalPx = 0;
  if (wallet) {
    const group = await resolveClaimGroup(wallet, repClaimId);
    if (group && group.length) {
      const ids = group.map(c => c.id);
      const r = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM pixels WHERE claim_id = ANY($1::int[])',
        [ids]
      );
      totalPx = r.rows[0]?.cnt || 0;
    }
  }
  if (totalPx <= 0) {
    // Fallback to single-claim count when wallet/group lookup fails
    const r = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM pixels WHERE claim_id = $1',
      [repClaimId]
    );
    totalPx = r.rows[0]?.cnt || 0;
  }
  if (totalPx <= 0) return min;
  const raw = Math.sqrt(totalPx / Math.max(1, baseline));
  return Math.max(min, Math.min(max, Math.round(raw * 1000) / 1000));
}

/**
 * Defender size factor for invasion — bigger target = bigger reward
 * (and longer travel time). Uses the same baseline / clamp settings
 * as the pad multiplier so the curve feels symmetric.
 */
async function defenderSizeFactor(targetWallet) {
  if (!targetWallet) return 1.0;
  const baseline = parseFloat(await getSetting('mission_pad_baseline_pixels') || '25');
  const min = parseFloat(await getSetting('mission_pad_mult_min') || '0.5');
  const max = parseFloat(await getSetting('mission_pad_mult_max') || '3.0');
  const r = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1',
    [targetWallet.toLowerCase()]
  );
  const cnt = r.rows[0]?.cnt || 0;
  if (cnt <= 0) return min;
  const raw = Math.sqrt(cnt / Math.max(1, baseline));
  return Math.max(min, Math.min(max, Math.round(raw * 1000) / 1000));
}

/**
 * Combine attacker pad + defender territory size factors into a
 * single invasion multiplier (geometric mean keeps small + small
 * small, big + big big, mismatched in the middle).
 */
function combineInvasionFactors(padMult, defFactor) {
  return Math.round(Math.sqrt(padMult * defFactor) * 1000) / 1000;
}

// ── PREVIEW (no DB writes) ──────────────────────────────────────
//
//  Returns { distanceDeg, tier, durationSec, costPP, multiplier }
//  for the chosen LAUNCH PAD + target. The pad's centroid is the
//  origin; multiplier scales with the pad's pixel count.
//
async function previewMission(wallet, type, originClaimId, targetLat, targetLng, targetWallet) {
  if (!wallet) return { error: 'Wallet required' };
  if (type !== 'invasion' && type !== 'exploration') return { error: 'Invalid mission type' };
  if (!originClaimId) return { error: 'Pick a launch pad first' };
  const lat = parseFloat(targetLat), lng = parseFloat(targetLng);
  if (!isFinite(lat) || !isFinite(lng)) return { error: 'Invalid coordinates' };

  const pad = await resolveLaunchPad(wallet, parseInt(originClaimId), lat, lng);
  if (pad.error) return pad;

  const tier = await distanceTier(pad.distance);
  const durKey = type === 'invasion'
    ? `mission_invade_${tier}_sec`
    : `mission_explore_${tier}_sec`;
  const durFallback = tier === 'near' ? '1800' : tier === 'mid' ? '5400' : '14400';
  let durationSec = parseInt(await getSetting(durKey) || durFallback);

  const costKey = type === 'invasion'
    ? `mission_invade_cost_${tier}`
    : `mission_explore_cost_${tier}`;
  const costFallback = type === 'invasion'
    ? (tier === 'near' ? '0.5' : tier === 'mid' ? '1.5' : '3.0')
    : (tier === 'near' ? '0.2' : tier === 'mid' ? '0.8' : '2.0');
  const costPP = parseFloat(await getSetting(costKey) || costFallback);

  const padMult = await padRewardMultiplier(pad.claimId, wallet);
  let multiplier = padMult;
  let defFactor = null;
  if (type === 'invasion' && targetWallet) {
    defFactor = await defenderSizeFactor(targetWallet);
    multiplier = combineInvasionFactors(padMult, defFactor);
    // Bigger combined size = longer travel/op time
    durationSec = Math.max(60, Math.round(durationSec * multiplier));
  }

  return {
    success: true,
    distanceDeg: pad.distance,
    tier,
    durationSec,
    costPP,
    multiplier,
    padMultiplier: padMult,
    defenderFactor: defFactor,
    originLat: pad.lat,
    originLng: pad.lng,
    originClaimId: pad.claimId
  };
}

// ── LAUNCH ───────────────────────────────────────────────────────
//
//  Each mission MUST originate from a specific launch pad (claim).
//  A pad can host only one active mission at a time → max concurrent
//  missions for a player = number of free pads they own. Larger pads
//  earn a bigger reward multiplier.
//
async function launchMission(wallet, type, originClaimId, targetLat, targetLng, targetWallet) {
  if (!wallet) return { error: 'Wallet required' };
  if (type !== 'invasion' && type !== 'exploration') return { error: 'Invalid mission type' };
  if (type === 'invasion' && !targetWallet) return { error: 'Target wallet required for invasion' };
  if (!originClaimId) return { error: 'Pick a launch pad first' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUser(client, wallet);

    // ── Daily cap (still useful as anti-spam)
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

    // ── Resolve & lock the launch pad
    const padRes = await client.query(
      `SELECT id, owner, center_lat AS lat, center_lng AS lng
         FROM claims
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE`,
      [parseInt(originClaimId)]
    );
    if (!padRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Launch pad not found' };
    }
    if ((padRes.rows[0].owner || '').toLowerCase() !== wallet.toLowerCase()) {
      await client.query('ROLLBACK');
      return { error: 'You do not own that launch pad' };
    }
    const padLat = parseFloat(padRes.rows[0].lat);
    const padLng = parseFloat(padRes.rows[0].lng);
    const padId  = padRes.rows[0].id;

    // ── Pad-busy check spans the entire merged territory the pad belongs to.
    //    Otherwise a player with one big merged territory split across many
    //    internal claims could launch a mission from each one separately.
    const group = await resolveClaimGroup(wallet, padId);
    const groupIds = group && group.length ? group.map(c => c.id) : [padId];
    const busy = await client.query(
      `SELECT 1 FROM missions
        WHERE origin_claim_id = ANY($1::int[]) AND status IN ('traveling','complete')
        LIMIT 1`,
      [groupIds]
    );
    if (busy.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'This territory already has an active mission' };
    }

    // ── Invasion-specific validation
    if (type === 'invasion') {
      // Resolve target: accept either a wallet (0x…) or a nickname.
      // Without this, typing a nickname into the launcher would fail with
      // "Target has no territory" even when the player owns plenty of land.
      const rawTarget = String(targetWallet || '').trim();
      let resolvedTarget = rawTarget.toLowerCase();
      const looksLikeWallet = /^0x[0-9a-f]{40}$/i.test(rawTarget);
      if (!looksLikeWallet) {
        // Try exact match first, then partial match
        let nickRes = await client.query(
          'SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1) LIMIT 1',
          [rawTarget]
        );
        if (!nickRes.rows.length) {
          nickRes = await client.query(
            'SELECT wallet_address FROM users WHERE LOWER(nickname) LIKE LOWER($1) LIMIT 1',
            ['%' + rawTarget + '%']
          );
        }
        if (!nickRes.rows.length) {
          await client.query('ROLLBACK');
          return { error: `No player named "${rawTarget}"` };
        }
        resolvedTarget = nickRes.rows[0].wallet_address.toLowerCase();
      }
      targetWallet = resolvedTarget;

      if (targetWallet === wallet.toLowerCase()) {
        await client.query('ROLLBACK');
        return { error: "Can't invade yourself" };
      }

      // Block invading guild-mates so guild members don't grief each other.
      try {
        const gm = await client.query(
          `SELECT a.guild_id AS me_guild, b.guild_id AS them_guild
             FROM users a, users b
            WHERE a.wallet_address = $1 AND b.wallet_address = $2`,
          [wallet.toLowerCase(), targetWallet]
        );
        if (gm.rows.length) {
          const me = gm.rows[0].me_guild;
          const them = gm.rows[0].them_guild;
          if (me && them && me === them) {
            await client.query('ROLLBACK');
            return { error: 'Target is in your guild' };
          }
        }
      } catch (_ge) { /* guild table missing → skip check */ }

      const tgtOwned = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM pixels WHERE owner = $1',
        [targetWallet]
      );
      if ((tgtOwned.rows[0]?.cnt || 0) === 0) {
        await client.query('ROLLBACK');
        return { error: 'Target has no territory' };
      }
    }

    // ── De-duplicate: if an active mission already targets the same area,
    //    auto-redirect to a different part of the target's territory (invasion)
    //    or offset the coordinates (exploration).
    const DEDUP_RADIUS_DEG = 5; // missions within 5° are considered overlapping
    const existingMissions = await client.query(
      `SELECT target_lat, target_lng FROM missions
       WHERE wallet = $1 AND status IN ('traveling','complete')
         AND type = $2`,
      [wallet, type]
    );
    const occupied = existingMissions.rows.map(r => ({
      lat: parseFloat(r.target_lat), lng: parseFloat(r.target_lng)
    }));

    function _isOverlapping(lat, lng) {
      return occupied.some(o => greatCircleDeg(o.lat, o.lng, lat, lng) < DEDUP_RADIUS_DEG);
    }

    let finalTargetLat = parseFloat(targetLat);
    let finalTargetLng = parseFloat(targetLng);

    if (_isOverlapping(finalTargetLat, finalTargetLng)) {
      let redirected = false;

      if (type === 'invasion' && targetWallet) {
        // Pick a different claim from the target that isn't near existing attacks
        const altClaims = await client.query(
          `SELECT DISTINCT center_lat AS lat, center_lng AS lng
             FROM claims
            WHERE owner = $1 AND deleted_at IS NULL
            ORDER BY RANDOM()`,
          [targetWallet]
        );
        for (const alt of altClaims.rows) {
          const aLat = parseFloat(alt.lat), aLng = parseFloat(alt.lng);
          if (!_isOverlapping(aLat, aLng)) {
            finalTargetLat = aLat;
            finalTargetLng = aLng;
            redirected = true;
            break;
          }
        }
      }

      if (!redirected && type === 'exploration') {
        // Offset in a random direction until no overlap (up to 8 attempts)
        for (let attempt = 1; attempt <= 8; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const offset = DEDUP_RADIUS_DEG * attempt;
          const tryLat = Math.max(-85, Math.min(85, finalTargetLat + Math.sin(angle) * offset));
          const tryLng = ((finalTargetLng + Math.cos(angle) * offset) + 540) % 360 - 180;
          if (!_isOverlapping(tryLat, tryLng)) {
            finalTargetLat = tryLat;
            finalTargetLng = tryLng;
            redirected = true;
            break;
          }
        }
      }

      if (!redirected && type === 'invasion') {
        // All of the target's claims are already under attack
        await client.query('ROLLBACK');
        return { error: 'All of this target\'s territories are already under attack' };
      }
    }

    targetLat = finalTargetLat;
    targetLng = finalTargetLng;

    const distance = greatCircleDeg(padLat, padLng, parseFloat(targetLat), parseFloat(targetLng));
    const tier = await distanceTier(distance);

    // ── Duration (seconds) — invasion stretches with the combined size factor below
    const durKey = type === 'invasion'
      ? `mission_invade_${tier}_sec`
      : `mission_explore_${tier}_sec`;
    const durFallback = tier === 'near' ? '1800' : tier === 'mid' ? '5400' : '14400';
    let durationSec = parseInt(await getSetting(durKey) || durFallback);

    // ── Launch cost
    const costKey = type === 'invasion'
      ? `mission_invade_cost_${tier}`
      : `mission_explore_cost_${tier}`;
    const costFallback = type === 'invasion'
      ? (tier === 'near' ? '0.5' : tier === 'mid' ? '1.5' : '3.0')
      : (tier === 'near' ? '0.2' : tier === 'mid' ? '0.8' : '2.0');
    const costPP = parseFloat(await getSetting(costKey) || costFallback);

    // ── Reward multiplier (frozen at launch time)
    //    Exploration: pad-only.
    //    Invasion: combine attacker pad size + defender territory size.
    //              Larger combined size also stretches mission duration.
    const padMult = await padRewardMultiplier(padId, wallet);
    let multiplier = padMult;
    if (type === 'invasion') {
      const defFactor = await defenderSizeFactor(targetWallet);
      multiplier = combineInvasionFactors(padMult, defFactor);
      durationSec = Math.max(60, Math.round(durationSec * multiplier));
    }

    // ── Guild research: rapid_deploy (speed) + logistics (cost reduction) ──
    try {
      const guildService = require('./guild');
      const rb = await guildService.getResearchBonuses(wallet);
      if (rb.speed > 0) {
        durationSec = Math.max(60, Math.round(durationSec * (1 - rb.speed / 100)));
      }
    } catch (_grb) { /* guild service unavailable */ }

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
         (wallet, type, origin_claim_id, origin_lat, origin_lng,
          target_lat, target_lng, target_wallet,
          distance_deg, duration_sec, launch_cost_pp, reward_multiplier, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'traveling')
       RETURNING id, start_time`,
      [
        wallet, type, padId,
        padLat, padLng,
        targetLat, targetLng,
        type === 'invasion' ? targetWallet.toLowerCase() : null,
        distance, durationSec, costPP, multiplier
      ]
    );
    const mission = ins.rows[0];

    await client.query('COMMIT');

    console.log(
      `[MISSION] ${type.toUpperCase()} #${mission.id} ${wallet.slice(0, 8)}`
      + ` pad=${padId} tier=${tier} dist=${distance.toFixed(1)}° dur=${durationSec}s`
      + ` cost=${costPP}PP mult=${multiplier}x`
    );

    return {
      success: true,
      mission: {
        id: mission.id,
        type,
        tier,
        originClaimId: padId,
        originLat: padLat,
        originLng: padLng,
        targetLat, targetLng,
        targetWallet: type === 'invasion' ? targetWallet.toLowerCase() : null,
        distanceDeg: distance,
        durationSec,
        launchCostPP: costPP,
        rewardMultiplier: multiplier,
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
  // Reward profile by type:
  //   invasion    → PP + GP + XP  (no items — combat is paid in currency)
  //   exploration → PP + XP + item (no GP — discovery is paid in loot)
  const prefix = type === 'invasion' ? 'mission_invade_reward' : 'mission_explore_reward';
  const [ppMin, ppMax] = await parseRange(`${prefix}_${tier}_pp`, '0.1,1.0');
  const [xpMin, xpMax] = await parseRange(`${prefix}_${tier}_xp`, '10,50');

  const pp = Math.round(randBetween(ppMin, ppMax) * 1000000) / 1000000;
  const xp = randIntBetween(Math.floor(xpMin), Math.floor(xpMax));

  let gp = 0;
  if (type === 'invasion') {
    const [gpMin, gpMax] = await parseRange(`${prefix}_${tier}_gp`, '5,30');
    gp = Math.round(randBetween(gpMin, gpMax));
  }

  // Item drop — exploration only
  let item = null;
  if (type === 'exploration') {
    const dropPct = parseFloat(await getSetting(`mission_explore_rare_drop_${tier}`) || '5');
    if (Math.random() * 100 < dropPct) {
      try {
        const pool_ = require('../db').pool;
        const itRes = await pool_.query(
          `SELECT code, name, icon FROM item_types
           WHERE category IN ('cosmetic','booster') AND active = true
           ORDER BY RANDOM() LIMIT 1`
        );
        if (itRes.rows.length) {
          item = { code: itRes.rows[0].code, name: itRes.rows[0].name, icon: itRes.rows[0].icon, qty: 1 };
        }
      } catch (_e) { /* item_types table may not exist yet */ }
    }
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

  // ── Guild research bonuses ──
  let guildDefBonus = 0;
  try {
    const guildService = require('./guild');
    // Defender's shield_disc research → harder to invade
    const defBonuses = await guildService.getResearchBonuses(targetWallet);
    if (defBonuses.defense > 0) guildDefBonus += defBonuses.defense / 100;
    // Defender's diplomatic research → also reduces invasion success
    if (defBonuses.diplomatic > 0) guildDefBonus += defBonuses.diplomatic / 100;
  } catch (_ge) { /* guild service unavailable */ }

  return Math.max(minR, Math.min(maxR, base + pxBonus - shieldPen - guildDefBonus));
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
    const sizeFactor = parseFloat(m.reward_multiplier || 1);
    function applyMult(reward) {
      if (!reward) return reward;
      if (reward.pp) reward.pp = Math.round(reward.pp * sizeFactor * 1000000) / 1000000;
      if (reward.gp) reward.gp = Math.round(reward.gp * sizeFactor);
      if (reward.xp) reward.xp = Math.floor(reward.xp * sizeFactor);
      reward.sizeFactor = sizeFactor;
      return reward;
    }

    // Threshold below which a mission only pays out ONE of its reward
    // channels (random pick). Keeps small ops from feeling like jackpots.
    const gateThreshold = parseFloat(
      await getSetting('mission_full_reward_size_threshold') || '1.0'
    );
    function gateRewardChannels(reward, allowedKeys, factor) {
      if (!reward || factor >= gateThreshold) return reward;
      // Pick which channel survives, weighted equally
      const present = allowedKeys.filter(k => {
        if (k === 'item') return reward.item != null;
        return (reward[k] || 0) > 0;
      });
      const pool = present.length ? present : allowedKeys;
      const keep = pool[Math.floor(Math.random() * pool.length)];
      for (const k of allowedKeys) {
        if (k === keep) continue;
        if (k === 'item') reward.item = null;
        else reward[k] = 0;
      }
      reward.gatedChannel = keep;
      return reward;
    }

    if (m.type === 'exploration') {
      // Roll an outcome tier — empty / partial / full / jackpot
      const emptyPct   = parseFloat(await getSetting('mission_explore_outcome_empty_pct')   || '25');
      const partialPct = parseFloat(await getSetting('mission_explore_outcome_partial_pct') || '40');
      const jackpotPct = parseFloat(await getSetting('mission_explore_outcome_jackpot_pct') || '10');
      const roll = Math.random() * 100;
      let outcome;
      if (roll < emptyPct) outcome = 'empty';
      else if (roll < emptyPct + partialPct) outcome = 'partial';
      else if (roll < emptyPct + partialPct + (100 - emptyPct - partialPct - jackpotPct)) outcome = 'full';
      else outcome = 'jackpot';

      let reward;
      if (outcome === 'empty') {
        // Scan signal lost — only a tiny XP scrap, nothing else
        reward = { pp: 0, gp: 0, xp: randIntBetween(3, 8), item: null, outcome: 'empty' };
      } else {
        reward = await rollRewards('exploration', tier);
        if (outcome === 'partial') {
          // 60% range, no item
          reward.pp = Math.round(reward.pp * 0.6 * 1000000) / 1000000;
          reward.gp = Math.round(reward.gp * 0.6);
          reward.xp = Math.floor(reward.xp * 0.6);
          reward.item = null;
          reward.outcome = 'partial';
        } else if (outcome === 'jackpot') {
          // 1.6x range + guaranteed item (re-roll if rollRewards didn't give one)
          reward.pp = Math.round(reward.pp * 1.6 * 1000000) / 1000000;
          reward.gp = Math.round(reward.gp * 1.6);
          reward.xp = Math.floor(reward.xp * 1.6);
          if (!reward.item) {
            try {
              const itRes = await pool.query(
                `SELECT code, name, icon FROM item_types
                 WHERE category IN ('cosmetic','booster') AND active = true
                 ORDER BY RANDOM() LIMIT 1`
              );
              if (itRes.rows.length) {
                reward.item = { code: itRes.rows[0].code, name: itRes.rows[0].name, icon: itRes.rows[0].icon, qty: 1 };
              }
            } catch (_e) { /* item_types missing */ }
          }
          reward.outcome = 'jackpot';
        } else {
          reward.outcome = 'full';
        }
      }
      applyMult(reward);
      // Guild research: orbital_scan → exploration reward bonus
      try {
        const guildService = require('./guild');
        const rb = await guildService.getResearchBonuses(m.wallet);
        if (rb.exploration > 0 && reward) {
          const expBonus = 1 + rb.exploration / 100;
          if (reward.pp) reward.pp = Math.round(reward.pp * expBonus * 1000000) / 1000000;
          if (reward.xp) reward.xp = Math.floor(reward.xp * expBonus);
        }
      } catch (_grb) { /* guild research unavailable */ }
      // Exploration channels: PP / XP / item. NEAR distance collapses
      // to a single channel; MID/FAR keep all.
      const exploreFactor = tier === 'near' ? 0.5 : tier === 'mid' ? 1.0 : 2.0;
      if (reward && !reward.failed && reward.outcome !== 'empty') {
        gateRewardChannels(reward, ['pp', 'xp', 'item'], exploreFactor);
      }
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
        // Roll base rewards (scaled by combined size factor)
        // Invasion never takes pixels — territory = money. Reward is PP/GP/XP.
        const reward = applyMult(await rollRewards('invasion', tier));
        // Invasion channels: PP / GP / XP. Small ops collapse to one.
        gateRewardChannels(reward, ['pp', 'gp', 'xp'], sizeFactor);

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

    // ── Post-resolve hooks (non-blocking) ──
    try {
      const seasonService = require('./season');
      const guildService = require('./guild');
      if (m.type === 'exploration') {
        if (seasonService.addPassXP) seasonService.addPassXP(m.wallet, 'exploration').catch(() => {});
      } else if (m.type === 'invasion') {
        if (seasonService.addPassXP) seasonService.addPassXP(m.wallet, 'invasion').catch(() => {});
        // Guild war: invasion points
        const warPts = parseInt(await getSetting('guild_war_hijack_points') || '10');
        if (guildService.recordWarAction) {
          guildService.recordWarAction(m.wallet, 'invasion', warPts, { target: m.target_wallet }).catch(() => {});
        }
      }
    } catch (_hook) { /* non-critical */ }

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── CLAIM ────────────────────────────────────────────────────────
//
//  Credits rewards (PP/GP/XP/items) to the caller's account.
//  Invasion never transfers territory — territory is money and stays
//  with the defender. Invasion is paid in PP/GP/XP only.
//
async function claimMission(wallet, missionId, minigameScore) {
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

    // ── Minigame bonus: score → reward multiplier ──
    // Score thresholds: 0→1x, 100→1.15x, 300→1.3x, 500→1.5x, 1000→1.8x, 2000+→2x
    if (minigameScore && minigameScore > 0 && !reward.failed) {
      let bonus = 1.0;
      if (minigameScore >= 2000) bonus = 2.0;
      else if (minigameScore >= 1000) bonus = 1.8;
      else if (minigameScore >= 500) bonus = 1.5;
      else if (minigameScore >= 300) bonus = 1.3;
      else if (minigameScore >= 100) bonus = 1.15;
      if (bonus > 1.0) {
        if (reward.pp) reward.pp = Math.round(reward.pp * bonus * 1000000) / 1000000;
        if (reward.gp) reward.gp = Math.round(reward.gp * bonus);
        if (reward.xp) reward.xp = Math.floor(reward.xp * bonus);
        reward.minigameBonus = bonus;
        reward.minigameScore = minigameScore;
      }
    }

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
    `SELECT id, type, origin_claim_id, origin_lat, origin_lng,
            target_lat, target_lng, target_wallet,
            distance_deg, duration_sec, launch_cost_pp, reward_multiplier,
            status, success, reward_json, start_time, claimed_at, created_at
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
      originClaimId: m.origin_claim_id,
      originLat: parseFloat(m.origin_lat),
      originLng: parseFloat(m.origin_lng),
      targetLat: parseFloat(m.target_lat),
      targetLng: parseFloat(m.target_lng),
      targetWallet: m.target_wallet,
      distanceDeg: parseFloat(m.distance_deg),
      durationSec: parseInt(m.duration_sec),
      launchCostPP: parseFloat(m.launch_cost_pp),
      rewardMultiplier: parseFloat(m.reward_multiplier || 1),
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
  previewMission,
  tickMissions,
  resolveMission,
  claimMission,
  getActiveMissions,
  listLaunchPads,
  cancelMission,
  // expose helpers for tests/admin/other services
  greatCircleDeg,
  distanceTier,
  slotCapForWallet,
  padRewardMultiplier,
  resolveClaimGroup
};

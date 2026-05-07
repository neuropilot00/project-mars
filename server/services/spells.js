'use strict';
/**
 * Territory Spell Service — Migration 124
 * Players spend GP to cast temporary spells on territories.
 * Hexes: flood, blaze, storm, shield_break  (target others)
 * Boons: bless, goldmine                    (target own territory)
 */
const { pool, getSetting, logGPActivity } = require('../db');

let seasonService, weeklySvc, notifyPlayer;
try { seasonService  = require('./season'); }            catch (_) {}
try { weeklySvc      = require('./weeklyChallenges'); }  catch (_) {}
try { notifyPlayer   = require('../db').notifyPlayer; }  catch (_) {}

const SPELLS = {
  flood:        { icon: '🌊', label: 'Flood Hex',        type: 'hex',  costKey: 'spell_flood_gp',        desc: 'Slows mining rate (-30% for duration)' },
  blaze:        { icon: '🔥', label: 'Blaze Hex',        type: 'hex',  costKey: 'spell_blaze_gp',        desc: 'Weakens territory defenses (-20% for duration)' },
  storm:        { icon: '🌪️', label: 'Storm Hex',        type: 'hex',  costKey: 'spell_storm_gp',        desc: 'Disrupts territory activity (random effects)' },
  shield_break: { icon: '💥', label: 'Shield Break',     type: 'hex',  costKey: 'spell_shield_break_gp', desc: 'Reduces active shield effectiveness (-50%)' },
  bless:        { icon: '✨', label: 'Bless',             type: 'boon', costKey: 'spell_bless_gp',        desc: 'Boosts mining rate (+20% for duration)' },
  goldmine:     { icon: '💰', label: 'Gold Mine',         type: 'boon', costKey: 'spell_goldmine_gp',     desc: 'Increases GP reward chances for duration' },
};

async function getCfg() {
  const keys = ['spell_enabled','spell_flood_gp','spell_blaze_gp','spell_bless_gp','spell_storm_gp',
                 'spell_shield_break_gp','spell_goldmine_gp','spell_duration_h','spell_max_per_target',
                 'spell_self_cast_allowed','spell_own_territory_hex'];
  const res = await pool.query('SELECT key, value FROM game_settings WHERE key = ANY($1)', [keys]);
  const m = {};
  res.rows.forEach(r => { m[r.key] = r.value; });
  return {
    enabled:         (m.spell_enabled || 'true') === 'true',
    durationH:       parseInt(m.spell_duration_h || '2', 10),
    maxPerTarget:    parseInt(m.spell_max_per_target || '1', 10),
    selfCastAllowed: (m.spell_self_cast_allowed || 'true') === 'true',
    ownHexAllowed:   (m.spell_own_territory_hex || 'false') === 'true',
    costs: {
      flood:        parseInt(m.spell_flood_gp        || '50',  10),
      blaze:        parseInt(m.spell_blaze_gp        || '75',  10),
      bless:        parseInt(m.spell_bless_gp        || '30',  10),
      storm:        parseInt(m.spell_storm_gp        || '100', 10),
      shield_break: parseInt(m.spell_shield_break_gp || '120', 10),
      goldmine:     parseInt(m.spell_goldmine_gp     || '60',  10),
    },
  };
}

function getSpellInfo() {
  return Object.entries(SPELLS).map(([key, s]) => ({ key, ...s }));
}

async function castSpell(wallet, claimId, spellType) {
  const spell = SPELLS[spellType];
  if (!spell) throw new Error(`Unknown spell: ${spellType}`);
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Spell system is disabled');
  wallet   = wallet.toLowerCase();
  claimId  = parseInt(claimId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify target exists
    const claim = await client.query('SELECT owner FROM claims WHERE id=$1', [claimId]);
    if (!claim.rows.length) throw new Error('Territory not found');
    const ownerWallet = claim.rows[0].owner.toLowerCase();
    const isOwn = ownerWallet === wallet;

    // Check self-cast rules
    if (spell.type === 'hex' && isOwn && !cfg.ownHexAllowed) {
      throw new Error('Cannot cast hex spells on your own territory');
    }
    if (spell.type === 'boon' && !isOwn && !cfg.selfCastAllowed) {
      throw new Error('Boon spells can only be cast on your own territory');
    }

    // Check if same spell type already active on this target from this caster
    const active = await client.query(
      "SELECT id FROM territory_spells WHERE target_claim_id=$1 AND LOWER(caster_wallet)=LOWER($2) AND spell_type=$3 AND is_active=true AND expires_at>NOW()",
      [claimId, wallet, spellType]
    );
    if (active.rows.length) throw new Error(`You already have an active ${SPELLS[spellType].label} on this territory`);

    const gpCost = cfg.costs[spellType];

    // Check balance — FOR UPDATE to prevent concurrent double-spend
    const bal = await client.query('SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    const balance = bal.rows.length ? parseInt(bal.rows[0].balance, 10) : 0;
    if (balance < gpCost) throw new Error(`Insufficient GP. Need ${gpCost}, have ${balance}`);

    // Deduct GP (AND guard prevents negative balance)
    const deductSpell = await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [gpCost, wallet]);
    if (deductSpell.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'spell_cast',$3)",
      [wallet, -gpCost, `${SPELLS[spellType].icon} ${SPELLS[spellType].label} on claim #${claimId}`]
    );

    const expiresAt = new Date(Date.now() + cfg.durationH * 3600 * 1000);
    const ins = await client.query(
      'INSERT INTO territory_spells(caster_wallet,target_claim_id,spell_type,gp_cost,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [wallet, claimId, spellType, gpCost, expiresAt]
    );

    await client.query('COMMIT');

    // Notify target owner (fire-and-forget)
    if (spell.type === 'hex' && !isOwn && notifyPlayer) {
      notifyPlayer(ownerWallet, `${spell.icon} Your territory #${claimId} was hit by ${spell.label}!`, 'spell').catch(() => {});
    }
    if (logGPActivity) logGPActivity(wallet, -gpCost, 'spell', `${spell.label} on #${claimId}`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, gpCost).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', gpCost).catch(() => {});

    return {
      spellId: ins.rows[0].id,
      spellType,
      icon: spell.icon,
      label: spell.label,
      gpSpent: gpCost,
      expiresAt,
      durationH: cfg.durationH,
    };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// GET active spells on a territory
async function getClaimSpells(claimId) {
  const r = await pool.query(
    "SELECT id, caster_wallet, spell_type, gp_cost, expires_at, created_at FROM territory_spells WHERE target_claim_id=$1 AND is_active=true AND expires_at>NOW() ORDER BY expires_at",
    [parseInt(claimId, 10)]
  );
  return r.rows.map(row => ({
    ...row,
    icon:  (SPELLS[row.spell_type] || {}).icon  || '✨',
    label: (SPELLS[row.spell_type] || {}).label || row.spell_type,
    type:  (SPELLS[row.spell_type] || {}).type  || 'unknown',
  }));
}

// GET my spell cast history
async function getMySpells(wallet, limit = 30) {
  const r = await pool.query(
    "SELECT id, target_claim_id, spell_type, gp_cost, expires_at, is_active, created_at FROM territory_spells WHERE LOWER(caster_wallet)=LOWER($1) ORDER BY created_at DESC LIMIT $2",
    [wallet.toLowerCase(), Math.min(limit, 50)]
  );
  return r.rows.map(row => ({
    ...row,
    icon:  (SPELLS[row.spell_type] || {}).icon  || '✨',
    label: (SPELLS[row.spell_type] || {}).label || row.spell_type,
  }));
}

// Expire old spells (scheduler)
async function expireSpells() {
  const r = await pool.query(
    "UPDATE territory_spells SET is_active=false WHERE is_active=true AND expires_at<=NOW() RETURNING id"
  );
  if (r.rowCount > 0) console.log(`[SPELLS] Expired ${r.rowCount} spell(s)`);
  return r.rowCount;
}

async function getAdminStats() {
  const [totals, active, recent, settings] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(gp_cost),0) AS total_gp FROM territory_spells"),
    pool.query("SELECT spell_type, COUNT(*) AS cnt FROM territory_spells WHERE is_active=true AND expires_at>NOW() GROUP BY spell_type ORDER BY cnt DESC"),
    pool.query("SELECT ts.*, c.center_lat, c.center_lng FROM territory_spells ts LEFT JOIN claims c ON c.id=ts.target_claim_id ORDER BY ts.created_at DESC LIMIT 20"),
    pool.query("SELECT key, value FROM game_settings WHERE category='spells' ORDER BY key"),
  ]);
  return {
    totalCast: parseInt(totals.rows[0].total, 10),
    totalGP:   parseInt(totals.rows[0].total_gp, 10),
    activeByType: active.rows,
    recent: recent.rows.map(r => ({ ...r, icon: (SPELLS[r.spell_type] || {}).icon || '✨', label: (SPELLS[r.spell_type] || {}).label || r.spell_type })),
    settings: Object.fromEntries(settings.rows.map(r => [r.key, r.value])),
  };
}

module.exports = { castSpell, getClaimSpells, getMySpells, expireSpells, getSpellInfo, getCfg, getAdminStats };

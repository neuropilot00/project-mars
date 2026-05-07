'use strict';
/**
 * Territory Branding Service — Migration 123
 * Players pay GP to set a custom name, tagline, and theme color on their territories.
 */
const { pool, getSetting, logGPActivity } = require('../db');

let seasonService, weeklySvc;
try { seasonService = require('./season'); } catch (_) {}
try { weeklySvc     = require('./weeklyChallenges'); } catch (_) {}

async function getCfg() {
  const [enabled, nameCost, tagCost, colorCost, updateCost, maxName, maxTag] = await Promise.all([
    getSetting('branding_enabled',           'true'),
    getSetting('branding_name_cost_gp',      '50'),
    getSetting('branding_tagline_cost_gp',   '25'),
    getSetting('branding_color_cost_gp',     '100'),
    getSetting('branding_update_cost_gp',    '15'),
    getSetting('branding_max_name_length',   '24'),
    getSetting('branding_max_tagline_length','60'),
  ]);
  return {
    enabled:   enabled === 'true',
    nameCost:  parseInt(nameCost,  10),
    tagCost:   parseInt(tagCost,   10),
    colorCost: parseInt(colorCost, 10),
    updateCost:parseInt(updateCost,10),
    maxName:   parseInt(maxName,   10),
    maxTag:    parseInt(maxTag,    10),
  };
}

// Validate hex color (#RRGGBB)
function validColor(c) { return /^#[0-9a-fA-F]{6}$/.test(c); }

// ── Read ─────────────────────────────────────────────────────────────────────

async function getBranding(claimId) {
  const r = await pool.query('SELECT * FROM territory_branding WHERE claim_id=$1', [claimId]);
  return r.rows[0] || null;
}

async function getMyBranding(wallet) {
  const r = await pool.query(
    'SELECT tb.*, c.center_lat, c.center_lng, c.width, c.height FROM territory_branding tb LEFT JOIN claims c ON c.id=tb.claim_id WHERE tb.wallet=$1 ORDER BY tb.updated_at DESC',
    [wallet.toLowerCase()]
  );
  return r.rows;
}

// ── Set field helper ──────────────────────────────────────────────────────────

async function _setBrandingField(wallet, claimId, field, value, cost) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Territory branding is disabled');
  wallet = wallet.toLowerCase();
  claimId = parseInt(claimId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const claim = await client.query('SELECT owner FROM claims WHERE id=$1', [claimId]);
    if (!claim.rows.length) throw new Error('Territory not found');
    if (claim.rows[0].owner.toLowerCase() !== wallet) throw new Error('You do not own this territory');

    // Determine cost: first set vs update
    const existing = await client.query('SELECT id, ' + field + ' FROM territory_branding WHERE claim_id=$1', [claimId]);
    const isUpdate = existing.rows.length && existing.rows[0][field];
    const gpCost   = isUpdate ? cfg.updateCost : cost;

    // Check balance
    const bal = await client.query('SELECT gp_balance AS balance FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE', [wallet]);
    const balance = bal.rows.length ? parseInt(bal.rows[0].balance, 10) : 0;
    if (balance < gpCost) throw new Error(`Insufficient GP. Need ${gpCost}, have ${balance}`);

    const oldValue = isUpdate ? existing.rows[0][field] : null;

    // Deduct GP
    const deductBranding = await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1', [gpCost, wallet]);
    if (deductBranding.rowCount === 0) throw new Error('INSUFFICIENT_GP');
    await client.query(
      "INSERT INTO gp_transactions(wallet,amount,type,note) VALUES($1,$2,'branding',$3)",
      [wallet, -gpCost, `Set territory ${field} (claim #${claimId})`]
    );

    // Upsert branding row
    await client.query(`
      INSERT INTO territory_branding(claim_id, wallet, ${field}, updated_at)
      VALUES($1,$2,$3,NOW())
      ON CONFLICT(claim_id) DO UPDATE SET ${field}=$3, wallet=$2, updated_at=NOW()
    `, [claimId, wallet, value]);

    // Log
    await client.query(
      'INSERT INTO territory_branding_log(claim_id, wallet, field, old_value, new_value, gp_spent) VALUES($1,$2,$3,$4,$5,$6)',
      [claimId, wallet, field, oldValue, value, gpCost]
    );

    await client.query('COMMIT');

    // Side effects
    if (logGPActivity) logGPActivity(wallet, -gpCost, 'branding', `Set territory ${field}`).catch(() => {});
    if (seasonService && seasonService.trackGPSpend) seasonService.trackGPSpend(wallet, gpCost).catch(() => {});
    if (weeklySvc && weeklySvc.trackProgress) weeklySvc.trackProgress(wallet, 'gp_burn', gpCost).catch(() => {});

    return { claimId, field, value, gpSpent: gpCost, isUpdate };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function setName(wallet, claimId, name) {
  const cfg = await getCfg();
  name = (name || '').trim().slice(0, cfg.maxName);
  if (!name) throw new Error('Name cannot be empty');
  // Sanitize: alphanumeric + spaces + common symbols
  if (!/^[\w\s\-'.!?#@&()]{1,24}$/.test(name)) throw new Error('Invalid characters in name');
  return _setBrandingField(wallet, claimId, 'territory_name', name, cfg.nameCost);
}

async function setTagline(wallet, claimId, tagline) {
  const cfg = await getCfg();
  tagline = (tagline || '').trim().slice(0, cfg.maxTag);
  if (!tagline) throw new Error('Tagline cannot be empty');
  return _setBrandingField(wallet, claimId, 'tagline', tagline, cfg.tagCost);
}

async function setColor(wallet, claimId, color) {
  const cfg = await getCfg();
  color = (color || '').trim().toLowerCase();
  if (!validColor(color)) throw new Error('Color must be a valid hex code (#RRGGBB)');
  return _setBrandingField(wallet, claimId, 'theme_color', color, cfg.colorCost);
}

async function clearBranding(wallet, claimId) {
  wallet = wallet.toLowerCase();
  claimId = parseInt(claimId, 10);
  const claim = await pool.query('SELECT owner FROM claims WHERE id=$1', [claimId]);
  if (!claim.rows.length) throw new Error('Territory not found');
  if (claim.rows[0].owner.toLowerCase() !== wallet) throw new Error('You do not own this territory');
  await pool.query('DELETE FROM territory_branding WHERE claim_id=$1 AND wallet=$2', [claimId, wallet]);
  return { cleared: true };
}

// Admin clear (no ownership check, no GP cost)
async function adminClearBranding(claimId) {
  await pool.query('DELETE FROM territory_branding WHERE claim_id=$1', [parseInt(claimId, 10)]);
  return { cleared: true };
}

async function getAdminStats() {
  const [total, recent, settings] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total, COUNT(territory_name) AS named, COUNT(tagline) AS tagged, COUNT(theme_color) AS colored FROM territory_branding'),
    pool.query('SELECT tb.*, c.center_lat, c.center_lng, c.width, c.height FROM territory_branding tb LEFT JOIN claims c ON c.id=tb.claim_id ORDER BY tb.updated_at DESC LIMIT 20'),
    pool.query("SELECT key, value FROM game_settings WHERE category='branding' ORDER BY key"),
  ]);
  return {
    stats: total.rows[0],
    recent: recent.rows,
    settings: Object.fromEntries(settings.rows.map(r => [r.key, r.value])),
  };
}

module.exports = { getBranding, getMyBranding, setName, setTagline, setColor, clearBranding, adminClearBranding, getAdminStats, getCfg };

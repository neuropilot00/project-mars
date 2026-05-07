'use strict';
const { pool, getSetting } = require('../db');

async function getCfg() {
  const [enabled, nickFirst, nickChange, nickCd, nickMax, avatarGp, avatarCd, mottoFirst, mottoChange, mottoCd, mottoMax, blacklist] = await Promise.all([
    getSetting('profile_enabled', 'true'),
    getSetting('profile_nickname_first_gp', '0'),
    getSetting('profile_nickname_change_gp', '100'),
    getSetting('profile_nickname_cooldown_h', '24'),
    getSetting('profile_nickname_max_length', '20'),
    getSetting('profile_avatar_color_gp', '50'),
    getSetting('profile_avatar_cooldown_h', '6'),
    getSetting('profile_motto_first_gp', '0'),
    getSetting('profile_motto_change_gp', '30'),
    getSetting('profile_motto_cooldown_h', '12'),
    getSetting('profile_motto_max_length', '80'),
    getSetting('profile_nickname_blacklist', ''),
  ]);
  return {
    enabled: enabled === 'true',
    nickname: { firstGp: parseInt(nickFirst)||0, changeGp: parseInt(nickChange)||100, cooldownH: parseInt(nickCd)||24, maxLength: parseInt(nickMax)||20 },
    avatar:   { gp: parseInt(avatarGp)||50,      cooldownH: parseInt(avatarCd)||6 },
    motto:    { firstGp: parseInt(mottoFirst)||0, changeGp: parseInt(mottoChange)||30, cooldownH: parseInt(mottoCd)||12, maxLength: parseInt(mottoMax)||80 },
    blacklist: blacklist ? blacklist.split(',').map(w => w.trim().toLowerCase()).filter(Boolean) : [],
  };
}

async function getProfile(wallet) {
  const r = await pool.query(
    `SELECT wallet_address, nickname, avatar_color, motto FROM users WHERE LOWER(wallet_address)=LOWER($1)`,
    [wallet]
  );
  return r.rows[0] || null;
}

async function _changeField(wallet, field, value, cfg) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load user
    const uRes = await client.query(
      `SELECT gp_balance, nickname, avatar_color, motto FROM users WHERE LOWER(wallet_address)=LOWER($1) FOR UPDATE`,
      [wallet]
    );
    if (!uRes.rows.length) throw new Error('User not found');
    const user = uRes.rows[0];

    // Determine cost and cooldown
    let gpCost = 0, cooldownH = 0, maxLen = 9999;
    if (field === 'nickname') {
      const isFirst = !user.nickname;
      gpCost = isFirst ? cfg.nickname.firstGp : cfg.nickname.changeGp;
      cooldownH = cfg.nickname.cooldownH;
      maxLen = cfg.nickname.maxLength;
    } else if (field === 'avatar_color') {
      gpCost = cfg.avatar.gp;
      cooldownH = cfg.avatar.cooldownH;
    } else if (field === 'motto') {
      const isFirst = !user.motto;
      gpCost = isFirst ? cfg.motto.firstGp : cfg.motto.changeGp;
      cooldownH = cfg.motto.cooldownH;
      maxLen = cfg.motto.maxLength;
    } else {
      throw new Error('Unknown field');
    }

    // Validate length
    if (value && value.length > maxLen) throw new Error(`Too long (max ${maxLen} chars)`);

    // Cooldown check (skip for first-set free fields)
    if (gpCost > 0 || (field !== 'nickname' && field !== 'motto')) {
      const cdRes = await client.query(
        `SELECT created_at FROM profile_change_log
          WHERE LOWER(wallet)=LOWER($1) AND field=$2
          ORDER BY created_at DESC LIMIT 1`,
        [wallet, field]
      );
      if (cdRes.rows.length && cooldownH > 0) {
        const lastChange = new Date(cdRes.rows[0].created_at);
        const nextAllowed = new Date(lastChange.getTime() + cooldownH * 3600 * 1000);
        if (new Date() < nextAllowed) {
          const diffMin = Math.ceil((nextAllowed - new Date()) / 60000);
          throw new Error(`Cooldown: ${diffMin} min remaining`);
        }
      }
    }

    // Balance check
    if (gpCost > 0 && user.gp_balance < gpCost) throw new Error('Insufficient GP');

    const oldValue = user[field] || null;

    // Deduct GP
    if (gpCost > 0) {
      const deductProfile = await client.query(
        `UPDATE users SET gp_balance = gp_balance - $1 WHERE LOWER(wallet_address)=LOWER($2) AND gp_balance >= $1`,
        [gpCost, wallet]
      );
      if (deductProfile.rowCount === 0) throw new Error('INSUFFICIENT_GP');
      await client.query(
        `INSERT INTO gp_transactions (wallet, amount, transaction_type, description)
         VALUES ($1, $2, 'profile_change', $3)`,
        [wallet, -gpCost, `Changed ${field}`]
      );
    }

    // Update field
    await client.query(
      `UPDATE users SET ${field}=$1 WHERE LOWER(wallet_address)=LOWER($2)`,
      [value, wallet]
    );

    // Log
    await client.query(
      `INSERT INTO profile_change_log (wallet, field, old_value, new_value, gp_spent)
       VALUES ($1, $2, $3, $4, $5)`,
      [wallet, field, oldValue, value, gpCost]
    );

    await client.query('COMMIT');

    // Side effects
    try { const { logGPActivity } = require('../db'); await logGPActivity(wallet, -gpCost, 'profile_change', `Changed ${field}`); } catch(_) {}
    try { const seasonService = require('./season'); await seasonService.trackGPSpend(wallet, gpCost); } catch(_) {}

    return { success: true, gpCost, field, newValue: value };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function setNickname(wallet, nickname) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Profile customization disabled');
  nickname = nickname.trim();
  if (!nickname) throw new Error('Nickname cannot be empty');
  if (!/^[\w\s\-'.!?#@&()]{1,20}$/.test(nickname)) throw new Error('Invalid characters in nickname');
  if (cfg.blacklist.some(bw => nickname.toLowerCase().includes(bw))) throw new Error('Nickname contains forbidden word');
  // Uniqueness check
  const dupRes = await pool.query(
    `SELECT wallet_address FROM users WHERE LOWER(nickname)=LOWER($1) AND LOWER(wallet_address)!=LOWER($2)`,
    [nickname, wallet]
  );
  if (dupRes.rows.length) throw new Error('Nickname already taken');
  return _changeField(wallet, 'nickname', nickname, cfg);
}

async function setAvatarColor(wallet, color) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Profile customization disabled');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Invalid hex color');
  return _changeField(wallet, 'avatar_color', color, cfg);
}

async function setMotto(wallet, motto) {
  const cfg = await getCfg();
  if (!cfg.enabled) throw new Error('Profile customization disabled');
  motto = motto.trim();
  if (!motto) throw new Error('Motto cannot be empty');
  return _changeField(wallet, 'motto', motto, cfg);
}

async function clearMotto(wallet) {
  const cfg = await getCfg();
  return _changeField(wallet, 'motto', null, cfg);
}

async function getHistory(wallet, field, limit = 10) {
  const res = await pool.query(
    `SELECT field, old_value, new_value, gp_spent, created_at
       FROM profile_change_log
      WHERE LOWER(wallet)=LOWER($1) ${field ? 'AND field=$3' : ''}
      ORDER BY created_at DESC LIMIT $2`,
    field ? [wallet, limit, field] : [wallet, limit]
  );
  return res.rows;
}

async function getAdminStats() {
  const r = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE field='nickname')     AS nickname_changes,
      COUNT(*) FILTER (WHERE field='avatar_color') AS color_changes,
      COUNT(*) FILTER (WHERE field='motto')        AS motto_changes,
      COALESCE(SUM(gp_spent),0)                   AS total_gp_spent,
      COUNT(DISTINCT wallet)                       AS unique_players
    FROM profile_change_log
  `);
  return r.rows[0];
}

module.exports = { getCfg, getProfile, setNickname, setAvatarColor, setMotto, clearMotto, getHistory, getAdminStats };

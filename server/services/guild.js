const { pool, getSetting } = require('../db');

// ═══════════════════════════════════════
//  CREATE GUILD
// ═══════════════════════════════════════

async function createGuild(wallet, name, tag, emoji, description) {
  const cost = parseInt(await getSetting('guild_create_cost_gp') || '50');
  tag = (tag || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
  if (tag.length < 2) return { error: 'Guild tag must be 2-4 characters (A-Z, 0-9)' };
  if (!name || name.trim().length < 2 || name.trim().length > 50) return { error: 'Guild name must be 2-50 characters' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check user not already in guild
    const memberCheck = await client.query('SELECT guild_id FROM users WHERE wallet_address = $1', [wallet]);
    if (memberCheck.rows[0]?.guild_id) {
      await client.query('ROLLBACK');
      return { error: 'You are already in a guild' };
    }

    // Check GP
    const gpRes = await client.query('SELECT COALESCE(gp_balance,0) AS gp FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
    const gp = parseFloat(gpRes.rows[0]?.gp || 0);
    if (gp < cost) {
      await client.query('ROLLBACK');
      return { error: `Need ${cost} GP to create a guild. You have ${Math.floor(gp)} GP.` };
    }

    // Check name/tag uniqueness
    const nameCheck = await client.query('SELECT id FROM guilds WHERE LOWER(name) = LOWER($1) OR UPPER(tag) = $2', [name.trim(), tag]);
    if (nameCheck.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'Guild name or tag already taken' };
    }

    // Deduct GP
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2', [cost, wallet]);

    // Create guild
    const guildRes = await client.query(
      `INSERT INTO guilds (name, tag, leader_wallet, emblem_emoji, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), tag, wallet, emoji || '🔴', (description || '').substring(0, 200)]
    );
    const guildId = guildRes.rows[0].id;

    // Add leader as member
    await client.query(
      `INSERT INTO guild_members (guild_id, wallet, role) VALUES ($1, $2, 'leader')`,
      [guildId, wallet]
    );

    // Update user
    await client.query('UPDATE users SET guild_id = $1 WHERE wallet_address = $2', [guildId, wallet]);

    await client.query('COMMIT');
    console.log(`[GUILD] Created "${name}" [${tag}] by ${wallet} (-${cost} GP)`);
    return { success: true, guildId, name: name.trim(), tag };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return { error: 'Guild name or tag already taken' };
    throw e;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
//  GET GUILD INFO
// ═══════════════════════════════════════

async function getGuild(guildId) {
  const guildRes = await pool.query('SELECT * FROM guilds WHERE id = $1', [guildId]);
  if (!guildRes.rows.length) return null;
  const g = guildRes.rows[0];

  const membersRes = await pool.query(
    `SELECT gm.wallet, gm.role, gm.joined_at, u.nickname,
            (SELECT COUNT(*)::int FROM claims WHERE owner = gm.wallet AND deleted_at IS NULL) AS claim_count,
            (SELECT COALESCE(SUM(width*height),0)::int FROM claims WHERE owner = gm.wallet AND deleted_at IS NULL) AS pixel_count
     FROM guild_members gm
     JOIN users u ON u.wallet_address = gm.wallet
     WHERE gm.guild_id = $1
     ORDER BY CASE gm.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, gm.joined_at`,
    [guildId]
  );

  return {
    id: g.id, name: g.name, tag: g.tag,
    leaderWallet: g.leader_wallet,
    emblem: g.emblem_emoji,
    emblemImage: g.emblem_image || null,
    description: g.description,
    memberCount: g.member_count,
    totalPixels: g.total_pixels,
    gpTreasury: parseFloat(g.gp_treasury),
    createdAt: g.created_at,
    members: membersRes.rows.map(m => ({
      wallet: m.wallet, nickname: m.nickname, role: m.role,
      claimCount: m.claim_count, pixelCount: m.pixel_count, joinedAt: m.joined_at
    }))
  };
}

// ═══════════════════════════════════════
//  CUSTOMIZE GUILD (leader-only, GP cost)
// ═══════════════════════════════════════
//
//  fields = { name?, description?, emblemEmoji?, emblemImage? }
//  Each provided field is charged independently (from settings).
//  emblemImage is a base64 data URL (PNG). Service caps payload size.
//  Passing emblemImage: null clears a previously uploaded image.
//
async function updateGuildInfo(callerWallet, guildId, fields) {
  if (!fields || typeof fields !== 'object') return { error: 'No changes requested' };
  const maxBytes = parseInt(await getSetting('guild_emblem_max_bytes') || '8192');
  const renameCost = parseInt(await getSetting('guild_rename_cost_gp') || '100');
  const descCost   = parseInt(await getSetting('guild_desc_cost_gp')   || '20');
  const emblemCost = parseInt(await getSetting('guild_emblem_cost_gp') || '50');

  // Validate inputs upfront
  const updates = [];
  const changes = {};
  let totalCost = 0;

  if (typeof fields.name === 'string') {
    const nm = fields.name.trim();
    if (nm.length < 2 || nm.length > 50) return { error: 'Guild name must be 2-50 characters' };
    changes.name = nm;
    totalCost += renameCost;
  }
  if (typeof fields.description === 'string') {
    const d = fields.description.substring(0, 200);
    changes.description = d;
    totalCost += descCost;
  }
  if (typeof fields.emblemEmoji === 'string' && fields.emblemEmoji.trim()) {
    const e = fields.emblemEmoji.trim().substring(0, 10);
    changes.emblemEmoji = e;
    totalCost += emblemCost;
  }
  if (fields.emblemImage !== undefined) {
    // Either a data URL string or null (clear)
    if (fields.emblemImage === null) {
      changes.emblemImage = null;
      totalCost += emblemCost;
    } else if (typeof fields.emblemImage === 'string') {
      const img = fields.emblemImage;
      if (!img.startsWith('data:image/')) return { error: 'Emblem must be an image data URL' };
      if (img.length > maxBytes) return { error: `Emblem image too large (max ${Math.floor(maxBytes/1024)}KB)` };
      changes.emblemImage = img;
      totalCost += emblemCost;
    } else {
      return { error: 'Invalid emblem image' };
    }
  }

  if (!Object.keys(changes).length) return { error: 'No changes requested' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify caller is the leader of this guild
    const leaderCheck = await client.query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
      [guildId, callerWallet]
    );
    if (!leaderCheck.rows.length || leaderCheck.rows[0].role !== 'leader') {
      await client.query('ROLLBACK');
      return { error: 'Only the guild leader can edit guild info' };
    }

    // Check GP balance (lock row)
    const gpRes = await client.query(
      'SELECT COALESCE(gp_balance,0) AS gp FROM users WHERE wallet_address = $1 FOR UPDATE',
      [callerWallet]
    );
    const gp = parseFloat(gpRes.rows[0]?.gp || 0);
    if (gp < totalCost) {
      await client.query('ROLLBACK');
      return { error: `Need ${totalCost} GP. You have ${Math.floor(gp)} GP.` };
    }

    // Name uniqueness check
    if (changes.name) {
      const nameCheck = await client.query(
        'SELECT id FROM guilds WHERE LOWER(name) = LOWER($1) AND id <> $2',
        [changes.name, guildId]
      );
      if (nameCheck.rows.length) {
        await client.query('ROLLBACK');
        return { error: 'Guild name already taken' };
      }
    }

    // Build dynamic UPDATE
    const setParts = [];
    const values = [];
    let idx = 1;
    if (changes.name !== undefined)        { setParts.push(`name = $${idx++}`);         values.push(changes.name); }
    if (changes.description !== undefined) { setParts.push(`description = $${idx++}`);  values.push(changes.description); }
    if (changes.emblemEmoji !== undefined) { setParts.push(`emblem_emoji = $${idx++}`); values.push(changes.emblemEmoji); }
    if (changes.emblemImage !== undefined) { setParts.push(`emblem_image = $${idx++}`); values.push(changes.emblemImage); }
    values.push(guildId);

    await client.query(
      `UPDATE guilds SET ${setParts.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Deduct GP
    await client.query('UPDATE users SET gp_balance = gp_balance - $1 WHERE wallet_address = $2', [totalCost, callerWallet]);

    await client.query('COMMIT');
    console.log(`[GUILD] #${guildId} updated by ${callerWallet} (-${totalCost} GP) ${Object.keys(changes).join(',')}`);
    return { success: true, cost: totalCost, changes: Object.keys(changes) };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return { error: 'Guild name already taken' };
    throw e;
  } finally {
    client.release();
  }
}

async function getGuildByWallet(wallet) {
  const res = await pool.query('SELECT guild_id FROM users WHERE wallet_address = $1', [wallet]);
  if (!res.rows[0]?.guild_id) return null;
  return getGuild(res.rows[0].guild_id);
}

// ═══════════════════════════════════════
//  INVITE / ACCEPT / DECLINE
// ═══════════════════════════════════════

async function inviteMember(callerWallet, targetWallet, guildId) {
  const maxMembers = parseInt(await getSetting('guild_max_members') || '20');

  // Verify caller role
  const roleRes = await pool.query(
    'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, callerWallet]
  );
  if (!roleRes.rows.length || roleRes.rows[0].role === 'member') {
    return { error: 'Only leader or officers can invite' };
  }

  // Check guild size
  const guild = await pool.query('SELECT member_count FROM guilds WHERE id = $1', [guildId]);
  if (guild.rows[0]?.member_count >= maxMembers) return { error: 'Guild is full' };

  // Check target not in a guild
  const targetCheck = await pool.query('SELECT guild_id FROM users WHERE wallet_address = $1', [targetWallet]);
  if (!targetCheck.rows.length) return { error: 'User not found' };
  if (targetCheck.rows[0].guild_id) return { error: 'User is already in a guild' };

  // Check no pending invite
  const invCheck = await pool.query(
    "SELECT id FROM guild_invites WHERE guild_id = $1 AND invited_wallet = $2 AND status = 'pending'",
    [guildId, targetWallet]
  );
  if (invCheck.rows.length) return { error: 'Invite already pending' };

  await pool.query(
    `INSERT INTO guild_invites (guild_id, invited_wallet, invited_by) VALUES ($1, $2, $3)`,
    [guildId, targetWallet, callerWallet]
  );
  return { success: true };
}

async function acceptInvite(wallet, inviteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const maxMembers = parseInt(await getSetting('guild_max_members') || '20');

    const inv = await client.query(
      "SELECT * FROM guild_invites WHERE id = $1 AND invited_wallet = $2 AND status = 'pending' FOR UPDATE",
      [inviteId, wallet]
    );
    if (!inv.rows.length) { await client.query('ROLLBACK'); return { error: 'Invite not found or expired' }; }

    const guildId = inv.rows[0].guild_id;

    // Check not already in guild
    const userCheck = await client.query('SELECT guild_id FROM users WHERE wallet_address = $1 FOR UPDATE', [wallet]);
    if (userCheck.rows[0]?.guild_id) { await client.query('ROLLBACK'); return { error: 'Already in a guild' }; }

    // Check guild not full
    const guildCheck = await client.query('SELECT member_count FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
    if (guildCheck.rows[0]?.member_count >= maxMembers) { await client.query('ROLLBACK'); return { error: 'Guild is full' }; }

    // Accept
    await client.query("UPDATE guild_invites SET status = 'accepted' WHERE id = $1", [inviteId]);
    await client.query("INSERT INTO guild_members (guild_id, wallet, role) VALUES ($1, $2, 'member')", [guildId, wallet]);
    await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guildId]);
    await client.query('UPDATE users SET guild_id = $1 WHERE wallet_address = $2', [guildId, wallet]);

    await client.query('COMMIT');
    return { success: true, guildId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function declineInvite(wallet, inviteId) {
  const res = await pool.query(
    "UPDATE guild_invites SET status = 'declined' WHERE id = $1 AND invited_wallet = $2 AND status = 'pending' RETURNING id",
    [inviteId, wallet]
  );
  return res.rowCount ? { success: true } : { error: 'Invite not found' };
}

async function getMyInvites(wallet) {
  const res = await pool.query(
    `SELECT gi.id, gi.guild_id, gi.invited_by, gi.created_at,
            g.name AS guild_name, g.tag AS guild_tag, g.emblem_emoji,
            u.nickname AS invited_by_nickname
     FROM guild_invites gi
     JOIN guilds g ON g.id = gi.guild_id
     LEFT JOIN users u ON u.wallet_address = gi.invited_by
     WHERE gi.invited_wallet = $1 AND gi.status = 'pending'
     ORDER BY gi.created_at DESC`,
    [wallet]
  );
  return res.rows;
}

// ═══════════════════════════════════════
//  LEAVE / KICK / PROMOTE / TRANSFER / DISBAND
// ═══════════════════════════════════════

async function leaveGuild(wallet) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mem = await client.query('SELECT guild_id, role FROM guild_members WHERE wallet = $1 FOR UPDATE', [wallet]);
    if (!mem.rows.length) { await client.query('ROLLBACK'); return { error: 'Not in a guild' }; }
    if (mem.rows[0].role === 'leader') { await client.query('ROLLBACK'); return { error: 'Leader must transfer leadership or disband' }; }

    const guildId = mem.rows[0].guild_id;
    await client.query('DELETE FROM guild_members WHERE wallet = $1', [wallet]);
    await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guildId]);
    await client.query('UPDATE users SET guild_id = NULL WHERE wallet_address = $1', [wallet]);

    await client.query('COMMIT');
    return { success: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function kickMember(leaderWallet, targetWallet, guildId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const caller = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, leaderWallet]);
    if (!caller.rows.length || caller.rows[0].role !== 'leader') { await client.query('ROLLBACK'); return { error: 'Only leader can kick' }; }

    const target = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, targetWallet]);
    if (!target.rows.length) { await client.query('ROLLBACK'); return { error: 'Target not in guild' }; }
    if (target.rows[0].role === 'leader') { await client.query('ROLLBACK'); return { error: 'Cannot kick the leader' }; }

    await client.query('DELETE FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, targetWallet]);
    await client.query('UPDATE guilds SET member_count = member_count - 1 WHERE id = $1', [guildId]);
    await client.query('UPDATE users SET guild_id = NULL WHERE wallet_address = $1', [targetWallet]);

    await client.query('COMMIT');
    return { success: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function promoteToOfficer(leaderWallet, targetWallet, guildId) {
  const caller = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, leaderWallet]);
  if (!caller.rows.length || caller.rows[0].role !== 'leader') return { error: 'Only leader can promote' };

  const res = await pool.query(
    "UPDATE guild_members SET role = 'officer' WHERE guild_id = $1 AND wallet = $2 AND role = 'member' RETURNING wallet",
    [guildId, targetWallet]
  );
  return res.rowCount ? { success: true } : { error: 'Cannot promote' };
}

async function demoteToMember(leaderWallet, targetWallet, guildId) {
  const caller = await pool.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, leaderWallet]);
  if (!caller.rows.length || caller.rows[0].role !== 'leader') return { error: 'Only leader can demote' };

  const res = await pool.query(
    "UPDATE guild_members SET role = 'member' WHERE guild_id = $1 AND wallet = $2 AND role = 'officer' RETURNING wallet",
    [guildId, targetWallet]
  );
  return res.rowCount ? { success: true } : { error: 'Cannot demote' };
}

async function transferLeadership(leaderWallet, newLeaderWallet, guildId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const caller = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2 FOR UPDATE', [guildId, leaderWallet]);
    if (!caller.rows.length || caller.rows[0].role !== 'leader') { await client.query('ROLLBACK'); return { error: 'Not the leader' }; }

    const target = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2 FOR UPDATE', [guildId, newLeaderWallet]);
    if (!target.rows.length) { await client.query('ROLLBACK'); return { error: 'Target not in guild' }; }

    await client.query("UPDATE guild_members SET role = 'leader' WHERE guild_id = $1 AND wallet = $2", [guildId, newLeaderWallet]);
    await client.query("UPDATE guild_members SET role = 'member' WHERE guild_id = $1 AND wallet = $2", [guildId, leaderWallet]);
    await client.query('UPDATE guilds SET leader_wallet = $1 WHERE id = $2', [newLeaderWallet, guildId]);

    await client.query('COMMIT');
    return { success: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function disbandGuild(leaderWallet, guildId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const caller = await client.query('SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, leaderWallet]);
    if (!caller.rows.length || caller.rows[0].role !== 'leader') { await client.query('ROLLBACK'); return { error: 'Only leader can disband' }; }

    // Clear all members' guild_id
    await client.query('UPDATE users SET guild_id = NULL WHERE guild_id = $1', [guildId]);
    // Delete guild (cascades to members + invites)
    await client.query('DELETE FROM guilds WHERE id = $1', [guildId]);

    await client.query('COMMIT');
    console.log(`[GUILD] Disbanded guild #${guildId} by ${leaderWallet}`);
    return { success: true };
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// ═══════════════════════════════════════
//  LEADERBOARD & PIXEL REFRESH
// ═══════════════════════════════════════

async function getGuildLeaderboard(limit = 20) {
  const res = await pool.query(
    `SELECT g.id, g.name, g.tag, g.emblem_emoji, g.emblem_image, g.member_count, g.total_pixels, g.created_at,
            u.nickname AS leader_nickname
     FROM guilds g
     LEFT JOIN users u ON u.wallet_address = g.leader_wallet
     ORDER BY g.total_pixels DESC
     LIMIT $1`,
    [Math.min(limit, 50)]
  );
  return res.rows.map(r => ({
    id: r.id, name: r.name, tag: r.tag, emblem: r.emblem_emoji,
    emblemImage: r.emblem_image || null,
    memberCount: r.member_count, totalPixels: r.total_pixels,
    leaderNickname: r.leader_nickname, createdAt: r.created_at
  }));
}

async function refreshGuildPixelCount(guildId) {
  if (!guildId) return;
  await pool.query(
    `UPDATE guilds SET total_pixels = (
       SELECT COALESCE(SUM(c.width * c.height), 0)::int
       FROM claims c
       JOIN guild_members gm ON gm.wallet = c.owner
       WHERE gm.guild_id = $1 AND c.deleted_at IS NULL
     ) WHERE id = $1`,
    [guildId]
  );
}

// ═══════════════════════════════════════
//  GUILD CHAT
// ═══════════════════════════════════════
//  Simple polling-based chat. Members only.
//  Rate-limited by guild_chat_cooldown_sec.
//  Messages trimmed to guild_chat_max_len chars.

async function sendGuildMessage(wallet, guildId, rawMessage) {
  if (!wallet || !guildId) return { error: 'Missing wallet or guild' };
  const text = (rawMessage || '').toString().trim();
  if (!text) return { error: 'Empty message' };

  const maxLen   = parseInt(await getSetting('guild_chat_max_len')      || '300');
  const cooldown = parseInt(await getSetting('guild_chat_cooldown_sec') || '3');
  const message = text.slice(0, maxLen);

  // Must be a member of this guild
  const memberRes = await pool.query(
    'SELECT 1 FROM guild_members WHERE guild_id = $1 AND wallet = $2',
    [guildId, wallet]
  );
  if (!memberRes.rows.length) return { error: 'Not a guild member' };

  // Cooldown check
  const lastRes = await pool.query(
    `SELECT created_at FROM guild_messages
     WHERE guild_id = $1 AND wallet = $2
     ORDER BY created_at DESC LIMIT 1`,
    [guildId, wallet]
  );
  if (lastRes.rows.length) {
    const last = new Date(lastRes.rows[0].created_at).getTime();
    const waited = (Date.now() - last) / 1000;
    if (waited < cooldown) {
      return { error: `Slow down — wait ${Math.ceil(cooldown - waited)}s` };
    }
  }

  // Fetch nickname (snapshot at send time for display)
  const nickRes = await pool.query(
    'SELECT nickname FROM users WHERE wallet_address = $1',
    [wallet]
  );
  const nickname = nickRes.rows[0]?.nickname || null;

  const ins = await pool.query(
    `INSERT INTO guild_messages (guild_id, wallet, nickname, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [guildId, wallet, nickname, message]
  );
  return { success: true, id: ins.rows[0].id, at: ins.rows[0].created_at };
}

async function getGuildMessages(wallet, guildId, sinceId) {
  if (!wallet || !guildId) return { error: 'Missing wallet or guild' };
  // Must be a member
  const memberRes = await pool.query(
    'SELECT 1 FROM guild_members WHERE guild_id = $1 AND wallet = $2',
    [guildId, wallet]
  );
  if (!memberRes.rows.length) return { error: 'Not a guild member' };

  const limit = parseInt(await getSetting('guild_chat_history_limit') || '100');
  const sinceFilter = sinceId ? 'AND id > $3' : '';
  const params = sinceId ? [guildId, limit, parseInt(sinceId)] : [guildId, limit];

  const res = await pool.query(
    `SELECT id, wallet, nickname, message, created_at
     FROM guild_messages
     WHERE guild_id = $1 ${sinceFilter}
     ORDER BY id DESC
     LIMIT $2`,
    params
  );
  // Return in chronological order (oldest first) for simpler UI append
  const messages = res.rows.map(r => ({
    id: r.id,
    wallet: r.wallet,
    nickname: r.nickname,
    message: r.message,
    at: r.created_at
  })).reverse();
  return { messages };
}

// ═══════════════════════════════════════
//  TREASURY CONTRIBUTION (auto-siphon on harvest)
// ═══════════════════════════════════════
//
//  Called from harvest flow: if the wallet is in a guild, redirects
//  `pct%` of the gross PP reward into the guild PP treasury and
//  records it on the ledger. Returns { contributed, remaining }.
//  Pct is per-member (users set it themselves 0–max% via slider).
//
async function contributeHarvest(client, wallet, grossPP) {
  if (!grossPP || grossPP <= 0) return { contributed: 0, remaining: grossPP };
  try {
    const memRes = await client.query(
      `SELECT gm.guild_id, gm.pp_contribution_pct
       FROM guild_members gm
       WHERE gm.wallet = $1`,
      [wallet]
    );
    if (!memRes.rows.length) return { contributed: 0, remaining: grossPP };
    const { guild_id, pp_contribution_pct } = memRes.rows[0];
    const pct = Math.max(0, Math.min(30, parseInt(pp_contribution_pct || 0)));
    if (pct === 0) return { contributed: 0, remaining: grossPP };

    const cut = Math.round(grossPP * pct / 100 * 1000000) / 1000000;
    if (cut <= 0) return { contributed: 0, remaining: grossPP };

    // Credit treasury + ledger
    const upd = await client.query(
      `UPDATE guilds SET pp_treasury = COALESCE(pp_treasury, 0) + $1
       WHERE id = $2 RETURNING pp_treasury`,
      [cut, guild_id]
    );
    const balance = parseFloat(upd.rows[0]?.pp_treasury || 0);
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_pp, balance_after, memo)
       VALUES ($1, $2, 'harvest_contrib', $3, $4, $5)`,
      [guild_id, wallet, cut, balance, `${pct}% harvest contribution`]
    );
    await client.query(
      `UPDATE guild_members SET total_contributed = COALESCE(total_contributed, 0) + $1
       WHERE guild_id = $2 AND wallet = $3`,
      [cut, guild_id, wallet]
    );
    return { contributed: cut, remaining: grossPP - cut, guildId: guild_id };
  } catch (e) {
    console.warn('[GUILD] contributeHarvest failed:', e.message);
    return { contributed: 0, remaining: grossPP };
  }
}

async function setContributionPct(wallet, pct) {
  const min = parseInt(await getSetting('guild_contrib_min_pct') || '0');
  const max = parseInt(await getSetting('guild_contrib_max_pct') || '30');
  const clamped = Math.max(min, Math.min(max, parseInt(pct || 0)));
  const r = await pool.query(
    `UPDATE guild_members SET pp_contribution_pct = $1 WHERE wallet = $2 RETURNING guild_id`,
    [clamped, wallet]
  );
  if (!r.rowCount) return { error: 'Not in a guild' };
  return { success: true, pct: clamped };
}

// ═══════════════════════════════════════
//  GUILD LEVEL UP
// ═══════════════════════════════════════
//
//  Any member can trigger level-up if the treasury holds the cost.
//  Raises guild.level by 1, deducts from treasury, logs ledger.
//
async function upgradeGuildLevel(wallet, guildId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Must be a member
    const mem = await client.query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
      [guildId, wallet]
    );
    if (!mem.rows.length) { await client.query('ROLLBACK'); return { error: 'Not a guild member' }; }

    const gRes = await client.query(
      'SELECT level, pp_treasury FROM guilds WHERE id = $1 FOR UPDATE',
      [guildId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return { error: 'Guild not found' }; }
    const curLvl = parseInt(gRes.rows[0].level || 1);
    const treasury = parseFloat(gRes.rows[0].pp_treasury || 0);
    const maxLvl = parseInt(await getSetting('guild_level_max') || '6');
    if (curLvl >= maxLvl) { await client.query('ROLLBACK'); return { error: 'Already at max level' }; }

    const nextLvl = curLvl + 1;
    const costKey = `guild_level_${nextLvl}_cost_pp`;
    const cost = parseFloat(await getSetting(costKey) || '0');
    if (cost <= 0) { await client.query('ROLLBACK'); return { error: 'Level cost not configured' }; }
    if (treasury < cost) { await client.query('ROLLBACK'); return { error: `Need ${cost} PP in treasury. Have ${treasury.toFixed(2)}.` }; }

    // Deduct + upgrade
    await client.query(
      'UPDATE guilds SET pp_treasury = pp_treasury - $1, level = $2 WHERE id = $3',
      [cost, nextLvl, guildId]
    );
    const newBal = treasury - cost;
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_pp, balance_after, memo)
       VALUES ($1, $2, 'levelup', $3, $4, $5)`,
      [guildId, wallet, -cost, newBal, `Level ${curLvl} → ${nextLvl}`]
    );

    // Grant member-slot bonus
    const bonusKey = `guild_level_${nextLvl}_member_bonus`;
    const bonus = parseInt(await getSetting(bonusKey) || '0');
    if (bonus > 0) {
      // member_max column may not exist; use a dedicated setting key instead.
      // For simplicity, we compute effective max from base + sum of bonuses at runtime.
    }

    await client.query('COMMIT');
    console.log(`[GUILD] #${guildId} upgraded to level ${nextLvl} by ${wallet} (-${cost} PP)`);
    return { success: true, level: nextLvl, cost, treasuryRemaining: newBal };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

// Computed max-member cap that honors level bonuses.
async function getGuildMaxMembers(guildId) {
  const base = parseInt(await getSetting('guild_max_members') || '20');
  const r = await pool.query('SELECT level FROM guilds WHERE id = $1', [guildId]);
  const lvl = parseInt(r.rows[0]?.level || 1);
  let bonus = 0;
  for (let l = 2; l <= lvl; l++) {
    bonus += parseInt(await getSetting(`guild_level_${l}_member_bonus`) || '0');
  }
  return base + bonus;
}

// ═══════════════════════════════════════
//  RESEARCH UNLOCK
// ═══════════════════════════════════════
//
//  Leader/officer spends from treasury to unlock a research flag.
//  Flags are stored as a JSONB { [key]: true } map on guilds.
//
async function unlockResearch(wallet, guildId, researchKey) {
  if (!researchKey) return { error: 'Missing research key' };
  const costSetting = `guild_research_${researchKey}_pp`;
  const cost = parseFloat(await getSetting(costSetting) || '0');
  if (cost <= 0) return { error: 'Unknown research' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Must be leader or officer
    const mem = await client.query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
      [guildId, wallet]
    );
    if (!mem.rows.length || mem.rows[0].role === 'member') {
      await client.query('ROLLBACK');
      return { error: 'Only leader or officers can unlock research' };
    }

    const gRes = await client.query(
      'SELECT pp_treasury, research_flags FROM guilds WHERE id = $1 FOR UPDATE',
      [guildId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return { error: 'Guild not found' }; }
    const treasury = parseFloat(gRes.rows[0].pp_treasury || 0);
    const flags = gRes.rows[0].research_flags || {};
    if (flags[researchKey]) { await client.query('ROLLBACK'); return { error: 'Already unlocked' }; }
    if (treasury < cost) { await client.query('ROLLBACK'); return { error: `Need ${cost} PP. Have ${treasury.toFixed(2)}.` }; }

    flags[researchKey] = true;
    await client.query(
      `UPDATE guilds
         SET pp_treasury = pp_treasury - $1,
             research_flags = $2::jsonb
       WHERE id = $3`,
      [cost, JSON.stringify(flags), guildId]
    );
    const newBal = treasury - cost;
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_pp, balance_after, memo)
       VALUES ($1, $2, 'research', $3, $4, $5)`,
      [guildId, wallet, -cost, newBal, `Research: ${researchKey}`]
    );
    await client.query('COMMIT');
    return { success: true, researchKey, cost, treasuryRemaining: newBal };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

async function getTreasuryLedger(guildId, limit = 50) {
  const r = await pool.query(
    `SELECT l.id, l.wallet, l.kind, l.delta_pp, l.balance_after, l.memo, l.created_at,
            u.nickname
     FROM guild_treasury_ledger l
     LEFT JOIN users u ON u.wallet_address = l.wallet
     WHERE l.guild_id = $1
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [guildId, Math.min(limit, 200)]
  );
  return r.rows.map(row => ({
    id: row.id,
    wallet: row.wallet,
    nickname: row.nickname,
    kind: row.kind,
    deltaPP: parseFloat(row.delta_pp),
    balanceAfter: parseFloat(row.balance_after),
    memo: row.memo,
    at: row.created_at
  }));
}

module.exports = {
  createGuild, getGuild, getGuildByWallet,
  inviteMember, acceptInvite, declineInvite, getMyInvites,
  leaveGuild, kickMember,
  promoteToOfficer, demoteToMember, transferLeadership, disbandGuild,
  getGuildLeaderboard, refreshGuildPixelCount,
  updateGuildInfo,
  sendGuildMessage, getGuildMessages,
  // Upgrades (migration 058)
  contributeHarvest, setContributionPct,
  upgradeGuildLevel, getGuildMaxMembers,
  unlockResearch, getTreasuryLedger
};

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

// Resolve a free-form input (wallet address OR nickname, case-insensitive)
// to a canonical wallet_address. Returns null if no match.
async function resolveWalletByInput(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  // Wallet form: 0x + 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(raw)) {
    const r = await pool.query(
      'SELECT wallet_address FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [raw]
    );
    return r.rows[0]?.wallet_address || null;
  }
  // Nickname form: case-insensitive exact match
  const r = await pool.query(
    'SELECT wallet_address FROM users WHERE LOWER(nickname) = LOWER($1)',
    [raw]
  );
  return r.rows[0]?.wallet_address || null;
}

async function inviteMember(callerWallet, targetInput, guildId) {
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

  // Resolve nickname or wallet → canonical wallet
  const targetWallet = await resolveWalletByInput(targetInput);
  if (!targetWallet) return { error: 'User not found' };

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

// ──────────────────────────────────────────────
//  USER SEARCH (for invite UI: nickname/wallet → list)
//  Returns up to `limit` users matching the query who are NOT
//  in any guild and don't already have a pending invite to this guild.
// ──────────────────────────────────────────────
async function searchUsersForInvite(callerWallet, guildId, query, limit) {
  const q = (query || '').trim();
  if (!q || q.length < 1) return [];
  const cap = Math.min(parseInt(limit) || 15, 30);

  // Verify caller is leader/officer of this guild
  const roleRes = await pool.query(
    'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, callerWallet]
  );
  if (!roleRes.rows.length || roleRes.rows[0].role === 'member') return [];

  const like = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
  const r = await pool.query(
    `SELECT u.wallet_address AS wallet,
            u.nickname,
            (SELECT COUNT(*)::int FROM claims
              WHERE owner = u.wallet_address AND deleted_at IS NULL) AS pixel_count,
            EXISTS(
              SELECT 1 FROM guild_invites gi
               WHERE gi.guild_id = $2
                 AND gi.invited_wallet = u.wallet_address
                 AND gi.status = 'pending'
            ) AS has_pending_invite
       FROM users u
      WHERE u.guild_id IS NULL
        AND ( LOWER(u.nickname)       LIKE LOWER($1) ESCAPE '\\'
           OR LOWER(u.wallet_address) LIKE LOWER($1) ESCAPE '\\' )
      ORDER BY
        CASE
          WHEN LOWER(u.nickname) = LOWER($3) THEN 0
          WHEN LOWER(u.nickname) LIKE LOWER($4) ESCAPE '\\' THEN 1
          ELSE 2
        END,
        pixel_count DESC NULLS LAST,
        u.nickname ASC
      LIMIT $5`,
    [like, guildId, q, q.replace(/[%_\\]/g, '\\$&') + '%', cap]
  );

  return r.rows.map(row => ({
    wallet: row.wallet,
    nickname: row.nickname || null,
    pixelCount: row.pixel_count || 0,
    hasPendingInvite: !!row.has_pending_invite,
  }));
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
  // Exclude self-requests (invited_by = invited_wallet) — those are join
  // requests the caller sent to a guild, not invites they received.
  const res = await pool.query(
    `SELECT gi.id, gi.guild_id, gi.invited_by, gi.created_at,
            g.name AS guild_name, g.tag AS guild_tag, g.emblem_emoji,
            u.nickname AS invited_by_nickname
     FROM guild_invites gi
     JOIN guilds g ON g.id = gi.guild_id
     LEFT JOIN users u ON u.wallet_address = gi.invited_by
     WHERE gi.invited_wallet = $1
       AND gi.status = 'pending'
       AND gi.invited_by <> gi.invited_wallet
     ORDER BY gi.created_at DESC`,
    [wallet]
  );
  return res.rows;
}

// ═══════════════════════════════════════
//  JOIN REQUESTS (player → guild, approval-based)
// ═══════════════════════════════════════
//  Reuses the guild_invites table: we record the row with
//  invited_by = invited_wallet = requester.  Leaders/officers see the rows
//  via getGuildJoinRequests() and approve via approveJoinRequest().
async function createJoinRequest(wallet, guildId) {
  if (!wallet || !guildId) return { error: 'Missing fields' };

  // Not already in a guild
  const u = await pool.query('SELECT guild_id FROM users WHERE wallet_address = $1', [wallet]);
  if (!u.rows.length) return { error: 'User not found' };
  if (u.rows[0].guild_id) return { error: 'You are already in a guild' };

  // Guild must exist and not be full
  const maxMembers = parseInt(await getSetting('guild_max_members') || '20');
  const g = await pool.query('SELECT id, member_count, name FROM guilds WHERE id = $1', [guildId]);
  if (!g.rows.length) return { error: 'Guild not found' };
  if (g.rows[0].member_count >= maxMembers) return { error: 'Guild is full' };

  // Don't duplicate a pending row (self-invite or normal invite)
  const existing = await pool.query(
    "SELECT id FROM guild_invites WHERE guild_id = $1 AND invited_wallet = $2 AND status = 'pending'",
    [guildId, wallet]
  );
  if (existing.rows.length) return { error: 'Already requested' };

  await pool.query(
    `INSERT INTO guild_invites (guild_id, invited_wallet, invited_by) VALUES ($1, $2, $2)`,
    [guildId, wallet]
  );
  return { success: true, guildName: g.rows[0].name };
}

async function getGuildJoinRequests(callerWallet, guildId) {
  // Only leaders/officers can see incoming requests
  const role = await pool.query(
    'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
    [guildId, callerWallet]
  );
  if (!role.rows.length || role.rows[0].role === 'member') return [];
  const res = await pool.query(
    `SELECT gi.id, gi.invited_wallet AS wallet, gi.created_at,
            u.nickname,
            (SELECT COALESCE(SUM(width*height),0)::int
               FROM claims WHERE owner = gi.invited_wallet AND deleted_at IS NULL) AS pixel_count
     FROM guild_invites gi
     LEFT JOIN users u ON u.wallet_address = gi.invited_wallet
     WHERE gi.guild_id = $1
       AND gi.status = 'pending'
       AND gi.invited_by = gi.invited_wallet
     ORDER BY gi.created_at DESC`,
    [guildId]
  );
  return res.rows;
}

async function approveJoinRequest(callerWallet, inviteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const maxMembers = parseInt(await getSetting('guild_max_members') || '20');

    const inv = await client.query(
      "SELECT * FROM guild_invites WHERE id = $1 AND status = 'pending' FOR UPDATE",
      [inviteId]
    );
    if (!inv.rows.length) { await client.query('ROLLBACK'); return { error: 'Request not found' }; }

    const { guild_id, invited_wallet, invited_by } = inv.rows[0];
    if (invited_wallet !== invited_by) {
      await client.query('ROLLBACK'); return { error: 'Not a join request' };
    }

    // Caller must be leader/officer of the target guild
    const role = await client.query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
      [guild_id, callerWallet]
    );
    if (!role.rows.length || role.rows[0].role === 'member') {
      await client.query('ROLLBACK'); return { error: 'Only leader/officers can approve' };
    }

    // Requester must still be guild-less
    const uCheck = await client.query('SELECT guild_id FROM users WHERE wallet_address = $1 FOR UPDATE', [invited_wallet]);
    if (uCheck.rows[0]?.guild_id) { await client.query('ROLLBACK'); return { error: 'Player is already in a guild' }; }

    // Guild not full
    const gCheck = await client.query('SELECT member_count FROM guilds WHERE id = $1 FOR UPDATE', [guild_id]);
    if (gCheck.rows[0]?.member_count >= maxMembers) { await client.query('ROLLBACK'); return { error: 'Guild is full' }; }

    // Perform the join
    await client.query("UPDATE guild_invites SET status = 'accepted' WHERE id = $1", [inviteId]);
    await client.query("INSERT INTO guild_members (guild_id, wallet, role) VALUES ($1, $2, 'member')", [guild_id, invited_wallet]);
    await client.query('UPDATE guilds SET member_count = member_count + 1 WHERE id = $1', [guild_id]);
    await client.query('UPDATE users SET guild_id = $1 WHERE wallet_address = $2', [guild_id, invited_wallet]);

    await client.query('COMMIT');
    return { success: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}

async function rejectJoinRequest(callerWallet, inviteId) {
  const inv = await pool.query(
    "SELECT guild_id, invited_wallet, invited_by FROM guild_invites WHERE id = $1 AND status = 'pending'",
    [inviteId]
  );
  if (!inv.rows.length) return { error: 'Request not found' };
  const { guild_id, invited_wallet, invited_by } = inv.rows[0];
  if (invited_wallet !== invited_by) return { error: 'Not a join request' };
  const role = await pool.query(
    'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2',
    [guild_id, callerWallet]
  );
  if (!role.rows.length || role.rows[0].role === 'member') {
    return { error: 'Only leader/officers can reject' };
  }
  await pool.query("UPDATE guild_invites SET status = 'declined' WHERE id = $1", [inviteId]);
  return { success: true };
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

// ═══════════════════════════════════════
//  SEARCH GUILDS (by id / tag / name)
// ═══════════════════════════════════════
//  Free-text search used by the "join guild" screen.  Accepts a numeric id,
//  a guild tag (exact or prefix), or a partial guild name (case-insensitive).
//  Results are ranked: id exact > tag exact > tag prefix > name contains,
//  then by total_pixels desc, and capped to `limit`.
async function searchGuilds(query, limit = 20) {
  const q = (query || '').trim();
  if (!q) return [];
  const cap = Math.min(parseInt(limit) || 20, 50);
  const like = '%' + q.replace(/[%_]/g, '\\$&') + '%';
  const asNum = /^\d+$/.test(q) ? parseInt(q) : null;

  const res = await pool.query(
    `SELECT g.id, g.name, g.tag, g.emblem_emoji, g.emblem_image, g.member_count, g.total_pixels,
            g.description, g.level, g.created_at,
            u.nickname AS leader_nickname,
            CASE
              WHEN $2::int IS NOT NULL AND g.id = $2::int THEN 0
              WHEN LOWER(g.tag) = LOWER($1) THEN 1
              WHEN LOWER(g.tag) LIKE LOWER($1) || '%' THEN 2
              WHEN LOWER(g.name) = LOWER($1) THEN 3
              WHEN LOWER(g.name) LIKE LOWER($3) THEN 4
              ELSE 5
            END AS rank_score
     FROM guilds g
     LEFT JOIN users u ON u.wallet_address = g.leader_wallet
     WHERE ($2::int IS NOT NULL AND g.id = $2::int)
        OR LOWER(g.tag) LIKE LOWER($1) || '%'
        OR LOWER(g.name) LIKE LOWER($3)
     ORDER BY rank_score ASC, g.total_pixels DESC NULLS LAST
     LIMIT $4`,
    [q, asNum, like, cap]
  );
  return res.rows.map(r => ({
    id: r.id, name: r.name, tag: r.tag,
    emblem: r.emblem_emoji, emblemImage: r.emblem_image || null,
    memberCount: r.member_count, totalPixels: r.total_pixels,
    description: r.description || '',
    level: r.level || 1,
    leaderNickname: r.leader_nickname,
    createdAt: r.created_at
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
//  `pct%` of the gross PP reward → converted to GP at exchange rate
//  → credited to guild GP treasury. Returns { contributed (PP), remaining (PP) }.
//  Pct is per-member (users set it themselves 0–max% via slider).
//
async function contributeHarvest(client, wallet, grossPP) {
  if (!grossPP || grossPP <= 0) return { contributed: 0, remaining: grossPP };
  try {
    const memRes = await client.query(
      `SELECT gm.guild_id, gm.gp_contribution_pct
       FROM guild_members gm
       WHERE gm.wallet = $1`,
      [wallet]
    );
    if (!memRes.rows.length) return { contributed: 0, remaining: grossPP };
    const { guild_id, gp_contribution_pct } = memRes.rows[0];
    const pct = Math.max(0, Math.min(30, parseInt(gp_contribution_pct || 0)));
    if (pct === 0) return { contributed: 0, remaining: grossPP };

    const ppCut = Math.round(grossPP * pct / 100 * 1000000) / 1000000;
    if (ppCut <= 0) return { contributed: 0, remaining: grossPP };

    // Convert PP contribution to GP (rate from settings, default 100)
    const ppToGpRate = parseFloat(await getSetting('pp_to_gp_exchange_rate') || '4');
    const gpCredit = Math.floor(ppCut * ppToGpRate);
    if (gpCredit <= 0) return { contributed: 0, remaining: grossPP };

    // Credit GP treasury + ledger
    const upd = await client.query(
      `UPDATE guilds SET gp_treasury = COALESCE(gp_treasury, 0) + $1
       WHERE id = $2 RETURNING gp_treasury`,
      [gpCredit, guild_id]
    );
    const balance = parseFloat(upd.rows[0]?.gp_treasury || 0);
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
       VALUES ($1, $2, 'harvest_contrib', $3, $4, $5)`,
      [guild_id, wallet, gpCredit, balance, `${pct}% harvest → ${ppCut.toFixed(4)} PP → ${gpCredit} GP`]
    );
    await client.query(
      `UPDATE guild_members SET total_contributed = COALESCE(total_contributed, 0) + $1
       WHERE guild_id = $2 AND wallet = $3`,
      [ppCut, guild_id, wallet]
    );
    return { contributed: ppCut, remaining: grossPP - ppCut, guildId: guild_id };
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
    `UPDATE guild_members SET gp_contribution_pct = $1 WHERE wallet = $2 RETURNING guild_id`,
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
      'SELECT level, gp_treasury FROM guilds WHERE id = $1 FOR UPDATE',
      [guildId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return { error: 'Guild not found' }; }
    const curLvl = parseInt(gRes.rows[0].level || 1);
    const treasury = parseFloat(gRes.rows[0].gp_treasury || 0);
    const maxLvl = parseInt(await getSetting('guild_level_max') || '6');
    if (curLvl >= maxLvl) { await client.query('ROLLBACK'); return { error: 'Already at max level' }; }

    const nextLvl = curLvl + 1;
    const costKey = `guild_level_${nextLvl}_cost_gp`;
    const cost = parseFloat(await getSetting(costKey) || '0');
    if (cost <= 0) { await client.query('ROLLBACK'); return { error: 'Level cost not configured' }; }
    if (treasury < cost) { await client.query('ROLLBACK'); return { error: `Need ${cost} GP in treasury. Have ${treasury.toFixed(2)}.` }; }

    // Deduct + upgrade
    await client.query(
      'UPDATE guilds SET gp_treasury = gp_treasury - $1, level = $2 WHERE id = $3',
      [cost, nextLvl, guildId]
    );
    const newBal = treasury - cost;
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
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
  const costSetting = `guild_research_${researchKey}_gp`;
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
      'SELECT gp_treasury, research_flags FROM guilds WHERE id = $1 FOR UPDATE',
      [guildId]
    );
    if (!gRes.rows.length) { await client.query('ROLLBACK'); return { error: 'Guild not found' }; }
    const treasury = parseFloat(gRes.rows[0].gp_treasury || 0);
    const flags = gRes.rows[0].research_flags || {};
    if (flags[researchKey]) { await client.query('ROLLBACK'); return { error: 'Already unlocked' }; }
    if (treasury < cost) { await client.query('ROLLBACK'); return { error: `Need ${cost} GP. Have ${treasury.toFixed(2)}.` }; }

    flags[researchKey] = true;
    await client.query(
      `UPDATE guilds
         SET gp_treasury = gp_treasury - $1,
             research_flags = $2::jsonb
       WHERE id = $3`,
      [cost, JSON.stringify(flags), guildId]
    );
    const newBal = treasury - cost;
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
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
    `SELECT l.id, l.wallet, l.kind, l.delta_gp, l.balance_after, l.memo, l.created_at,
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
    deltaGP: parseFloat(row.delta_gp),
    balanceAfter: parseFloat(row.balance_after),
    memo: row.memo,
    at: row.created_at
  }));
}

// ═══════════════════════════════════════
//  RESEARCH EFFECTS — query bonuses for a wallet
// ═══════════════════════════════════════

async function getResearchBonuses(wallet) {
  const bonuses = {
    mining: 0,        // +% harvest PP
    defense: 0,       // +% defense (reduces invasion success against)
    diplomatic: 0,    // -% invasion success against members
    exploration: 0,   // +% exploration rewards
    speed: 0,         // -% mission travel time
    logistics: 0,     // -% claim costs
    dominion: 0       // +% all bonuses
  };
  try {
    const r = await pool.query(
      `SELECT g.research_flags FROM guilds g
       JOIN guild_members gm ON gm.guild_id = g.id
       WHERE gm.wallet = $1`, [wallet]
    );
    if (!r.rows.length) return bonuses;
    const flags = r.rows[0].research_flags || {};

    if (flags.mining_eff_1) bonuses.mining = parseFloat(await getSetting('guild_research_mining_eff_1_bonus') || '3');
    if (flags.shield_disc) bonuses.defense = parseFloat(await getSetting('guild_research_shield_disc_bonus') || '15');
    if (flags.diplomatic) bonuses.diplomatic = parseFloat(await getSetting('guild_research_diplomatic_bonus') || '10');
    if (flags.orbital_scan) bonuses.exploration = parseFloat(await getSetting('guild_research_orbital_scan_bonus') || '15');
    if (flags.rapid_deploy) bonuses.speed = parseFloat(await getSetting('guild_research_rapid_deploy_bonus') || '20');
    if (flags.logistics) bonuses.logistics = parseFloat(await getSetting('guild_research_logistics_bonus') || '10');
    if (flags.mars_dominion) {
      bonuses.dominion = parseFloat(await getSetting('guild_research_mars_dominion_bonus') || '5');
      // Mars Dominion stacks on top of all other bonuses
      bonuses.mining += bonuses.dominion;
      bonuses.defense += bonuses.dominion;
      bonuses.diplomatic += bonuses.dominion;
      bonuses.exploration += bonuses.dominion;
      bonuses.speed += bonuses.dominion;
      bonuses.logistics += bonuses.dominion;
    }
  } catch (e) { console.warn('[GUILD] getResearchBonuses:', e.message); }
  return bonuses;
}

// ═══════════════════════════════════════
//  GUILD WARS
// ═══════════════════════════════════════

async function declareWar(wallet, guildId, targetGuildId) {
  if (guildId === targetGuildId) return { error: 'Cannot declare war on your own guild' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify caller is leader/officer
    const mem = await client.query(
      'SELECT role FROM guild_members WHERE guild_id = $1 AND wallet = $2', [guildId, wallet]
    );
    if (!mem.rows.length || mem.rows[0].role === 'member') {
      await client.query('ROLLBACK');
      return { error: 'Only leader or officers can declare war' };
    }

    // Check min members
    const minMembers = parseInt(await getSetting('guild_war_min_members') || '3');
    const memCount = await client.query('SELECT COUNT(*)::int AS cnt FROM guild_members WHERE guild_id = $1', [guildId]);
    if (memCount.rows[0].cnt < minMembers) {
      await client.query('ROLLBACK');
      return { error: `Need at least ${minMembers} members to declare war` };
    }

    // Check target guild exists
    const tg = await client.query('SELECT id, name, member_count FROM guilds WHERE id = $1', [targetGuildId]);
    if (!tg.rows.length) { await client.query('ROLLBACK'); return { error: 'Target guild not found' }; }

    // Check max active wars
    const maxActive = parseInt(await getSetting('guild_war_max_active') || '1');
    const activeWars = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM guild_wars
       WHERE status IN ('declared','active')
         AND (attacker_guild_id = $1 OR defender_guild_id = $1)`,
      [guildId]
    );
    if (activeWars.rows[0].cnt >= maxActive) {
      await client.query('ROLLBACK');
      return { error: `Already in ${maxActive} active war(s)` };
    }

    // Check cooldown between same guilds
    const cooldown = parseInt(await getSetting('guild_war_cooldown_hours') || '48');
    const recentWar = await client.query(
      `SELECT id FROM guild_wars
       WHERE ((attacker_guild_id = $1 AND defender_guild_id = $2)
           OR (attacker_guild_id = $2 AND defender_guild_id = $1))
         AND created_at > NOW() - INTERVAL '1 hour' * $3
       LIMIT 1`,
      [guildId, targetGuildId, cooldown]
    );
    if (recentWar.rows.length) {
      await client.query('ROLLBACK');
      return { error: `War cooldown: wait ${cooldown}h between wars with the same guild` };
    }

    // Check defender max active wars
    const defenderWars = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM guild_wars
       WHERE status IN ('declared','active')
         AND (attacker_guild_id = $1 OR defender_guild_id = $1)`,
      [targetGuildId]
    );
    if (defenderWars.rows[0].cnt >= maxActive) {
      await client.query('ROLLBACK');
      return { error: 'Target guild is already in an active war' };
    }

    // Deduct GP from treasury
    const cost = parseFloat(await getSetting('guild_war_declare_cost_gp') || '200');
    const gRes = await client.query('SELECT gp_treasury FROM guilds WHERE id = $1 FOR UPDATE', [guildId]);
    const treasury = parseFloat(gRes.rows[0]?.gp_treasury || 0);
    if (treasury < cost) {
      await client.query('ROLLBACK');
      return { error: `Need ${cost} GP in treasury. Have ${treasury.toFixed(0)}.` };
    }

    await client.query('UPDATE guilds SET gp_treasury = gp_treasury - $1 WHERE id = $2', [cost, guildId]);
    const newBal = treasury - cost;
    await client.query(
      `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
       VALUES ($1, $2, 'war_declare', $3, $4, $5)`,
      [guildId, wallet, -cost, newBal, `War declared vs guild #${targetGuildId} (-${cost} GP)`]
    );

    // Create war — starts immediately
    const durHours = parseInt(await getSetting('guild_war_duration_hours') || '24');
    const war = await client.query(
      `INSERT INTO guild_wars (attacker_guild_id, defender_guild_id, declared_by, status, war_start, war_end, duration_hours)
       VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '1 hour' * $4, $4)
       RETURNING *`,
      [guildId, targetGuildId, wallet, durHours]
    );

    await client.query('COMMIT');
    console.log(`[GUILD WAR] #${guildId} declared war on #${targetGuildId} by ${wallet} (-${cost} GP)`);
    return { success: true, war: war.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    return { error: e.message };
  } finally { client.release(); }
}

async function getActiveWars(guildId) {
  const r = await pool.query(
    `SELECT w.*,
            ag.name AS attacker_name, ag.tag AS attacker_tag, ag.emblem_emoji AS attacker_emblem,
            dg.name AS defender_name, dg.tag AS defender_tag, dg.emblem_emoji AS defender_emblem
     FROM guild_wars w
     JOIN guilds ag ON ag.id = w.attacker_guild_id
     JOIN guilds dg ON dg.id = w.defender_guild_id
     WHERE w.status IN ('declared','active')
       AND (w.attacker_guild_id = $1 OR w.defender_guild_id = $1)
     ORDER BY w.created_at DESC`,
    [guildId]
  );
  return r.rows;
}

async function getWarHistory(guildId, limit = 20) {
  const r = await pool.query(
    `SELECT w.*,
            ag.name AS attacker_name, ag.tag AS attacker_tag,
            dg.name AS defender_name, dg.tag AS defender_tag
     FROM guild_wars w
     JOIN guilds ag ON ag.id = w.attacker_guild_id
     JOIN guilds dg ON dg.id = w.defender_guild_id
     WHERE w.status = 'resolved'
       AND (w.attacker_guild_id = $1 OR w.defender_guild_id = $1)
     ORDER BY w.war_end DESC
     LIMIT $2`,
    [guildId, limit]
  );
  return r.rows;
}

async function recordWarAction(wallet, actionType, points, meta) {
  try {
    // Find player's guild
    const gm = await pool.query('SELECT guild_id FROM guild_members WHERE wallet = $1', [wallet]);
    if (!gm.rows.length) return null;
    const guildId = gm.rows[0].guild_id;

    // Find active war involving this guild
    const war = await pool.query(
      `SELECT id, attacker_guild_id, defender_guild_id FROM guild_wars
       WHERE status = 'active'
         AND (attacker_guild_id = $1 OR defender_guild_id = $1)
       LIMIT 1`,
      [guildId]
    );
    if (!war.rows.length) return null;
    const w = war.rows[0];

    // Record action
    await pool.query(
      `INSERT INTO guild_war_actions (war_id, guild_id, wallet, action_type, points, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [w.id, guildId, wallet, actionType, points, JSON.stringify(meta || {})]
    );

    // Update war scores
    const scoreCol = guildId === w.attacker_guild_id ? 'attacker_score' : 'defender_score';
    await pool.query(
      `UPDATE guild_wars SET ${scoreCol} = ${scoreCol} + $1 WHERE id = $2`,
      [points, w.id]
    );

    return { warId: w.id, guildId, points, side: scoreCol.replace('_score', '') };
  } catch (e) {
    console.warn('[GUILD WAR] recordWarAction:', e.message);
    return null;
  }
}

async function resolveExpiredWars() {
  const client = await pool.connect();
  try {
    const expired = await client.query(
      `SELECT * FROM guild_wars WHERE status = 'active' AND war_end <= NOW()`
    );
    for (const w of expired.rows) {
      try {
        await client.query('BEGIN');
        let winnerId = null;
        if (w.attacker_score > w.defender_score) winnerId = w.attacker_guild_id;
        else if (w.defender_score > w.attacker_score) winnerId = w.defender_guild_id;
        // else draw — no winner

        const rewardGP = parseFloat(await getSetting('guild_war_winner_gp') || '500');

        await client.query(
          `UPDATE guild_wars SET status = 'resolved', winner_guild_id = $1, reward_pp = $2 WHERE id = $3`,
          [winnerId, winnerId ? rewardGP : 0, w.id]
        );

        // Award GP to winner's treasury
        if (winnerId && rewardGP > 0) {
          await client.query('UPDATE guilds SET gp_treasury = gp_treasury + $1 WHERE id = $2', [rewardGP, winnerId]);
          await client.query(
            `INSERT INTO guild_treasury_ledger (guild_id, wallet, kind, delta_gp, balance_after, memo)
             VALUES ($1, 'system', 'war_reward', $2,
                     (SELECT gp_treasury FROM guilds WHERE id = $1), $3)`,
            [winnerId, rewardGP, `War victory GP reward (War #${w.id})`]
          );
        }
        await client.query('COMMIT');
        console.log(`[GUILD WAR] #${w.id} resolved. Winner: ${winnerId || 'draw'}. Score: ${w.attacker_score}-${w.defender_score}`);
      } catch (warErr) {
        await client.query('ROLLBACK');
        console.error(`[GUILD WAR] Failed to resolve war #${w.id}:`, warErr.message);
      }
    }
    return expired.rows.length;
  } catch (e) {
    console.error('[GUILD WAR] resolveExpiredWars:', e.message);
    return 0;
  } finally { client.release(); }
}

async function getWarLeaderboard(warId) {
  const r = await pool.query(
    `SELECT wa.wallet, u.nickname, wa.guild_id, g.tag AS guild_tag,
            SUM(wa.points)::int AS total_points, COUNT(*)::int AS actions
     FROM guild_war_actions wa
     JOIN users u ON u.wallet_address = wa.wallet
     JOIN guilds g ON g.id = wa.guild_id
     WHERE wa.war_id = $1
     GROUP BY wa.wallet, u.nickname, wa.guild_id, g.tag
     ORDER BY total_points DESC
     LIMIT 20`,
    [warId]
  );
  return r.rows;
}

// ═══════════════════════════════════════
//  GUILD WAR MINIGAME SCORE SUBMISSION
// ═══════════════════════════════════════

const VALID_GAME_TYPES = ['invaders', 'runner', 'digger'];

async function submitGameScore(wallet, warId, gameType, score) {
  if (!VALID_GAME_TYPES.includes(gameType)) {
    return { error: `Invalid game type. Must be one of: ${VALID_GAME_TYPES.join(', ')}` };
  }
  score = parseInt(score);
  if (!score || score < 1) return { error: 'Score must be a positive integer' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate war exists and is active
    const warRes = await client.query(
      'SELECT * FROM guild_wars WHERE id = $1 AND status = $2 FOR UPDATE',
      [warId, 'active']
    );
    if (!warRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'War not found or not active' };
    }
    const war = warRes.rows[0];

    // Validate player is in a guild participating in this war
    const gmRes = await client.query('SELECT guild_id FROM guild_members WHERE wallet = $1', [wallet]);
    if (!gmRes.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'You are not in a guild' };
    }
    const guildId = gmRes.rows[0].guild_id;
    if (guildId !== war.attacker_guild_id && guildId !== war.defender_guild_id) {
      await client.query('ROLLBACK');
      return { error: 'Your guild is not participating in this war' };
    }

    // Check daily play limit (all minigame types combined for this wallet+war today)
    const maxPlays = parseInt(await getSetting('guild_war_game_plays_per_day') || '3');
    const todayPlays = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM guild_war_actions
       WHERE war_id = $1 AND wallet = $2
         AND action_type LIKE 'minigame_%'
         AND created_at >= CURRENT_DATE`,
      [warId, wallet]
    );
    const playCount = todayPlays.rows[0].cnt;
    if (playCount >= maxPlays) {
      await client.query('ROLLBACK');
      return { error: `Daily play limit reached (${maxPlays} per day). Try again tomorrow.` };
    }

    // Apply score multiplier
    const multiplier = parseFloat(await getSetting('guild_war_game_score_multiplier') || '1');
    const points = Math.round(score * multiplier);

    // Insert action
    const actionType = 'minigame_' + gameType;
    await client.query(
      `INSERT INTO guild_war_actions (war_id, guild_id, wallet, action_type, points, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [warId, guildId, wallet, actionType, points, JSON.stringify({ rawScore: score, multiplier, gameType })]
    );

    // Update war score
    const scoreCol = guildId === war.attacker_guild_id ? 'attacker_score' : 'defender_score';
    await client.query(
      `UPDATE guild_wars SET ${scoreCol} = ${scoreCol} + $1 WHERE id = $2`,
      [points, warId]
    );

    await client.query('COMMIT');

    const playsRemaining = maxPlays - playCount - 1;

    // Get total score for this player in this war
    const totalRes = await pool.query(
      `SELECT COALESCE(SUM(points),0)::int AS total FROM guild_war_actions
       WHERE war_id = $1 AND wallet = $2 AND action_type LIKE 'minigame_%'`,
      [warId, wallet]
    );

    console.log(`[GUILD WAR MINIGAME] ${wallet} scored ${points} pts (${gameType}) in war #${warId}`);
    return {
      success: true,
      points,
      totalScore: totalRes.rows[0].total,
      playsRemaining
    };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[GUILD WAR MINIGAME] submitGameScore:', e.message);
    return { error: e.message };
  } finally { client.release(); }
}

async function getWarScoreboard(warId) {
  // Get war info
  const warRes = await pool.query(
    `SELECT w.*, ag.name AS attacker_name, ag.tag AS attacker_tag,
            dg.name AS defender_name, dg.tag AS defender_tag
     FROM guild_wars w
     JOIN guilds ag ON ag.id = w.attacker_guild_id
     JOIN guilds dg ON dg.id = w.defender_guild_id
     WHERE w.id = $1`,
    [warId]
  );
  if (!warRes.rows.length) return { error: 'War not found' };
  const war = warRes.rows[0];

  // Per-guild total scores (all actions)
  const guildScores = {
    attacker: { guildId: war.attacker_guild_id, name: war.attacker_name, tag: war.attacker_tag, score: war.attacker_score },
    defender: { guildId: war.defender_guild_id, name: war.defender_name, tag: war.defender_tag, score: war.defender_score }
  };

  // Individual top players (minigame only)
  const topPlayers = await pool.query(
    `SELECT wa.wallet, u.nickname, wa.guild_id, g.tag AS guild_tag,
            SUM(wa.points)::int AS total_points, COUNT(*)::int AS plays
     FROM guild_war_actions wa
     JOIN users u ON u.wallet_address = wa.wallet
     JOIN guilds g ON g.id = wa.guild_id
     WHERE wa.war_id = $1 AND wa.action_type LIKE 'minigame_%'
     GROUP BY wa.wallet, u.nickname, wa.guild_id, g.tag
     ORDER BY total_points DESC
     LIMIT 20`,
    [warId]
  );

  // Game-type breakdown
  const gameBreakdown = await pool.query(
    `SELECT wa.action_type, wa.guild_id, g.tag AS guild_tag,
            SUM(wa.points)::int AS total_points, COUNT(*)::int AS plays
     FROM guild_war_actions wa
     JOIN guilds g ON g.id = wa.guild_id
     WHERE wa.war_id = $1 AND wa.action_type LIKE 'minigame_%'
     GROUP BY wa.action_type, wa.guild_id, g.tag
     ORDER BY wa.action_type, total_points DESC`,
    [warId]
  );

  return {
    war: { id: war.id, status: war.status, warStart: war.war_start, warEnd: war.war_end },
    guildScores,
    topPlayers: topPlayers.rows,
    gameBreakdown: gameBreakdown.rows
  };
}

module.exports = {
  createGuild, getGuild, getGuildByWallet,
  inviteMember, acceptInvite, declineInvite, getMyInvites, searchUsersForInvite,
  createJoinRequest, getGuildJoinRequests, approveJoinRequest, rejectJoinRequest,
  leaveGuild, kickMember,
  promoteToOfficer, demoteToMember, transferLeadership, disbandGuild,
  getGuildLeaderboard, searchGuilds, refreshGuildPixelCount,
  updateGuildInfo,
  sendGuildMessage, getGuildMessages,
  // Upgrades (migration 058)
  contributeHarvest, setContributionPct,
  upgradeGuildLevel, getGuildMaxMembers,
  unlockResearch, getTreasuryLedger,
  // Research effects (migration 067)
  getResearchBonuses,
  // Guild Wars (migration 067)
  declareWar, getActiveWars, getWarHistory,
  recordWarAction, resolveExpiredWars, getWarLeaderboard,
  // Guild War Minigames (migration 070)
  submitGameScore, getWarScoreboard
};

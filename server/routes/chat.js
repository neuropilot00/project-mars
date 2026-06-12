const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const requireAuth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
};

function isValidChannel(channel) {
  return channel === 'global' || /^sector:[a-z0-9_]+$/.test(channel);
}

router.get('/chat/messages', async (req, res) => {
  try {
    const channel = String(req.query.channel || 'global').trim();
    if (!isValidChannel(channel)) return res.status(400).json({ error: 'invalid_channel' });

    const params = [channel];
    let where = 'WHERE channel = $1';
    if (req.query.since_id || req.query.sinceId) {
      const sinceId = parseInt(req.query.since_id || req.query.sinceId, 10);
      if (!Number.isFinite(sinceId) || sinceId < 0) return res.status(400).json({ error: 'invalid_since_id' });
      params.push(sinceId);
      where += ' AND id > $2';
      const { rows } = await pool.query(
        `SELECT id, wallet, nickname, channel, message, created_at
         FROM chat_messages
         ${where}
         ORDER BY id ASC
         LIMIT 50`,
        params
      );
      return res.json({ messages: rows });
    }
    if (req.query.since) {
      // incremental poll: only new messages after cursor, ASC order
      params.push(req.query.since);
      where += ' AND created_at > $2';
      const { rows } = await pool.query(
        `SELECT id, wallet, nickname, channel, message, created_at
         FROM chat_messages
         ${where}
         ORDER BY created_at ASC
         LIMIT 50`,
        params
      );
      return res.json({ messages: rows });
    }

    // Initial load: fetch recent rows, collapse repeated same-user same-message spam,
    // then return the latest 50 in ASC order for display.
    const { rows } = await pool.query(
      `SELECT id, wallet, nickname, channel, message, created_at
       FROM (
         SELECT DISTINCT ON (LOWER(wallet), message)
                id, wallet, nickname, channel, message, created_at
           FROM (
             SELECT id, wallet, nickname, channel, message, created_at
             FROM chat_messages
             WHERE channel = $1
             ORDER BY id DESC
             LIMIT 150
           ) recent
          ORDER BY LOWER(wallet), message, id DESC
       ) sub
       ORDER BY id ASC
       LIMIT 50`,
      params
    );
    return res.json({ messages: rows });
  } catch (err) {
    console.error('[chat] messages error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/chat/send', requireAuth, async (req, res) => {
  let client;
  try {
    const wallet = String(req.user?.wallet_address || req.user?.wallet || '').trim();
    const channel = String(req.body?.channel || 'global').trim();
    const message = String(req.body?.message || '').trim();

    if (!wallet) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!isValidChannel(channel)) return res.status(400).json({ error: 'invalid_channel' });
    if (!message || message.length > 200) return res.status(400).json({ error: 'invalid_message' });

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext(LOWER($1)), hashtext($2 || $3))',
      [wallet, channel, message]
    );

    const duplicate = await client.query(
      `SELECT id, wallet, nickname, channel, message, created_at
       FROM chat_messages
         WHERE LOWER(wallet) = LOWER($1)
           AND channel = $2
           AND message = $3
         AND created_at > NOW() - INTERVAL '10 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [wallet, channel, message]
    );
    if (duplicate.rows[0]) {
      await client.query('COMMIT');
      return res.json({ success: true, duplicate: true, message: duplicate.rows[0] });
    }

    const recent = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages
       WHERE LOWER(wallet) = LOWER($1)
         AND created_at > NOW() - INTERVAL '10 seconds'`,
      [wallet]
    );
    if ((recent.rows[0]?.count || 0) >= 3) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'rate_limit' });
    }

    const user = await client.query(
      'SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1',
      [wallet]
    );
    const nickname = user.rows[0]?.nickname || wallet.slice(0, 8);

    const { rows } = await client.query(
      `INSERT INTO chat_messages (wallet, nickname, channel, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, wallet, nickname, channel, message, created_at`,
      [wallet, nickname, channel, message]
    );
    await client.query('COMMIT');

    // WebSocket 실시간 푸시 (구독자에게 즉시 전달 — 채팅 폴링 부하 감소)
    try { require('../wsServer').broadcastChat(channel, rows[0]); } catch (_) {}

    return res.json({ success: true, message: rows[0] });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[chat] send error:', err);
    return res.status(500).json({ error: 'server_error' });
  } finally {
    if (client) client.release();
  }
});

router.get('/chat/channels', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT channel
       FROM chat_messages
       WHERE channel LIKE 'sector:%'
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY channel ASC`
    );
    const channels = [{ id: 'global', label: '🌐 전체' }];
    rows.forEach((row) => {
      channels.push({ id: row.channel, label: '📍 ' + row.channel.replace(/^sector:/, '') });
    });
    return res.json({ channels });
  } catch (err) {
    console.error('[chat] channels error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;

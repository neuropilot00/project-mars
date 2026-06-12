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

    // [Gemini review fix] initial load — fetch newest 50, return in ASC order for display
    const { rows } = await pool.query(
      `SELECT id, wallet, nickname, channel, message, created_at
       FROM (
         SELECT id, wallet, nickname, channel, message, created_at
         FROM chat_messages
         WHERE channel = $1
         ORDER BY created_at DESC
         LIMIT 50
       ) sub
       ORDER BY created_at ASC`,
      params
    );
    return res.json({ messages: rows });
  } catch (err) {
    console.error('[chat] messages error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/chat/send', requireAuth, async (req, res) => {
  try {
    const wallet = String(req.user?.wallet_address || req.user?.wallet || '').trim();
    const channel = String(req.body?.channel || 'global').trim();
    const message = String(req.body?.message || '').trim();

    if (!wallet) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!isValidChannel(channel)) return res.status(400).json({ error: 'invalid_channel' });
    if (!message || message.length > 200) return res.status(400).json({ error: 'invalid_message' });

    const duplicate = await pool.query(
      `SELECT id, wallet, nickname, channel, message, created_at
       FROM chat_messages
       WHERE wallet = $1
         AND channel = $2
         AND message = $3
         AND created_at > NOW() - INTERVAL '3 seconds'
       ORDER BY created_at DESC
       LIMIT 1`,
      [wallet, channel, message]
    );
    if (duplicate.rows[0]) {
      return res.json({ success: true, duplicate: true, message: duplicate.rows[0] });
    }

    const recent = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM chat_messages
       WHERE wallet = $1
         AND created_at > NOW() - INTERVAL '10 seconds'`,
      [wallet]
    );
    if ((recent.rows[0]?.count || 0) >= 3) return res.status(429).json({ error: 'rate_limit' });

    const user = await pool.query(
      'SELECT nickname FROM users WHERE LOWER(wallet_address) = LOWER($1) LIMIT 1',
      [wallet]
    );
    const nickname = user.rows[0]?.nickname || wallet.slice(0, 8);

    const { rows } = await pool.query(
      `INSERT INTO chat_messages (wallet, nickname, channel, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, wallet, nickname, channel, message, created_at`,
      [wallet, nickname, channel, message]
    );

    // WebSocket 실시간 푸시 (구독자에게 즉시 전달 — 채팅 폴링 부하 감소)
    try { require('../wsServer').broadcastChat(channel, rows[0]); } catch (_) {}

    return res.json({ success: true, message: rows[0] });
  } catch (err) {
    console.error('[chat] send error:', err);
    return res.status(500).json({ error: 'server_error' });
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

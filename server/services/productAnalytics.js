'use strict';

const crypto = require('crypto');
const { pool } = require('../db');

const EVENT_NAMES = new Set([
  'session_start', 'ui_view', 'first_battle_started', 'battle_ended',
  'second_battle_started', 'territory_captured', 'production_collected',
  'repair_completed', 'mission_completed', 'shop_view', 'cosmetic_purchased'
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeWallet(wallet) {
  return String(wallet || '').trim().toLowerCase();
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const json = JSON.stringify(metadata);
  if (Buffer.byteLength(json, 'utf8') > 2048) throw new Error('analytics metadata too large');
  return metadata;
}

// Call after the game transaction commits. Duplicate retries with the same eventKey
// are harmless, and AI/test-account rows remain available for audit but are excluded
// from every product-health aggregate.
async function recordProductEvent({ wallet, sessionId, eventName, eventKey, metadata = {}, source = 'server' }) {
  const address = normalizeWallet(wallet);
  const session = String(sessionId || '');
  const key = String(eventKey || crypto.randomUUID());
  if (!address || !UUID_RE.test(session) || !UUID_RE.test(key) || !EVENT_NAMES.has(eventName) || !['client', 'server'].includes(source)) {
    throw new Error('invalid product analytics event');
  }
  const safeMetadata = normalizeMetadata(metadata);
  const user = await pool.query(
    `SELECT wallet_address, COALESCE(is_ai, FALSE) AS actor_ai,
            COALESCE(is_test_account, FALSE) AS actor_test
       FROM users WHERE LOWER(wallet_address) = $1 LIMIT 1`,
    [address]
  );
  if (!user.rows[0]) return { recorded: false, reason: 'user_not_found' };
  const actor = user.rows[0];
  const result = await pool.query(
    `INSERT INTO product_analytics_events
       (event_key, wallet_address, session_id, event_name, source, actor_ai, actor_test, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [key, actor.wallet_address, session, eventName, source, actor.actor_ai, actor.actor_test, JSON.stringify(safeMetadata)]
  );
  return { recorded: result.rowCount === 1, duplicate: result.rowCount === 0 };
}

async function getProductAnalyticsSummary({ from, to }) {
  const daily = await pool.query(
    `SELECT created_at::date AS day,
            COUNT(DISTINCT wallet_address) FILTER (WHERE event_name <> 'session_start')::int AS dau,
            COUNT(DISTINCT session_id) FILTER (WHERE source = 'client')::int AS sessions,
            COUNT(*) FILTER (WHERE source = 'client' AND event_name = 'session_start')::int AS session_starts,
            COUNT(*)::int AS events
       FROM product_analytics_events
      WHERE created_at >= $1::date
        AND created_at < ($2::date + INTERVAL '1 day')
        AND actor_ai = FALSE AND actor_test = FALSE
      GROUP BY created_at::date
      ORDER BY day`,
    [from, to]
  );
  const funnel = await pool.query(
    `SELECT
       COUNT(DISTINCT wallet_address) FILTER (WHERE event_name = 'first_battle_started')::int AS first_battle_users,
       COUNT(DISTINCT wallet_address) FILTER (WHERE event_name = 'battle_ended')::int AS battle_ended_users,
       COUNT(DISTINCT wallet_address) FILTER (WHERE event_name = 'second_battle_started')::int AS second_battle_users,
       COUNT(*) FILTER (WHERE event_name = 'cosmetic_purchased')::int AS cosmetic_purchases,
       COUNT(DISTINCT wallet_address) FILTER (WHERE event_name = 'cosmetic_purchased')::int AS cosmetic_buyers
       FROM product_analytics_events
      WHERE created_at >= $1::date
        AND created_at < ($2::date + INTERVAL '1 day')
        AND actor_ai = FALSE AND actor_test = FALSE`,
    [from, to]
  );
  return { daily: daily.rows, funnel: funnel.rows[0] };
}

module.exports = { EVENT_NAMES, UUID_RE, recordProductEvent, getProductAnalyticsSummary };

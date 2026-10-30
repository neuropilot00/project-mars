// server/wsServer.js
// ─────────────────────────────────────────────────────────────
// WebSocket 서버 — battle 별 채널 + frame broadcast (Phase 2)
//
// 사용:
//   const { attachWsServer, broadcastBattleFrame } = require('./wsServer');
//   const httpServer = http.createServer(app);
//   attachWsServer(httpServer);
//
// 클라이언트 흐름:
//   ws://host/ws/battle/{battleId}?token={JWT}
//   서버 → 클라: { type:'frame', tick, ships, fleets, events }
//   서버 → 클라: { type:'end',   winner_side, summary }
//   클라 → 서버: { type:'cmd',   cmd:'formation', payload:{formation:'wedge'} }
// ─────────────────────────────────────────────────────────────

const { WebSocketServer } = require('ws');
const url = require('url');
const { randomUUID } = require('crypto');
const totpSessionBoundary = require('./utils/totpSessionBoundary');

function _commandAck(ws, cmd, commandId, error, extra) {
  _safeSendOrTerminate(ws, JSON.stringify({
    type: error ? 'cmd_err' : 'cmd_ok', cmd, commandId,
    status: error ? 'rejected' : 'accepted', reason: error || null,
    ...(error ? { error } : {}), ...extra,
  }));
}

// PostgreSQL BIGINT ids arrive as strings; URL/Redis callers must use the same
// key without Number rounding. Reject values that cannot identify a DB row.
function _battleKey(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  if (!['string', 'number', 'bigint'].includes(typeof value)) return null;
  const text = String(value);
  if (!/^\d+$/.test(text) || text.length > 19) return null;
  const id = BigInt(text);
  return id > 0n && id <= 9223372036854775807n ? id.toString() : null;
}

// canonical decimal battle_id string -> Set<WebSocket>
const _channels = new Map();
// 라이브(채팅/활동피드) 연결 — 각 ws.subs(Set) 로 구독 채널 추적
const _live = new Set();
let _wss = null;

// ── WS 연결 수 제한 (DoS 방어) ── upgrade 는 express rate limiter 밖이라 자체 캡 필요.
const WS_MAX_TOTAL = parseInt(process.env.WS_MAX_TOTAL || '20000', 10) || 20000;
const WS_MAX_PER_IP = parseInt(process.env.WS_MAX_PER_IP || '50', 10) || 50;
const _ipConns = new Map(); // ip -> count
function _clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || 'unknown';
}
function _totalConns() { return _live.size + (() => { let n = 0; for (const s of _channels.values()) n += s.size; return n; })(); }
function _admitConn(req) {
  if (_totalConns() >= WS_MAX_TOTAL) return false;
  const ip = _clientIp(req);
  const c = _ipConns.get(ip) || 0;
  if (c >= WS_MAX_PER_IP) return false;
  _ipConns.set(ip, c + 1);
  return true;
}
function _releaseConn(ip) {
  if (!ip) return;
  const c = (_ipConns.get(ip) || 1) - 1;
  if (c <= 0) _ipConns.delete(ip); else _ipConns.set(ip, c);
}

function attachWsServer(httpServer) {
  if (_wss) return _wss;
  _wss = new WebSocketServer({ noServer: true });
  _initRedisPubSub();  // 멀티 인스턴스 팬아웃 (REDIS_URL 있을 때만; 없으면 로컬 전용)

  httpServer.on('upgrade', async (req, socket, head) => {
    const parsed = url.parse(req.url, true);
    const path = parsed.pathname || '';
    const isBattle = /^\/ws\/battle\/(\d+)$/.exec(path);
    const isLive = path === '/ws/live';
    if (!isBattle && !isLive) { socket.destroy(); return; }
    // DoS 방어: 전역/IP별 연결 상한 초과 시 거부
    if (!_admitConn(req)) { try { socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n'); } catch (_) {} socket.destroy(); return; }
    const ip = _clientIp(req);
    // [v7.189 fix] upgrade 실패 시 _releaseConn 누수 차단 — handleUpgrade 콜백이 호출되지 않거나
    //   socket 이 즉시 종료되면 ws 'close' 핸들러도 안 붙어 _ipConns 카운터 영구 증가 → IP 차단됨.
    //   socket-level close/error 에서 release. handleUpgrade 콜백이 성공하면 _upgraded=true 로 표시하고
    //   release 책임은 ws.on('close') 로 이관. 한 connection 당 _releaseConn 정확히 1회 보장.
    const _upgradeGuard = { upgraded: false, released: false };
    const _socketRelease = () => {
      if (_upgradeGuard.upgraded || _upgradeGuard.released) return;
      _upgradeGuard.released = true;
      _releaseConn(ip);
    };
    socket.once('close', _socketRelease);
    socket.once('error', _socketRelease);
    let session;
    try { session = await totpSessionBoundary.validateToken(parsed.query.token); }
    catch (_) { _socketRelease(); socket.destroy(); return; }
    if (socket.destroyed) { _socketRelease(); return; }
    if (session.revoked) {
      try { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); } catch (_) {}
      _socketRelease(); socket.destroy(); return;
    }
    if (isBattle) {
      const battleId = _battleKey(isBattle[1]);
      if (!battleId) { socket.destroy(); return; }
      const wallet = session.wallet; // Invalid legacy tokens retain spectator access.
      _wss.handleUpgrade(req, socket, head, (ws) => {
        _upgradeGuard.upgraded = true; // [v7.189] socket-level release 비활성화 — ws.close 가 release 담당
        ws.battleId = battleId; ws.wallet = wallet; ws._ip = ip;
        ws.battleWireGzip = parsed.query.wire === 'gzip-v1' || parsed.query.wire === 'gzip-v2';
        ws.battleWireDigest = parsed.query.wire === 'gzip-v2';
        if (typeof parsed.query.resume === 'string' && parsed.query.resume.length <= 4096) {
          try {
            const cursor = JSON.parse(parsed.query.resume);
            if (cursor && typeof cursor.epoch === 'string' && cursor.epoch.length <= 80 &&
                Number.isSafeInteger(cursor.seq) && cursor.seq >= 0) ws._battleResume = cursor;
          } catch (_) {}
        }
        ws._battleCursor = ws._battleResume || null;
        ws._battleAppliedCursor = ws._battleResume || null;
        ws.totpToken = session.totp ? parsed.query.token : null;
        _wss.emit('connection', ws, req);
      });
      return;
    }
    // 라이브 채널: /ws/live (채팅 + 활동피드 푸시)
    const wallet = session.wallet;
    _wss.handleUpgrade(req, socket, head, (ws) => {
      _upgradeGuard.upgraded = true; // [v7.189] 동일 — ws.close release 로 이관
      ws.isLive = true; ws.wallet = wallet; ws.subs = new Set(); ws._ip = ip;
      ws.totpToken = session.totp ? parsed.query.token : null;
      _wss.emit('connection', ws, req);
    });
  });

  _wss.on('connection', (ws) => {
    if (ws.isLive) { _handleLive(ws); return; }
    const bid = ws.battleId;
    if (!_channels.has(bid)) _channels.set(bid, new Set());
    _channels.get(bid).add(ws);
    if (_channels.get(bid).size === 1) _battlePresence(bid, true);

    ws.send(JSON.stringify({ type: 'hello', battleId: bid, wallet: ws.wallet || null }));
    if (ws._battleResume) _requestBattleSync(bid, ws, ws._battleResume);
    // A spectator who reconnects after cancellation must not remain in a queue forever.
    require('./db').pool.query('SELECT status FROM fleet_battles WHERE id=$1', [bid])
      .then(({ rows }) => { if (rows[0]?.status === 'cancelled') _safeSendOrTerminate(ws, JSON.stringify({ type: 'queue', battleId: bid, reason: 'battle_cancelled' })); })
      .catch(() => {});

    ws.on('message', async (raw) => {
      if (raw.length > 16384) return;
      let msg = null;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (!msg || !msg.type) return;
      if (msg.type === 'frame_ack') {
        if (!ws.battleWireDigest || !msg.cursor || typeof msg.cursor.epoch !== 'string' || !Number.isSafeInteger(msg.cursor.seq)) return;
        const sent = ws._battleSentCursors?.get(`${msg.cursor.epoch}:${msg.cursor.seq}`);
        if (!sent || sent.proof !== msg.cursor.proof || sent.epoch !== ws._battleCursor?.epoch) return;
        const previous = ws._battleAppliedCursor;
        if (previous && previous.epoch === sent.epoch && previous.seq >= sent.seq) return;
        ws._battleAppliedCursor = sent;
        // A frame applied during recovery changes the exact missing range.
        if (ws._battleSyncWaiting) {
          _removeSocketFromSync(ws); ws._battleSyncWaiting = false; ws._battleSyncId = null;
          _requestBattleSync(bid, ws, sent);
        }
        return;
      }
      if (msg.type === 'cmd') {
        const commandId = typeof msg.commandId === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(msg.commandId)
          ? msg.commandId : randomUUID();
        if (ws.totpToken) {
          const current = await totpSessionBoundary.validateToken(ws.totpToken);
          if (current.revoked || !current.wallet) {
            try { ws.close(1008, 'session_expired'); } catch (_) {}
            return;
          }
        }
        // 부모 (commander_actions) 로 전달 — 인증된 wallet 만
        if (!ws.wallet) {
          _commandAck(ws, msg.cmd, commandId, 'wallet_required');
          return;
        }
        if (ws._battleSyncWaiting) { _commandAck(ws, msg.cmd, commandId, 'delivery_unavailable'); return; }
        // [Phase 3 실시간] 라이브 전투 진행 중이면 실시간 명령 큐로 라우팅 (commanderActions 는 pre-battle 전용).
        //   소유권(participant 함대) 검증 + rate limit(기본 3/s). 단일 인스턴스: 권위 워커=WS 워커 동일.
        try {
          const liveBattle = require('./services/liveBattle');
          if (process.env.REDIS_URL && !_redisReady && !liveBattle.isActive(bid)) {
            _commandAck(ws, msg.cmd, commandId, 'delivery_unavailable'); return;
          }
          if (liveBattle.isActive(bid) || _redisReady) {
            const now = Date.now();
            ws._cmdTimes = (ws._cmdTimes || []).filter((t) => now - t < 1000);
            if (ws._cmdTimes.length >= 3) { _commandAck(ws, msg.cmd, commandId, 'rate_limited'); return; }
            ws._cmdTimes.push(now);
            const fleetId = msg.payload && msg.payload.fleetId;
            if (!fleetId) { _commandAck(ws, msg.cmd, commandId, 'fleetId_required'); return; }
            const action = (msg.cmd === 'maneuver') ? 'maneuver' : (msg.cmd === 'focus') ? 'focus' : (msg.cmd === 'formation') ? 'formation'
              : (msg.cmd === 'beam') ? 'beam' : (msg.cmd === 'missile') ? 'missile' : (msg.cmd === 'overdrive') ? 'overdrive'
              : ['move', 'hold', 'auto'].includes(msg.cmd) ? msg.cmd : null;
            if (!action) { _commandAck(ws, msg.cmd, commandId, 'unsupported_live_cmd'); return; }
            const { pool } = require('./db');
            pool.query(
              `SELECT fb.status
                 FROM fleet_battle_participants p
                 JOIN fleet_battles fb ON fb.id = p.battle_id
                WHERE p.battle_id = $1
                  AND p.fleet_id = $2
                  AND LOWER(p.wallet_address) = LOWER($3)
                LIMIT 1`,
              [bid, fleetId, ws.wallet]
            ).then((r) => {
              if (!r.rows.length) { _commandAck(ws, msg.cmd, commandId, 'not_your_fleet'); return; }
              if (r.rows[0].status !== 'active' && !liveBattle.isActive(bid)) {
                const cmdSvc = require('./services/commanderActions');
                const preBattleMap = {
                  formation: { actionType: 'formation_change', params: { formation: msg.payload && msg.payload.formation } },
                  maneuver: { actionType: 'maneuver_change', params: { maneuver: msg.payload && msg.payload.maneuver } },
                  focus: { actionType: 'focus_fire', params: { targetFleetId: msg.payload && msg.payload.targetFleetId } },
                  emp: { actionType: 'emp', params: { startTick: msg.payload && msg.payload.startTick } },
                };
                const mapped = preBattleMap[msg.cmd];
                if (!mapped) { _commandAck(ws, msg.cmd, commandId, 'battle_not_live'); return; }
                cmdSvc.declareAction(bid, ws.wallet, mapped.actionType, mapped.params)
                  .then((result) => _commandAck(ws, msg.cmd, commandId, null, { result, status: 'declared', live: false }))
                  .catch((err) => _commandAck(ws, msg.cmd, commandId, err.message));
                return;
              }
              const p = msg.payload || {};
              const queued = routeBattleCommandResult(bid, {
                commandId, fleetId, wallet: ws.wallet, action,
                params: { formation: p.formation, movement: p.maneuver || p.movement, targetFleetId: p.targetFleetId, x: p.x, y: p.y },
              });
              _commandAck(ws, msg.cmd, commandId, queued.accepted ? null : queued.reason, { live: true });
            }).catch(() => _commandAck(ws, msg.cmd, commandId, 'validation_failed'));
            return; // 라이브 처리 완료
          }
        } catch (_) { /* liveBattle 미가용 — 아래 pre-battle 경로 */ }
        // 비동기 import 회피: lazy require
        try {
          const cmdSvc = require('./services/commanderActions');
          const actionMap = {
            formation: { actionType: 'formation_change', params: { formation: msg.payload && msg.payload.formation } },
            maneuver:  { actionType: 'maneuver_change',  params: { maneuver:  msg.payload && msg.payload.maneuver  } },
            focus:     { actionType: 'focus_fire',       params: { targetFleetId: msg.payload && msg.payload.targetFleetId } },
            emp:       { actionType: 'emp',              params: { startTick: msg.payload && msg.payload.startTick } },
          };
          const mapped = actionMap[msg.cmd];
          if (!mapped) { _commandAck(ws, msg.cmd, commandId, 'unsupported_live_cmd'); return; }
          cmdSvc.declareAction(bid, ws.wallet, mapped.actionType, mapped.params)
            .then((result) => _commandAck(ws, msg.cmd, commandId, null, { result, status: 'declared', live: false }))
            .catch((err) => _commandAck(ws, msg.cmd, commandId, err.message));
        } catch (e) {
          _commandAck(ws, msg.cmd, commandId, e.message);
        }
      }
    });

    ws.on('close', () => {
      _removeSocketFromSync(ws);
      const set = _channels.get(bid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) { _channels.delete(bid); _battlePresence(bid, false); }
      }
      _releaseConn(ws._ip);
    });

    ws.on('error', () => {}); // silent — close 가 대신 처리
  });

  return _wss;
}

// ── Redis Pub/Sub 팬아웃 (멀티 인스턴스) ──────────────────────
// REDIS_URL 있으면 broadcast* 가 Redis 로 publish → 모든 인스턴스(origin 포함)가
// subscribe 해서 자기 로컬 클라이언트에 전달. 없으면 로컬 전용(단일 인스턴스, 현 동작).
// ⚠️ battleScheduler 가 워커(RUN_SCHEDULERS)에서만 돌고 viewer 는 web 인스턴스에 붙으므로,
//    멀티 인스턴스에서 battle frame 도 반드시 pub/sub 로 팬아웃돼야 한다.
const _PUB_CH = 'om:ws';
const _WATCH_PREFIX = 'om:ws:watch:';
const _PUB_ORIGIN = randomUUID();
let _pub = null, _sub = null, _redisReady = false;
// Keep only presentation summaries and one latest snapshot per recently active battle.
const _battleJournals = new Map();
const _battleRecoveryGuards = new Map();
const _pendingBattleSync = new Map();
const _pendingBattleSyncKeys = new Map();
const MAX_BATTLE_JOURNALS = 64;
const MAX_PENDING_BATTLE_SYNCS = 128;
function setBattleRecoveryGuard(battleId, guard) {
  battleId = _battleKey(battleId);
  if (battleId && typeof guard === 'function') _battleRecoveryGuards.set(battleId, guard);
}
function abandonBattleRecovery(battleId) {
  battleId = _battleKey(battleId);
  if (!battleId) return;
  _battleRecoveryGuards.delete(battleId);
  _battleJournals.delete(battleId);
}
function _journalEntry(battleId) {
  const entry = _battleJournals.get(battleId);
  const guard = _battleRecoveryGuards.get(battleId);
  if (!entry || (guard && !entry.end && !guard())) return null;
  return entry;
}
function recordBattleFrame(battleId, frame) {
  battleId = _battleKey(battleId);
  if (!battleId || !frame || typeof frame !== 'object') return null;
  let entry = _battleJournals.get(battleId);
  if (!entry || entry.end) {
    if (_battleJournals.size >= MAX_BATTLE_JOURNALS) {
      const candidates = [..._battleJournals.entries()];
      const oldest = candidates.find(([, value]) => value.end) || candidates.find(([id]) => !_battleRecoveryGuards.has(id));
      // Never evict the journal of a live battle with a valid authority guard.
      if (!oldest) return frame;
      _battleJournals.delete(oldest[0]);
    }
    entry = { journal: require('./services/battleVisualJournal').createVisualJournal(), end: null };
    _battleJournals.set(battleId, entry);
  }
  const before = entry.cursor || entry.journal.currentCursor();
  const cursor = entry.journal.push(frame);
  entry.cursor = cursor;
  return { ...frame, _continuity: cursor, _continuity_before: before };
}
function _socketRecoveryCursor(ws) {
  return ws.battleWireDigest ? (ws._battleAppliedCursor || ws._battleStartCursor || null) : (ws._battleCursor || null);
}
function _syncStatus(ws, status) {
  _safeSendOrTerminate(ws, JSON.stringify({ type: 'battle_sync', battleId: ws.battleId, status }));
}
function _sendBattleEnd(ws, battleId, summary) {
  const next = summary?._continuity, ended = ws._battleEnded;
  if (ended === true || (next && ended && ended.epoch === next.epoch && ended.seq >= next.seq)) return false;
  if (!_safeSendOrTerminate(ws, JSON.stringify({ type: 'end', battleId, ...summary }))) return false;
  ws._battleEnded = next || ws._battleCursor || true;
  return true;
}
function _forgetBattleSync(group) {
  if (!group) return;
  clearTimeout(group.timer);
  _pendingBattleSync.delete(group.id);
  _pendingBattleSyncKeys.delete(group.key);
}
function _removeSocketFromSync(ws) {
  clearTimeout(ws._battleSyncRetryTimer);
  const group = _pendingBattleSync.get(ws._battleSyncId);
  if (!group) return;
  group.sockets.delete(ws);
  if (!group.sockets.size) _forgetBattleSync(group);
}
function _syncResult(group, recovery, end) {
  if (!group || !_pendingBattleSync.has(group.id)) return;
  const recipients = [...group.sockets].filter(ws => ws.readyState === 1);
  _forgetBattleSync(group);
  if (!recipients.length) return;
  const frame = recovery?.frame ? { ...recovery.frame, combat_salvos: recovery.combat_salvos || [],
    _continuity: recovery.cursor, recovery_incomplete: !!recovery.incomplete } : null;
  for (const ws of recipients) { ws._battleSyncWaiting = false; ws._battleSyncId = null; }
  if (frame) _localBattleFrame(group.battleId, frame, new Set(recipients), true);
  for (const ws of recipients) {
    _syncStatus(ws, recovery?.incomplete ? 'incomplete' : 'restored');
    const finalEnd = end || ws._battleDeferredEnd;
    ws._battleDeferredEnd = null;
    const deferred = ws._battleDeferredFrame;
    ws._battleDeferredFrame = null;
    if (deferred) _localBattleFrame(group.battleId, deferred, new Set([ws]));
    if (ws._battleSyncWaiting) ws._battleDeferredEnd = finalEnd;
    else if (finalEnd) _sendBattleEnd(ws, group.battleId, finalEnd);
  }
}
async function _restoreFinishedBattle(group) {
  try {
    const { rows } = await require('./db').pool.query('SELECT status, winner_side, duration_seconds FROM fleet_battles WHERE id=$1', [group.battleId]);
    if (!_pendingBattleSync.has(group.id)) return;
    if (rows[0]?.status === 'cancelled') {
      _forgetBattleSync(group);
      for (const ws of group.sockets) { ws._battleSyncWaiting = false; _safeSendOrTerminate(ws, JSON.stringify({ type: 'queue', battleId: group.battleId, reason: 'battle_cancelled' })); }
      return;
    }
    if (rows[0]?.status !== 'ended') return;
    const saved = await require('./services/battleTimeline').getTimeline(group.battleId);
    const frame = saved?.timeline?.frames?.at(-1) || null;
    _syncResult(group, { frame, cursor: null, combat_salvos: [], incomplete: true },
      { winner_side: rows[0].winner_side, duration_seconds: rows[0].duration_seconds });
  } catch (_) { /* A later retry may find the committed result. */ }
}
function _retryBattleSync(group) {
  if (!_pendingBattleSync.has(group.id)) return;
  group.sockets = new Set([...group.sockets].filter(ws => ws.readyState === 1));
  if (!group.sockets.size) { _forgetBattleSync(group); return; }
  const entry = _journalEntry(group.battleId);
  if (entry) { _syncResult(group, entry.journal.recover(group.cursor), entry.end); return; }
  if (_redisReady && _pub) {
    try { _pub.publish(_PUB_CH, JSON.stringify({ kind: 'battleSyncRequest', origin: _PUB_ORIGIN,
      requester: _PUB_ORIGIN, requestId: group.id, battleId: group.battleId, cursor: group.cursor })).catch(() => {}); } catch (_) {}
  }
  group.attempts++;
  if (group.attempts % 3 === 0) _restoreFinishedBattle(group);
  group.timer = setTimeout(() => _retryBattleSync(group), 2000);
  group.timer.unref?.();
}
function _requestBattleSync(battleId, ws, cursor) {
  if (!ws || ws.readyState !== 1 || ws._battleSyncWaiting) return;
  let cursorText = '';
  try { cursorText = JSON.stringify(cursor || null); } catch (_) { return; }
  if (cursorText.length > 4096) return;
  const key = `${battleId}:${cursorText}`;
  let group = _pendingBattleSyncKeys.get(key);
  if (!group) {
    if (_pendingBattleSync.size >= MAX_PENDING_BATTLE_SYNCS) {
      ws._battleSyncWaiting = true;
      _syncStatus(ws, 'waiting');
      ws._battleSyncRetryTimer = setTimeout(() => {
        ws._battleSyncRetryTimer = null;
        ws._battleSyncWaiting = false;
        if (ws.readyState === 1) _requestBattleSync(battleId, ws, cursor);
      }, 2000);
      ws._battleSyncRetryTimer.unref?.();
      return;
    }
    group = { id: randomUUID(), key, battleId, cursor: cursor || null, sockets: new Set(), attempts: 0, timer: null };
    _pendingBattleSync.set(group.id, group); _pendingBattleSyncKeys.set(key, group);
  }
  group.sockets.add(ws); ws._battleSyncWaiting = true; ws._battleSyncId = group.id;
  _syncStatus(ws, 'waiting');
  if (!group.timer) _retryBattleSync(group);
}
function _announceBattleJournals() {
  if (!_redisReady || !_pub || (_pub.status && _pub.status !== 'ready')) return;
  for (const [battleId] of _battleJournals) {
    const entry = _journalEntry(battleId);
    if (!entry?.cursor) continue;
    try { _pub.publish(_PUB_CH, JSON.stringify({ kind: 'battleSyncAvailable', origin: _PUB_ORIGIN,
      battleId, cursor: entry.cursor, ended: !!entry.end })).catch(() => {}); } catch (_) {}
  }
}
const _viewerChecks = new Map();
let _viewerCheckTimer = null;
function _battlePresence(battleId, present) {
  // Redis removes subscriptions when the instance disconnects; no stale counters.
  if (!_sub || _sub.status !== 'ready') return;
  try {
    const pending = present ? _sub.subscribe(_WATCH_PREFIX + battleId) : _sub.unsubscribe(_WATCH_PREFIX + battleId);
    pending?.catch(() => {});
  } catch (_) {}
}
async function _flushViewerChecks() {
  _viewerCheckTimer = null;
  const pending = [..._viewerChecks.entries()];
  _viewerChecks.clear();
  for (let start = 0; start < pending.length; start += 128) {
    const batch = pending.slice(start, start + 128);
    let counts = [], timeout;
    try {
      if (_redisReady && _pub) counts = await Promise.race([
        _pub.call('PUBSUB', 'NUMSUB', ...batch.map(([id]) => _WATCH_PREFIX + id)),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('viewer check timeout')), 250); })
      ]);
    } catch (_) {} finally { if (timeout) clearTimeout(timeout); }
    if (!Array.isArray(counts)) counts = [];
    const active = new Set();
    for (let i = 0; i + 1 < counts.length; i += 2) if (Number(counts[i + 1]) > 0) active.add(counts[i]);
    for (const [id, resolvers] of batch) {
      const found = !!_channels.get(id)?.size || active.has(_WATCH_PREFIX + id);
      for (const resolve of resolvers) resolve(found);
    }
  }
}
function hasBattleViewers(battleId) {
  battleId = _battleKey(battleId);
  if (!battleId) return Promise.resolve(false);
  if (_channels.get(battleId)?.size) return Promise.resolve(true);
  if (!_redisReady || !_pub) return Promise.resolve(false);
  return new Promise(resolve => {
    if (!_viewerChecks.has(battleId)) _viewerChecks.set(battleId, []);
    _viewerChecks.get(battleId).push(resolve);
    if (!_viewerCheckTimer) _viewerCheckTimer = setTimeout(_flushViewerChecks, 20);
  });
}
function _enqueueLocalBattleCommand(battleId, command) {
  try {
    const liveBattle = require('./services/liveBattle');
    return liveBattle.enqueueCommandResult(battleId, command);
  } catch (_) {
    return { accepted: false, reason: 'not_authority' };
  }
}
function _initRedisPubSub() {
  if (!process.env.REDIS_URL) { console.log('[WS] broadcast: 로컬 전용 (REDIS_URL 미설정)'); return; }
  let Redis;
  try { Redis = require('ioredis'); } catch (e) { console.warn('[WS] ioredis 미설치 — 로컬 broadcast 폴백'); return; }
  try {
    _pub = new Redis(process.env.REDIS_URL, { family: 0, maxRetriesPerRequest: 2, enableOfflineQueue: false });
    _sub = new Redis(process.env.REDIS_URL, { family: 0, maxRetriesPerRequest: 2, autoResubscribe: false });
    _pub.on('error', () => {}); _sub.on('error', () => {});
    const subscribe = () => _sub.subscribe(_PUB_CH, (err) => {
      if (err) { console.warn('[WS] Redis subscribe 실패 — 로컬 폴백:', err.message); _redisReady = false; return; }
      _redisReady = true;
      console.log('[WS] Redis Pub/Sub 팬아웃 활성 (멀티 인스턴스)');
      _announceBattleJournals();
      for (const group of _pendingBattleSync.values()) { clearTimeout(group.timer); group.timer = null; _retryBattleSync(group); }
    });
    _pub.on('ready', _announceBattleJournals);
    _sub.on('close', () => {
      _redisReady = false;
      for (const [battleId, sockets] of _channels) {
        if (_journalEntry(battleId)) continue;
        for (const ws of sockets) _requestBattleSync(battleId, ws, _socketRecoveryCursor(ws));
      }
    });
    _sub.on('ready', () => { subscribe(); for (const battleId of _channels.keys()) _battlePresence(battleId, true); });
    subscribe();
    _sub.on('message', (ch, raw) => {
      if (ch !== _PUB_CH) return;
      let m = null; try { m = JSON.parse(raw); } catch (_) { return; }
      if (!m || !m.kind) return;
      // Origin already delivered its own broadcasts synchronously.
      if (m.origin === _PUB_ORIGIN) return;
      if (m.kind === 'chat') _localChat(m.channel, m.message);
      else if (m.kind === 'feed') _localFeed(m.event);
      else if (m.kind === 'battleFrame') _localBattleFrame(m.battleId, m.frame);
      else if (m.kind === 'battleEnd') _localBattleEnd(m.battleId, m.summary);
      else if (m.kind === 'battleQueue') _localBattleQueue(m.battleId, m.reason);
      else if (m.kind === 'battleCmdResult') _localBattleCommandResult(m.battleId, m.result);
      else if (m.kind === 'battleSyncAvailable') {
        const battleId = _battleKey(m.battleId), next = m.cursor;
        if (!battleId || !next || typeof next.epoch !== 'string' || !Number.isSafeInteger(next.seq)) return;
        for (const ws of _channels.get(battleId) || []) {
          const last = _socketRecoveryCursor(ws);
          const ended = ws._battleEnded;
          const needsEnd = m.ended && (!ended || (ended !== true && (ended.epoch !== next.epoch || ended.seq < next.seq)));
          if (!last || last.epoch !== next.epoch || last.seq < next.seq || needsEnd) {
            _requestBattleSync(battleId, ws, last || null);
          }
        }
      }
      else if (m.kind === 'battleSyncRequest') {
        const battleId = _battleKey(m.battleId);
        if (!battleId || typeof m.requester !== 'string' || m.requester.length > 80 ||
            typeof m.requestId !== 'string' || m.requestId.length > 80) return;
        let cursorSize = 0;
        try { cursorSize = JSON.stringify(m.cursor || null).length; } catch (_) { return; }
        if (cursorSize > 4096) return;
        const entry = _journalEntry(battleId);
        if (!entry || !_pub) return;
        try {
          const recovery = entry.journal.recover(m.cursor);
          if (recovery) _pub.publish(_PUB_CH, JSON.stringify({ kind: 'battleSyncResponse', origin: _PUB_ORIGIN,
            target: m.requester, requestId: m.requestId, battleId, recovery, end: entry.end })).catch(() => {});
        } catch (_) {}
      } else if (m.kind === 'battleSyncResponse' && m.target === _PUB_ORIGIN) {
        const group = _pendingBattleSync.get(m.requestId);
        if (!group || group.battleId !== _battleKey(m.battleId) || !m.recovery?.cursor) return;
        const current = m.recovery.cursor;
        if (group.cursor && current.epoch === group.cursor.epoch && current.seq < group.cursor.seq) return;
        _syncResult(group, m.recovery, m.end || null);
      }
      else if (m.kind === 'battleCmd') {
        const queued = _enqueueLocalBattleCommand(m.battleId, m.command);
        if (!queued.accepted && queued.reason !== 'not_authority') {
          broadcastBattleCommandResult(m.battleId, {
            commandId: m.command.commandId || null, cmd: m.command.action, fleetId: m.command.fleetId,
            wallet: m.command.wallet, tick: null, status: 'rejected', reason: queued.reason,
          });
        }
      }
    });
  } catch (e) { console.warn('[WS] Redis pub/sub init 실패 — 로컬 폴백:', e.message); _pub = null; _sub = null; _redisReady = false; }
}
// Redis 활성 시 publish, 아니면 로컬 전달.
function _publishOrLocal(kind, payload, localFn) {
  // Local delivery cannot depend on Redis availability or a pending publish.
  localFn();
  if (_redisReady && _pub) {
    try { _pub.publish(_PUB_CH, JSON.stringify(Object.assign({ kind, origin: _PUB_ORIGIN }, payload))).catch(() => {}); } catch (_) {}
  }
}
function routeBattleCommand(battleId, command) {
  return routeBattleCommandResult(battleId, command).accepted;
}
function routeBattleCommandResult(battleId, command) {
  battleId = _battleKey(battleId);
  if (!battleId || !command) return { accepted: false, reason: 'invalid_command' };
  if (!command.commandId) command.commandId = randomUUID();
  const local = _enqueueLocalBattleCommand(battleId, command);
  if (local.accepted || local.reason !== 'not_authority') return local;
  if (_redisReady && _pub) {
    try {
      _pub.publish(_PUB_CH, JSON.stringify({ kind: 'battleCmd', battleId, command })).catch(() => {
        broadcastBattleCommandResult(battleId, { commandId: command.commandId, cmd: command.action,
          fleetId: command.fleetId, wallet: command.wallet, tick: null, status: 'rejected', reason: 'delivery_failed' });
      });
      return { accepted: true, reason: null };
    } catch (_) {}
  }
  return { accepted: false, reason: 'not_authority' };
}

async function _sendBattleCommandResult(ws, payload) {
  if (ws.readyState !== 1) return;
  if (ws.totpToken) {
    let current;
    try { current = await totpSessionBoundary.validateToken(ws.totpToken); } catch (_) {}
    if (!current || current.revoked || !current.wallet ||
        current.wallet.toLowerCase() !== ws.wallet.toLowerCase()) {
      try { ws.close(1008, 'session_expired'); } catch (_) {}
      return;
    }
  }
  _safeSendOrTerminate(ws, payload);
}

function _localBattleCommandResult(battleId, result) {
  const set = _channels.get(_battleKey(battleId));
  if (!set || !result || !result.wallet) return;
  const { wallet, ...publicResult } = result;
  const payload = JSON.stringify({ type: 'cmd_result', battleId: _battleKey(battleId), ...publicResult });
  for (const ws of set) {
    // Owner-scoped results must recheck idle TOTP sessions after recovery too.
    if (ws.wallet && ws.wallet.toLowerCase() === String(wallet).toLowerCase()) _sendBattleCommandResult(ws, payload);
  }
}

function broadcastBattleCommandResult(battleId, result) {
  battleId = _battleKey(battleId);
  if (!battleId) return;
  _publishOrLocal('battleCmdResult', { battleId, result }, () => _localBattleCommandResult(battleId, result));
}

// ── Battle frame/end ──────────────────────────────────────────
// [v7.190 backpressure] 느린 client 가 frame 큐에 1MB 이상 쌓이면 강제 종료.
//   battle frame 은 200ms tick × 수백 frame → viewer 한 명 stuck 시 Node RAM 누적.
const _WS_BUFFER_LIMIT = 1_048_576; // 1 MB
function _safeSendOrTerminate(ws, payload) {
  if (ws.readyState !== 1) return false;
  if (ws.bufferedAmount > _WS_BUFFER_LIMIT) {
    try { ws.terminate(); } catch (_) {}
    return false;
  }
  try { ws.send(payload); return true; } catch (_) { return false; }
}
function _localBattleFrame(battleId, frame, recipients = null, recovering = false) {
  battleId = _battleKey(battleId);
  const set = recipients || _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  let payload, compressed;
  if (Array.from(set).some(ws => ws.battleWireGzip && ws.readyState === 1)) {
    try { ({ raw: payload, compressed } = require('./utils/battleFrameWire').encodeBattleFrame(battleId, frame, true, Array.from(set).some(ws => ws.battleWireDigest && ws.readyState === 1))); } catch (_) {}
  }
  if (!payload) payload = JSON.stringify({ type: 'frame', battleId, ...frame });
  let sent = 0;
  for (const ws of set) {
    if (!recovering && ws._battleSyncWaiting) { ws._battleDeferredFrame = frame; continue; }
    const next = frame._continuity, last = ws._battleCursor;
    if (next && last && next.epoch === last.epoch && next.seq <= last.seq && !recovering) continue;
    if (!recovering && next && last && (next.epoch !== last.epoch || next.seq > last.seq + 1)) {
      ws._battleDeferredFrame = frame;
      _requestBattleSync(battleId, ws, _socketRecoveryCursor(ws));
      continue;
    }
    if (_safeSendOrTerminate(ws, ws.battleWireGzip && compressed ? compressed : payload)) {
      if (next && last && next.epoch !== last.epoch) ws._battleEnded = null;
      if (next) {
        if (!ws._battleStartCursor || ws._battleStartCursor.epoch !== next.epoch) ws._battleStartCursor = frame._continuity_before || null;
        ws._battleCursor = next;
        const sent = ws._battleSentCursors || (ws._battleSentCursors = new Map());
        sent.set(`${next.epoch}:${next.seq}`, next);
        if (sent.size > 128) sent.delete(sent.keys().next().value);
      }
      sent++;
    }
  }
  return sent;
}
function _localBattleEnd(battleId, summary) {
  battleId = _battleKey(battleId);
  const set = _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  let sent = 0;
  for (const ws of set) {
    if (ws._battleSyncWaiting) { ws._battleDeferredEnd = summary; continue; }
    const next = summary?._continuity, last = ws._battleCursor;
    if (next && last && next.epoch === last.epoch && next.seq < last.seq) continue;
    if (next && last && (next.epoch !== last.epoch || next.seq > last.seq)) {
      ws._battleDeferredEnd = summary;
      _requestBattleSync(battleId, ws, _socketRecoveryCursor(ws));
      continue;
    }
    if (_sendBattleEnd(ws, battleId, summary)) sent++;
  }
  return sent;
}
function _localBattleQueue(battleId, reason = 'live_capacity') {
  battleId = _battleKey(battleId);
  const set = _channels.get(battleId);
  if (!set) return 0;
  const payload = JSON.stringify({ type: 'queue', battleId, reason });
  let sent = 0;
  for (const ws of set) if (_safeSendOrTerminate(ws, payload)) sent++;
  return sent;
}
function broadcastBattleQueue(battleId, reason = 'live_capacity') {
  battleId = _battleKey(battleId);
  if (!battleId) return;
  _publishOrLocal('battleQueue', { battleId, reason }, () => _localBattleQueue(battleId, reason));
}
/** Battle frame broadcast (battleScheduler 가 매 tick 호출). 멀티 인스턴스 시 Redis 팬아웃. */
function broadcastBattleFrame(battleId, frame) {
  battleId = _battleKey(battleId);
  if (!battleId) return;
  const recorded = recordBattleFrame(battleId, frame);
  // Redis can be down even though the battle authority and its viewers are local.
  // Wake local waiters from the authoritative journal before broadcasting.
  for (const ws of _channels.get(battleId) || []) {
    if (!ws._battleSyncWaiting) continue;
    const group = _pendingBattleSync.get(ws._battleSyncId);
    if (group) _retryBattleSync(group);
    else { clearTimeout(ws._battleSyncRetryTimer); ws._battleSyncWaiting = false; _requestBattleSync(battleId, ws, _socketRecoveryCursor(ws)); }
  }
  _publishOrLocal('battleFrame', { battleId, frame: recorded }, () => _localBattleFrame(battleId, recorded));
}
/** Battle 종료 broadcast — winner / summary. */
function broadcastBattleEnd(battleId, summary) {
  battleId = _battleKey(battleId);
  if (!battleId) return;
  const entry = _battleJournals.get(battleId);
  if (entry) { summary = { ...summary, _continuity: entry.cursor }; entry.end = summary; }
  _battleRecoveryGuards.delete(battleId);
  _publishOrLocal('battleEnd', { battleId, summary }, () => _localBattleEnd(battleId, summary));
}

// ── 라이브 채널 (채팅/활동피드) ──────────────────────────────
function _handleLive(ws) {
  _live.add(ws);
  try { ws.send(JSON.stringify({ type: 'hello', live: true, wallet: ws.wallet || null })); } catch (_) {}
  ws.on('message', (raw) => {
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!msg || !msg.type) return;
    // 구독 설정: { type:'sub', channels:['global','sector:foo','feed'] }
    if (msg.type === 'sub' && Array.isArray(msg.channels)) {
      ws.subs = new Set(msg.channels.slice(0, 30).map(String));
    } else if (msg.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong' })); } catch (_) {}
    }
  });
  ws.on('close', () => { _live.delete(ws); _releaseConn(ws._ip); });
  ws.on('error', () => {});
}

// 로컬 _live 클라이언트에 채팅 전달 (해당 채널 구독자만).
function _localChat(channel, message) {
  if (!_live.size) return 0;
  const payload = JSON.stringify({ type: 'chat', channel, message });
  let sent = 0;
  for (const ws of _live) {
    try {
      if (ws.readyState === 1 && (ws.subs.has(channel) || ws.subs.has('*'))) { ws.send(payload); sent++; }
    } catch (_) {}
  }
  return sent;
}
// 로컬 _live 클라이언트에 피드 이벤트 전달 ('feed' 구독자만).
function _localFeed(event) {
  if (!_live.size) return 0;
  const payload = JSON.stringify({ type: 'feed', event });
  let sent = 0;
  for (const ws of _live) {
    try {
      if (ws.readyState === 1 && ws.subs.has('feed')) { ws.send(payload); sent++; }
    } catch (_) {}
  }
  return sent;
}
/** 채팅 메시지 푸시. chat.js POST /chat/send 가 호출. 멀티 인스턴스 시 Redis 팬아웃. */
function broadcastChat(channel, message) {
  _publishOrLocal('chat', { channel, message }, () => _localChat(channel, message));
}
/** 활동피드 이벤트 푸시. 멀티 인스턴스 시 Redis 팬아웃. */
function broadcastFeed(event) {
  _publishOrLocal('feed', { event }, () => _localFeed(event));
}

function channelStats() {
  const out = { _live: _live.size };
  for (const [bid, set] of _channels) out[bid] = set.size;
  return out;
}

module.exports = { attachWsServer, broadcastBattleQueue, broadcastBattleFrame, recordBattleFrame,
  setBattleRecoveryGuard, abandonBattleRecovery, broadcastBattleEnd, broadcastBattleCommandResult,
  broadcastChat, broadcastFeed, channelStats, hasBattleViewers, routeBattleCommand, routeBattleCommandResult };

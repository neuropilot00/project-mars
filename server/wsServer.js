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
const jwt = require('jsonwebtoken');
const url = require('url');

// battle_id -> Set<WebSocket>
const _channels = new Map();
// 라이브(채팅/활동피드) 연결 — 각 ws.subs(Set) 로 구독 채널 추적
const _live = new Set();
let _wss = null;

function _verifyToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    return (p.wallet_address || p.wallet || p.walletAddress || '').toLowerCase().trim();
  } catch (_) { return null; }
}

function attachWsServer(httpServer) {
  if (_wss) return _wss;
  _wss = new WebSocketServer({ noServer: true });
  _initRedisPubSub();  // 멀티 인스턴스 팬아웃 (REDIS_URL 있을 때만; 없으면 로컬 전용)

  httpServer.on('upgrade', (req, socket, head) => {
    const parsed = url.parse(req.url, true);
    const path = parsed.pathname || '';
    // 경로 매칭: /ws/battle/{id}
    const m = /^\/ws\/battle\/(\d+)$/.exec(path);
    if (m) {
      const battleId = parseInt(m[1]);
      const wallet = _verifyToken(parsed.query.token); // 인증 실패해도 read-only 허용 (관전 모드)
      _wss.handleUpgrade(req, socket, head, (ws) => {
        ws.battleId = battleId;
        ws.wallet = wallet;
        _wss.emit('connection', ws, req);
      });
      return;
    }
    // 라이브 채널: /ws/live (채팅 + 활동피드 푸시)
    if (path === '/ws/live') {
      const wallet = _verifyToken(parsed.query.token);
      _wss.handleUpgrade(req, socket, head, (ws) => {
        ws.isLive = true;
        ws.wallet = wallet;
        ws.subs = new Set();
        _wss.emit('connection', ws, req);
      });
      return;
    }
    socket.destroy();
  });

  _wss.on('connection', (ws) => {
    if (ws.isLive) { _handleLive(ws); return; }
    const bid = ws.battleId;
    if (!_channels.has(bid)) _channels.set(bid, new Set());
    _channels.get(bid).add(ws);

    ws.send(JSON.stringify({ type: 'hello', battleId: bid, wallet: ws.wallet || null }));

    ws.on('message', (raw) => {
      let msg = null;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
      if (!msg || !msg.type) return;
      if (msg.type === 'cmd') {
        // 부모 (commander_actions) 로 전달 — 인증된 wallet 만
        if (!ws.wallet) {
          ws.send(JSON.stringify({ type: 'error', error: 'wallet_required' }));
          return;
        }
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
          if (!mapped) return;
          cmdSvc.declareAction(bid, ws.wallet, mapped.actionType, mapped.params)
            .then((result) => ws.send(JSON.stringify({ type: 'cmd_ok', cmd: msg.cmd, result })))
            .catch((err) => ws.send(JSON.stringify({ type: 'cmd_err', cmd: msg.cmd, error: err.message })));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: e.message }));
        }
      }
    });

    ws.on('close', () => {
      const set = _channels.get(bid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) _channels.delete(bid);
      }
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
let _pub = null, _sub = null, _redisReady = false;
function _initRedisPubSub() {
  if (!process.env.REDIS_URL) { console.log('[WS] broadcast: 로컬 전용 (REDIS_URL 미설정)'); return; }
  let Redis;
  try { Redis = require('ioredis'); } catch (e) { console.warn('[WS] ioredis 미설치 — 로컬 broadcast 폴백'); return; }
  try {
    _pub = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
    _sub = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2 });
    _pub.on('error', () => {}); _sub.on('error', () => {});
    _sub.subscribe(_PUB_CH, (err) => {
      if (err) { console.warn('[WS] Redis subscribe 실패 — 로컬 폴백:', err.message); _redisReady = false; return; }
      _redisReady = true;
      console.log('[WS] Redis Pub/Sub 팬아웃 활성 (멀티 인스턴스)');
    });
    _sub.on('message', (ch, raw) => {
      if (ch !== _PUB_CH) return;
      let m = null; try { m = JSON.parse(raw); } catch (_) { return; }
      if (!m || !m.kind) return;
      // 로컬 클라이언트에 전달 (origin 인스턴스 포함 — broadcast* 는 publish 만 하고 직접 로컬전달 안 함)
      if (m.kind === 'chat') _localChat(m.channel, m.message);
      else if (m.kind === 'feed') _localFeed(m.event);
      else if (m.kind === 'battleFrame') _localBattleFrame(m.battleId, m.frame);
      else if (m.kind === 'battleEnd') _localBattleEnd(m.battleId, m.summary);
    });
  } catch (e) { console.warn('[WS] Redis pub/sub init 실패 — 로컬 폴백:', e.message); _pub = null; _sub = null; _redisReady = false; }
}
// Redis 활성 시 publish, 아니면 로컬 전달.
function _publishOrLocal(kind, payload, localFn) {
  if (_redisReady && _pub) {
    try { _pub.publish(_PUB_CH, JSON.stringify(Object.assign({ kind }, payload))); return; } catch (_) {}
  }
  localFn();
}

// ── Battle frame/end ──────────────────────────────────────────
function _localBattleFrame(battleId, frame) {
  const set = _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ type: 'frame', battleId, ...frame });
  let sent = 0;
  for (const ws of set) {
    try { if (ws.readyState === 1) { ws.send(payload); sent++; } } catch (_) {}
  }
  return sent;
}
function _localBattleEnd(battleId, summary) {
  const set = _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ type: 'end', battleId, ...summary });
  let sent = 0;
  for (const ws of set) {
    try { if (ws.readyState === 1) { ws.send(payload); sent++; } } catch (_) {}
  }
  return sent;
}
/** Battle frame broadcast (battleScheduler 가 매 tick 호출). 멀티 인스턴스 시 Redis 팬아웃. */
function broadcastBattleFrame(battleId, frame) {
  _publishOrLocal('battleFrame', { battleId, frame }, () => _localBattleFrame(battleId, frame));
}
/** Battle 종료 broadcast — winner / summary. */
function broadcastBattleEnd(battleId, summary) {
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
  ws.on('close', () => _live.delete(ws));
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

module.exports = { attachWsServer, broadcastBattleFrame, broadcastBattleEnd, broadcastChat, broadcastFeed, channelStats };

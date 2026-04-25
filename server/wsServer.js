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

  httpServer.on('upgrade', (req, socket, head) => {
    const parsed = url.parse(req.url, true);
    // 경로 매칭: /ws/battle/{id}
    const m = /^\/ws\/battle\/(\d+)$/.exec(parsed.pathname || '');
    if (!m) {
      socket.destroy();
      return;
    }
    const battleId = parseInt(m[1]);
    const token = parsed.query.token;
    const wallet = _verifyToken(token); // 인증 실패해도 read-only 허용 (관전 모드)
    _wss.handleUpgrade(req, socket, head, (ws) => {
      ws.battleId = battleId;
      ws.wallet = wallet;
      _wss.emit('connection', ws, req);
    });
  });

  _wss.on('connection', (ws) => {
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

/**
 * Broadcast 한 frame 을 battle 채널의 모든 구독자에게 전송.
 * battleScheduler 가 매 tick 호출.
 */
function broadcastBattleFrame(battleId, frame) {
  const set = _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ type: 'frame', battleId, ...frame });
  let sent = 0;
  for (const ws of set) {
    try {
      if (ws.readyState === 1) { ws.send(payload); sent++; }
    } catch (_) {}
  }
  return sent;
}

/**
 * Battle 종료 broadcast — winner / summary 포함.
 */
function broadcastBattleEnd(battleId, summary) {
  const set = _channels.get(battleId);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ type: 'end', battleId, ...summary });
  let sent = 0;
  for (const ws of set) {
    try {
      if (ws.readyState === 1) { ws.send(payload); sent++; }
    } catch (_) {}
  }
  return sent;
}

function channelStats() {
  const out = {};
  for (const [bid, set] of _channels) out[bid] = set.size;
  return out;
}

module.exports = { attachWsServer, broadcastBattleFrame, broadcastBattleEnd, channelStats };

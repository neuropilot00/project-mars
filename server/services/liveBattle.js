// server/services/liveBattle.js
// ═══════════════════════════════════════════════════════════════
// [Phase 3 실시간] 라이브 전투 명령 큐 — 권위(authority) 워커의 in-memory 큐.
//   WS 핸들러가 enqueueCommand 로 적재, 라이브 틱 루프(battleEngine.simulateBattleLive)가
//   매 틱 drainCommands 로 비운다. 한 전투의 라이브 루프는 frame-stream-lock 을 가진 단일
//   워커에서만 돌아야 하며, 그 워커가 markActive 로 등록한다.
//   멀티 인스턴스: 다른 워커 WS 로 들어온 명령은 Redis Pub/Sub(om:ws, kind:'battleCmd')로
//   권위 워커에 전달 → 권위 워커가 enqueueCommand. (wsServer 가 라우팅)
// ═══════════════════════════════════════════════════════════════

const _queues = new Map(); // battleId(str) -> cmd[]
const _active = new Set(); // 라이브 진행 중 battleId(str) — 이 워커가 권위
const _rate = new Map();   // 'battleId:wallet' -> timestamps[] (per-wallet 명령 rate limit)

const MAX_QUEUE = 500;     // 폭주 방어 — 틱당 드레인되므로 정상 시 수십개 이하
const RATE_PER_SEC = 5;    // 참가자 1인당 초당 명령 상한 (레드팀: 플러딩/매크로 차단)

function enqueueCommand(battleId, cmd) {
  return enqueueCommandResult(battleId, cmd).accepted;
}

function enqueueCommandResult(battleId, cmd) {
  const k = String(battleId);
  if (!_active.has(k)) return { accepted: false, reason: 'not_authority' };
  // per-wallet rate limit (WS·HTTP 양 경로 공통 choke point)
  if (cmd && cmd.wallet) {
    const rk = k + ':' + String(cmd.wallet).toLowerCase();
    const now = Date.now();
    const ts = (_rate.get(rk) || []).filter((t) => now - t < 1000);
    if (ts.length >= RATE_PER_SEC) { _rate.set(rk, ts); return { accepted: false, reason: 'rate_limited' }; }
    ts.push(now); _rate.set(rk, ts);
  }
  let q = _queues.get(k);
  if (!q) { q = []; _queues.set(k, q); }
  // Never silently discard a command that was already acknowledged as accepted.
  if (q.length >= MAX_QUEUE) return { accepted: false, reason: 'queue_full' };
  q.push(cmd);
  return { accepted: true, reason: null };
}

function drainCommands(battleId) {
  const k = String(battleId);
  const q = _queues.get(k);
  if (!q || !q.length) return [];
  _queues.set(k, []);
  return q;
}

function markActive(battleId) { _active.add(String(battleId)); }
function clearActive(battleId) {
  const k = String(battleId);
  const pending = _queues.get(k) || [];
  _active.delete(k); _queues.delete(k);
  for (const rk of _rate.keys()) { if (rk.startsWith(k + ':')) _rate.delete(rk); }
  return pending;
}
function isActive(battleId) { return _active.has(String(battleId)); }

module.exports = { enqueueCommand, enqueueCommandResult, drainCommands, markActive, clearActive, isActive };

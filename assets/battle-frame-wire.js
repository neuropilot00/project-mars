(function (global) {
  'use strict';

  // gzip's trailer carries a CRC32 checksum, checked by DecompressionStream.
  const MAX_FRAME_BYTES = 2 * 1024 * 1024;
  const MAX_BASE64_CHARS = Math.ceil((MAX_FRAME_BYTES + 1024) / 3) * 4;
  const WEAPONS = new Set(['beam','overdrive','laser','mixed','missile','bullet','stealth_bomb','disruptor','lance','railgun']);
  // At most two real trajectories for each side/weapon keep backlog memory bounded.
  function addVisual(groups, event) {
    if (!event || !['atk', 'def'].includes(event.source_side)) return;
    const weapon = WEAPONS.has(event.fire_type) ? event.fire_type : 'other';
    const key = event.source_side + ':' + weapon;
    const count = event.count == null ? 1 : event.count;
    if (!Number.isSafeInteger(count) || count < 1) return;
    const seq = Number.isSafeInteger(event.seq) ? event.seq : 0;
    const first = Number.isSafeInteger(event.first_seq) ? event.first_seq : seq;
    const last = Number.isSafeInteger(event.last_seq) ? event.last_seq : seq;
    const group = groups[key] || (groups[key] = {source_side:event.source_side, fire_type:weapon, count:0, first_seq:first, last_seq:last, samples:[]});
    if (count > Number.MAX_SAFE_INTEGER - group.count) { group.count = Number.MAX_SAFE_INTEGER; group.overflow = true; }
    else group.count += count;
    if (event.overflow === true) group.overflow = true;
    group.first_seq = Math.min(group.first_seq, first);
    group.last_seq = Math.max(group.last_seq, last);
    const samples = Array.isArray(event.samples) ? event.samples.slice(0,2) : [{seq, from:event.from, to:event.to}];
    for (let i=0;i<samples.length;i++) {
      const sample = samples[i];
      if (!sample?.from || !sample?.to || ![sample.from.x,sample.from.y,sample.to.x,sample.to.y].every(v => Number.isFinite(v) && Math.abs(v) <= 100000)) continue;
      const sampleSeq = Number.isSafeInteger(sample.seq) ? sample.seq : (i ? last : first);
      const point = {seq:sampleSeq, from:{x:sample.from.x,y:sample.from.y}, to:{x:sample.to.x,y:sample.to.y}};
      if (!group.samples.length) group.samples.push(point);
      else if (sampleSeq < group.samples[0].seq) group.samples.unshift(point);
      else if (sampleSeq > group.samples[group.samples.length-1].seq) group.samples.push(point);
      if (group.samples.length > 2) group.samples.splice(1,group.samples.length-2);
    }
  }
  function summarize(frame) {
    const groups = Object.create(null);
    for (const event of (Array.isArray(frame?.combat_events) ? frame.combat_events : []).slice(0,128)) if (event?.type === 'shot_hit') addVisual(groups, event);
    for (const salvo of (Array.isArray(frame?.combat_salvos) ? frame.combat_salvos : []).slice(0,22)) addVisual(groups, salvo);
    return Object.values(groups);
  }
  function mergeVisual(...lists) {
    const groups = Object.create(null);
    for (const list of lists) for (const event of (Array.isArray(list) ? list : []).slice(0,22)) addVisual(groups, event);
    return Object.values(groups);
  }
  function carryInto(frame, carry, battleId) {
    if (!Array.isArray(carry) || !carry.length) return frame;
    const groups = mergeVisual(carry, frame.combat_salvos);
    return Object.assign({}, frame, { ...(groups.some(group => group.overflow) ? {visual_count_inexact:true} : {}), combat_salvos:groups.map(group => ({...group,
      id:`${battleId}:carry:${group.first_seq}:${group.last_seq}:${group.source_side}:${group.fire_type}`}))});
  }
  // This checksum detects accidental envelope corruption; WSS authenticates the server.
  function checksum(data, digest, continuity, before) {
    let hash = 2166136261;
    for (const text of [data, JSON.stringify(digest), JSON.stringify(continuity || null), ...(before ? [JSON.stringify(before)] : [])]) {
      for (let i=0;i<text.length;i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function validCursor(cursor) {
    if (!cursor || typeof cursor !== 'object' || typeof cursor.epoch !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.epoch) ||
        !Number.isSafeInteger(cursor.seq) || cursor.seq < 0 ||
        !Number.isSafeInteger(cursor.lastCombatSeq) || cursor.lastCombatSeq < 0 ||
        typeof cursor.proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(cursor.proof) ||
        !cursor.totals || typeof cursor.totals !== 'object' || Array.isArray(cursor.totals)) return false;
    const keys = Object.keys(cursor.totals);
    return keys.length <= 22 && keys.every(key => {
      const [side, weapon, extra] = key.split(':');
      return !extra && ['atk','def'].includes(side) && (WEAPONS.has(weapon) || weapon === 'other') &&
        Number.isSafeInteger(cursor.totals[key]) && cursor.totals[key] >= 0;
    }) && JSON.stringify(cursor).length <= 4096;
  }
  // Compare adjacent signed server cursors to catch an inconsistent visual summary.
  // The client cannot verify the server's HMAC; WSS and the server remain trusted.
  function digestMatchesCursor(previous, current, digest) {
    if (!validCursor(previous) || !validCursor(current) || previous.epoch !== current.epoch || current.seq !== previous.seq + 1) return true;
    const counts = Object.create(null);
    for (const group of digest) counts[group.source_side + ':' + group.fire_type] = group.count;
    const keys = new Set([...Object.keys(previous.totals), ...Object.keys(current.totals), ...Object.keys(counts)]);
    for (const key of keys) {
      const delta = (current.totals[key] || 0) - (previous.totals[key] || 0);
      if (!Number.isSafeInteger(delta) || delta < 0 || delta !== (counts[key] || 0)) return false;
    }
    return true;
  }
  function validEnvelope(envelope) {
    if (!envelope || envelope.type !== 'frame_gzip_v1' || typeof envelope.data !== 'string' ||
        !Number.isSafeInteger(envelope.bytes) || envelope.bytes < 1 || envelope.bytes > MAX_FRAME_BYTES ||
        envelope.data.length > MAX_BASE64_CHARS || envelope.data.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(envelope.data) || !Array.isArray(envelope.visual_digest) ||
        envelope.visual_digest.length > 22 || JSON.stringify(envelope.visual_digest).length > 16384) return false;
    const cursor = envelope._continuity;
    if (cursor != null && !validCursor(cursor)) return false;
    if (envelope._continuity_before != null && !validCursor(envelope._continuity_before)) return false;
    const keys = new Set();
    for (const group of envelope.visual_digest) {
      if (!group || !['atk','def'].includes(group.source_side) || !(WEAPONS.has(group.fire_type) || group.fire_type === 'other') ||
          !Number.isSafeInteger(group.count) || group.count < 1 || group.count > 100000000 ||
          !Number.isSafeInteger(group.first_seq) || !Number.isSafeInteger(group.last_seq) || group.first_seq < 0 || group.last_seq < group.first_seq ||
          !Array.isArray(group.samples) || group.samples.length > 2) return false;
      const key = group.source_side + ':' + group.fire_type;
      if (keys.has(key) || (cursor && group.count > (cursor.totals[key] || 0))) return false;
      keys.add(key);
      for (const point of group.samples) if (!point?.from || !point?.to ||
        ![point.from.x,point.from.y,point.to.x,point.to.y].every(v => Number.isFinite(v) && Math.abs(v) <= 100000)) return false;
    }
    return typeof envelope.visual_checksum === 'string' && envelope.visual_checksum === checksum(envelope.data, envelope.visual_digest, cursor, envelope._continuity_before);
  }
  function supported() {
    return typeof global.DecompressionStream === 'function' && typeof global.Blob === 'function' &&
      typeof global.TextDecoder === 'function' && typeof global.atob === 'function' &&
      typeof global.Blob.prototype.stream === 'function';
  }
  async function decode(raw, battleId) {
    const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!envelope || envelope.type !== 'frame_gzip_v1') return envelope;
    const expected = envelope.bytes;
    if (!supported() || !Number.isSafeInteger(expected) || expected < 1 || expected > MAX_FRAME_BYTES ||
        typeof envelope.data !== 'string' || envelope.data.length > MAX_BASE64_CHARS ||
        envelope.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(envelope.data)) {
      throw new Error('INVALID_BATTLE_FRAME');
    }
    const decoded = global.atob(envelope.data);
    const compressed = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) compressed[i] = decoded.charCodeAt(i);
    const reader = new global.Blob([compressed]).stream().pipeThrough(new global.DecompressionStream('gzip')).getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > expected || size > MAX_FRAME_BYTES) {
          await reader.cancel();
          throw new Error('BATTLE_FRAME_TOO_LARGE');
        }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    if (size !== expected) throw new Error('BATTLE_FRAME_LENGTH');
    const plain = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { plain.set(chunk, offset); offset += chunk.byteLength; }
    const frame = JSON.parse(new global.TextDecoder('utf-8', { fatal: true }).decode(plain));
    if (!frame || frame.type !== 'frame' || String(frame.battleId) !== String(battleId)) {
      throw new Error('INVALID_BATTLE_FRAME');
    }
    return frame;
  }
  const api = Object.freeze({ supported, decode, summarize, mergeVisual, carryInto, checksum, validEnvelope, validCursor, digestMatchesCursor });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.OccupyBattleFrameWire = api;
})(typeof window !== 'undefined' ? window : globalThis);

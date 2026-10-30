'use strict';

const { createHmac, randomBytes, randomUUID, timingSafeEqual } = require('crypto');

// Only presentation data is retained. The combat engine remains authoritative.
const WEAPONS = new Set(['beam', 'overdrive', 'laser', 'mixed', 'missile', 'bullet', 'stealth_bomb', 'disruptor', 'lance', 'railgun']);

function add(groups, item) {
  if (!item || !['atk', 'def'].includes(item.source_side)) return;
  const weapon = WEAPONS.has(item.fire_type) ? item.fire_type : 'other';
  if (item.count !== undefined && (!Number.isSafeInteger(item.count) || item.count < 1)) return;
  const count = item.count === undefined ? 1 : item.count;
  const key = `${item.source_side}:${weapon}`;
  let group = groups[key];
  if (!group) group = groups[key] = { source_side: item.source_side, fire_type: weapon, count: 0, samples: [] };
  if (!Number.isSafeInteger(group.count + count)) throw new Error('VISUAL_COUNT_OVERFLOW');
  group.count += count;
  const first = Number.isSafeInteger(item.first_seq) ? item.first_seq : item.seq;
  const last = Number.isSafeInteger(item.last_seq) ? item.last_seq : item.seq;
  if (Number.isSafeInteger(first)) group.first_seq = Number.isSafeInteger(group.first_seq) ? Math.min(group.first_seq, first) : first;
  if (Number.isSafeInteger(last)) group.last_seq = Number.isSafeInteger(group.last_seq) ? Math.max(group.last_seq, last) : last;
  const samples = Array.isArray(item.samples) ? item.samples.slice(0, 2) : [{ seq: item.seq, from: item.from, to: item.to }];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (!sample?.from || !sample?.to || ![sample.from.x, sample.from.y, sample.to.x, sample.to.y].every(Number.isFinite)) continue;
    const sampleSeq = Number.isFinite(sample.seq) ? sample.seq : i === 0 ? item.first_seq : item.last_seq;
    const point = { ...(Number.isFinite(sampleSeq) ? { seq: sampleSeq } : {}), from: { x: sample.from.x, y: sample.from.y }, to: { x: sample.to.x, y: sample.to.y } };
    if (!group.samples.length) group.samples.push(point);
    else if (Number.isFinite(point.seq) && Number.isFinite(group.samples[0].seq) && point.seq < group.samples[0].seq) group.samples.unshift(point);
    else if (!Number.isFinite(point.seq) || !Number.isFinite(group.samples[group.samples.length - 1].seq) || point.seq > group.samples[group.samples.length - 1].seq) group.samples.push(point);
    if (group.samples.length > 2) group.samples.splice(1, group.samples.length - 2);
  }
}

function createVisualJournal(options = {}) {
  const limit = Number.isSafeInteger(options.limit) && options.limit > 0 ? Math.min(options.limit, 128) : 128;
  const epoch = typeof options.epoch === 'string' && options.epoch && options.epoch.length <= 80 ? options.epoch : randomUUID();
  const entries = [];
  const totals = Object.create(null);
  const lastGroups = Object.create(null);
  const secret = randomBytes(32);
  let sequence = 0;
  let lastCombatSeq = 0;
  let latestFrame = null;
  function canonicalTotals(source) {
    const result = {};
    for (const key of Object.keys(source).sort()) result[key] = source[key];
    return result;
  }
  function signature(cursor) {
    return createHmac('sha256', secret).update(JSON.stringify([cursor.epoch, cursor.seq,
      canonicalTotals(cursor.totals), cursor.lastCombatSeq])).digest('base64url');
  }
  function makeCursor() {
    const cursor = { epoch, seq: sequence, totals: canonicalTotals(totals), lastCombatSeq };
    cursor.proof = signature(cursor);
    return cursor;
  }
  function signedCursor(cursor) {
    if (!cursor || cursor.epoch !== epoch || !Number.isSafeInteger(cursor.seq) || cursor.seq < 0 || cursor.seq > sequence ||
        !Number.isSafeInteger(cursor.lastCombatSeq) || cursor.lastCombatSeq < 0 || cursor.lastCombatSeq > lastCombatSeq ||
        !cursor.totals || typeof cursor.totals !== 'object' || Array.isArray(cursor.totals) ||
        typeof cursor.proof !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(cursor.proof)) return false;
    const cursorProto = Object.getPrototypeOf(cursor), totalsProto = Object.getPrototypeOf(cursor.totals);
    // Accept ordinary JSON objects from other VM realms, but not arrays/classes.
    if ((cursorProto !== null && Object.getPrototypeOf(cursorProto) !== null) ||
        (totalsProto !== null && Object.getPrototypeOf(totalsProto) !== null)) return false;
    const cursorKeys = Object.keys(cursor);
    if (cursorKeys.length !== 5 || cursorKeys.some(key => !['epoch', 'seq', 'totals', 'lastCombatSeq', 'proof'].includes(key))) return false;
    let count = 0;
    for (const key in cursor.totals) {
      if (!Object.hasOwn(cursor.totals, key)) continue;
      const value = cursor.totals[key];
      if (++count > 22 || key.length > 40 || !/^(atk|def):[a-z_]+$/.test(key) || !Object.hasOwn(totals, key) ||
          !Number.isSafeInteger(value) || value < 0 || value > totals[key]) return false;
    }
    try { if (JSON.stringify(cursor).length > 4096) return false; } catch (_) { return false; }
    const expected = Buffer.from(signature(cursor));
    const actual = Buffer.from(cursor.proof);
    return actual.length === expected.length && timingSafeEqual(expected, actual);
  }
  return {
    currentCursor: makeCursor,
    push(frame) {
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new TypeError('INVALID_BATTLE_FRAME');
      const groups = Object.create(null);
      for (const event of Array.isArray(frame.combat_events) ? frame.combat_events : []) {
        if (event?.type === 'shot_hit') add(groups, event);
      }
      for (const salvo of Array.isArray(frame.combat_salvos) ? frame.combat_salvos : []) add(groups, salvo);
      for (const [key, group] of Object.entries(groups)) {
        if (!Number.isSafeInteger((totals[key] || 0) + group.count)) throw new Error('VISUAL_COUNT_OVERFLOW');
      }
      for (const [key, group] of Object.entries(groups)) {
        const updated = (totals[key] || 0) + group.count;
        totals[key] = updated;
        lastGroups[key] = group;
        if (Number.isSafeInteger(group.last_seq)) lastCombatSeq = Math.max(lastCombatSeq, group.last_seq);
      }
      latestFrame = frame;
      sequence++;
      entries.push({ seq: sequence, groups: Object.values(groups) });
      if (entries.length > limit) entries.shift();
      return makeCursor();
    },
    recover(cursor) {
      if (!latestFrame) return null;
      const signed = signedCursor(cursor);
      // A new observer receives only the current interval, not arbitrary earlier fire.
      const from = signed ? cursor.seq : sequence - 1;
      let incomplete = !signed;
      const groups = Object.create(null);
      if (signed && from < entries[0].seq - 1) {
        // Exact signed cumulative counts survive ring eviction. One genuine most
        // recent trajectory represents each category; no historical hit is invented.
        for (const [key, total] of Object.entries(totals)) {
          const count = total - (cursor.totals[key] || 0);
          if (!count) continue;
          const last = lastGroups[key];
          const sample = last.samples.at(-1);
          if (!sample || !Number.isSafeInteger(sample.seq) || sample.seq <= cursor.lastCombatSeq) incomplete = true;
          groups[key] = { source_side: last.source_side, fire_type: last.fire_type, count,
            samples: last.samples.slice(-1), first_seq: cursor.lastCombatSeq + 1,
            first_seq_is_lower_bound: true, last_seq: last.last_seq };
        }
      } else {
        for (const entry of entries) if (entry.seq > from) for (const group of entry.groups) add(groups, group);
      }
      const combat_salvos = Object.values(groups).map(group => ({ ...group, seq: group.last_seq,
        id: `recovery:${epoch}:${sequence}:${group.source_side}:${group.fire_type}` }));
      const aggregated = combat_salvos.reduce((sum, salvo) => sum + salvo.count, 0);
      return { epoch, seq: sequence, cursor: makeCursor(), frame: { ...latestFrame, combat_events: [], combat_salvos: [], combat_events_dropped: aggregated }, combat_salvos, incomplete };
    },
  };
}

module.exports = { createVisualJournal };

(function (global) {
  'use strict';

  // gzip's trailer carries a CRC32 checksum, checked by DecompressionStream.
  const MAX_FRAME_BYTES = 2 * 1024 * 1024;
  const MAX_BASE64_CHARS = Math.ceil((MAX_FRAME_BYTES + 1024) / 3) * 4;
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
  global.OccupyBattleFrameWire = Object.freeze({ supported, decode });
})(window);

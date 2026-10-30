'use strict';

const { gzipSync, constants } = require('zlib');
const MAX_DECODED_FRAME_BYTES = 2 * 1024 * 1024;
const MIN_COMPRESS_BYTES = 4096;

// Build one optional compressed payload per broadcast, not per spectator.
function encodeBattleFrame(battleId, frame, compress) {
  const raw = JSON.stringify({ type: 'frame', battleId, ...frame });
  if (!compress) return { raw, compressed: null };
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes < MIN_COMPRESS_BYTES || bytes > MAX_DECODED_FRAME_BYTES) return { raw, compressed: null };
  try {
    const data = gzipSync(Buffer.from(raw), { level: constants.Z_BEST_SPEED }).toString('base64');
    const compressed = JSON.stringify({ type: 'frame_gzip_v1', bytes, data });
    return { raw, compressed: compressed.length < bytes ? compressed : null };
  } catch (_) {
    return { raw, compressed: null };
  }
}

module.exports = { encodeBattleFrame, MAX_DECODED_FRAME_BYTES };

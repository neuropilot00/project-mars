'use strict';

// Persisted timelines may be thinned; playback time follows ticks, not frame count.
function replayDelayMs(current, next, tickMs, speed = 8) {
  if (!next) return 10;
  const a = Number(current?.t), b = Number(next?.t);
  const delta = Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 5;
  const tick = Number.isFinite(Number(tickMs)) && Number(tickMs) > 0 ? Number(tickMs) : 200;
  return Math.min(2147483647, Math.max(10, delta * tick / Math.max(8, speed)));
}

function replaySpeed(frames, tickMs) {
  let durationAtEight = 0;
  for (let i = 0; i + 1 < frames.length; i++) durationAtEight += replayDelayMs(frames[i], frames[i + 1], tickMs);
  // Long archival timelines should fit approximately three minutes without dropping snapshots.
  return Math.max(8, durationAtEight * 8 / 180000);
}

function replayStreamTtlMs(frames, tickMs) {
  let duration = 0;
  const speed = replaySpeed(frames, tickMs);
  for (let i = 0; i < frames.length; i++) duration += replayDelayMs(frames[i], frames[i + 1], tickMs, speed);
  return Math.min(2147483647, Math.max(60000, Math.ceil(duration + 60000)));
}

module.exports = { replayDelayMs, replaySpeed, replayStreamTtlMs };

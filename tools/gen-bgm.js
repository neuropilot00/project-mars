#!/usr/bin/env node
/*
 * tools/gen-bgm.js — 캠페인 BGM 40트랙 절차적 합성(WAV) 생성기.
 *
 * 음악 생성 툴 없이도 게임 SFX(WebAudio 절차생성)와 같은 원리로, 무드별 앰비언트/텐션 루프를 신디사이즈한다.
 * 순수 사인 파셜(주파수를 loop 길이의 정수배로 양자화) → 이음매 없는 무한 루프(클릭 없음). 다운로드 아님 = 로열티 프리.
 *
 *   node tools/gen-bgm.js            # docs/campaign-story 의 고유 bgm 이름 전부 → /tmp 에 WAV 생성, 경로 출력
 * 이후 ffmpeg 로 MP3 인코딩(별도 셸 단계). 결과는 assets/audio/bgm/<name>.mp3.
 *
 * 무드는 트랙 이름 키워드로 결정론 매핑. 프로 OST 아님 — 기능적 분위기 베드(같은 파일명으로 언제든 교체 가능).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || '/tmp/bgm-wav';
const SR = 44100, LOOP = 24; // 24초 루프
const N = SR * LOOP;

function uniqueTracks() {
  const set = new Set();
  const dir = path.join(ROOT, 'docs', 'campaign-story');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
    const scenes = Array.isArray(d) ? d : (d.scenes || []);
    for (const s of scenes) if (s && s.bgm) set.add(s.bgm);
  }
  return [...set].sort();
}
// 이름 → 결정론적 시드
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// 무드 프리셋: 반음 인터벌 세트 + 루트대역 + 밝기 + 펄스 BPM(0=없음) + 노이즈성 shimmer
function moodOf(name) {
  const n = name.toLowerCase();
  if (n.includes('battle')) return { chord: [0, 7, 12], root: 65, bright: 0.55, bpm: 100, swell: 0.10, name: 'battle' };
  if (n.includes('defeat') || n.includes('casualty')) return { chord: [0, 3, 7, 10], root: 49, bright: 0.20, bpm: 0, swell: 0.22, name: 'defeat' };
  if (n.includes('victory') || n.includes('ending') || n.includes('arrival') || n.includes('resolve')) return { chord: [0, 4, 7, 11], root: 87, bright: 0.5, bpm: 0, swell: 0.16, name: 'resolve' };
  if (n.includes('choice')) return { chord: [0, 5, 7], root: 73, bright: 0.35, bpm: 0, swell: 0.14, name: 'choice' };
  if (n.includes('tension_high') || n.includes('intense')) return { chord: [0, 1, 7], root: 62, bright: 0.5, bpm: 76, swell: 0.16, name: 'tension_high' };
  if (n.includes('tension') || n.includes('building')) return { chord: [0, 2, 7], root: 58, bright: 0.35, bpm: 50, swell: 0.18, name: 'tension' };
  if (n.includes('melancholy')) return { chord: [0, 3, 10], root: 55, bright: 0.25, bpm: 0, swell: 0.20, name: 'melancholy' };
  // ambient 계열 (기본). heavy=낮게, warm=장3도, cv=어둡게
  let root = 82, chord = [0, 5, 7], bright = 0.32, swell = 0.15;
  if (n.includes('heavy')) root = 58;
  if (n.includes('warm')) { chord = [0, 4, 7]; bright = 0.4; }
  if (n.startsWith('cv')) { chord = [0, 3, 8]; root = 65; bright = 0.28; }
  if (n.includes('vast')) { bright = 0.45; }
  if (n.includes('low') || n.includes('quiet') || n.includes('night')) { root = 55; bright = 0.22; }
  return { chord, root, bright, bpm: 0, swell, name: 'ambient' };
}
function semi(root, s) { return root * Math.pow(2, s / 12); }
// 주파수를 loop 정수 사이클로 양자화(이음매 없는 루프)
function qFreq(f) { return Math.max(1, Math.round(f * LOOP)) / LOOP; }

function synth(name) {
  const m = moodOf(name); const rnd = rng(hash(name));
  const buf = new Float64Array(N);
  // 파셜: 각 코드음 × (1,2,3,4 옥타브) 밝기 감쇠
  const voices = [];
  for (const c of m.chord) {
    const base = semi(m.root, c) * (1 + (rnd() - 0.5) * 0.004); // 미세 디튠
    const octs = [1, 2, 3, 4];
    for (let oi = 0; oi < octs.length; oi++) {
      const amp = Math.pow(m.bright, oi) / m.chord.length;
      if (amp < 0.012) continue;
      voices.push({ f: qFreq(base * octs[oi]), a: amp, ph: rnd() * Math.PI * 2, lfo: (1 + Math.floor(rnd() * 3)) / LOOP, ld: 0.25 + rnd() * 0.25 });
    }
  }
  const swellF = 1 / LOOP; // 전체 1회 스웰
  const beats = m.bpm ? Math.max(1, Math.round(m.bpm / 60 * LOOP)) : 0;
  const pulseF = beats / LOOP;
  for (let i = 0; i < N; i++) {
    const t = i / SR; let v = 0;
    for (const vo of voices) {
      const lfo = 1 - vo.ld + vo.ld * (0.5 + 0.5 * Math.sin(2 * Math.PI * vo.lfo * t));
      v += vo.a * lfo * Math.sin(2 * Math.PI * vo.f * t + vo.ph);
    }
    // 전체 스웰
    v *= (1 - m.swell) + m.swell * (0.5 + 0.5 * Math.sin(2 * Math.PI * swellF * t - Math.PI / 2));
    // 펄스(배틀/텐션): 반음절 리듬 게이트
    if (beats) { const ph = (pulseF * t) % 1; const env = Math.exp(-Math.pow((ph - 0.0) * 6, 2)) + Math.exp(-Math.pow((ph - 1) * 6, 2)); v *= 0.55 + 0.45 * Math.min(1, env); }
    buf[i] = v;
  }
  // 정규화(피크 0.7)
  let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const g = peak > 0 ? 0.7 / peak : 1;
  const pcm = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++) { let s = Math.max(-1, Math.min(1, buf[i] * g)); pcm.writeInt16LE((s * 32767) | 0, i * 2); }
  return pcm;
}
function wav(pcm) {
  const h = Buffer.alloc(44); const dl = pcm.length;
  h.write('RIFF', 0); h.writeUInt32LE(36 + dl, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dl, 40);
  return Buffer.concat([h, pcm]);
}

const tracks = uniqueTracks();
fs.mkdirSync(OUT, { recursive: true });
let ok = 0;
for (const t of tracks) { fs.writeFileSync(path.join(OUT, t + '.wav'), wav(synth(t))); ok++; }
console.log('WAV 생성:', ok, '트랙 →', OUT);
console.log(tracks.join(' '));

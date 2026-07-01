#!/usr/bin/env node
/*
 * tools/sea-i18n.js — SEA(id/vi/th) 로컬라이징 유지보수 도구.
 *
 * 배경: en/ko/ja/zh 는 tl(en,ko,ja,zh) 인라인 인자 + I18N 사전으로 처리된다.
 *   id/vi/th 는 코드 폭증을 피하려고 별도 파일 assets/i18n-sea.js 에 담는다:
 *     - window.TL_SEA = { "<en 문자열>": {id,vi,th} }  ← inline tl() 폴백용(en 기준 조회)
 *     - I18N.id/vi/th 키 사전                          ← data-i18n(t()) 경로용
 *   assets/i18n.js 의 tl() 이 SEA 언어이고 인라인 인자가 없으면 TL_SEA[en] 을 조회한다.
 *   ⚠️ assets/i18n-sea.js 는 이 도구의 산출물이다 — 수동 편집 금지.
 *
 * 새 tl()/data-i18n 문자열을 추가하면 재생성 전까지 en 폴백된다. 사용법:
 *   node tools/sea-i18n.js check              # 현재 커버리지/누수 리포트 (미커버 있으면 exit 1 — CI용)
 *   node tools/sea-i18n.js extract [outdir]   # 미커버(신규) 문자열만 청크로 추출 → 번역 대상
 *   node tools/sea-i18n.js assemble [dir]     # dir 의 out-*.json + 기존 번역 병합 → i18n-sea.js 재작성
 *
 * 번역 자체는 LLM 이 한다(이 스크립트는 추출/검증/조립만). 워크플로 재생성 절차는 CLAUDE.md v7.464 핸드오프 참조.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEA_FILE = path.join(ROOT, 'assets', 'i18n-sea.js');
const CHUNK = 90;
// 번역 불필요(브랜드/통화/약어) — TL_SEA 조회 시 en 그대로여도 정상인 토큰
const SKIP_LEAK = new Set(['GP', 'PP', 'USDT', 'HP', 'XP', 'PvP', 'AI', 'VIP', 'POI', 'APY', 'NFT', 'ID', 'OK', 'OFF', 'ON', 'MAX']);

function unesc(s) { return s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
function hasAlpha(s) { return /[A-Za-z]{2,}/.test(s); }

// ── 현재 코드베이스가 요구하는 번역 대상 수집 ─────────────────────
function collectTargets() {
  const items = []; // {t:'tl'|'key', k, en}
  const seenTl = new Set();
  // 1) tl() 1st arg
  const patTl = /tl\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const f of fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
    let m;
    while ((m = patTl.exec(src))) {
      const en = unesc(m[1]);
      if (hasAlpha(en) && !seenTl.has(en)) { seenTl.add(en); items.push({ t: 'tl', k: en, en }); }
    }
  }
  // 2) index.html data-i18n 키 → I18N.en 값
  const i18n = fs.readFileSync(path.join(ROOT, 'assets', 'i18n.js'), 'utf8');
  const enStart = i18n.indexOf('en:');
  const koStart = i18n.search(/\bko\s*:\s*\{/);
  const enBlock = i18n.slice(enStart, koStart);
  const kv = {};
  const patKv = /([a-z_][a-z0-9_]*)\s*:\s*'((?:[^'\\]|\\.)*)'/g;
  let mk;
  while ((mk = patKv.exec(enBlock))) kv[mk[1]] = unesc(mk[2]);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const keys = [...new Set([...html.matchAll(/data-i18n="([a-z_]+)"/g)].map(x => x[1]))].sort();
  for (const k of keys) { const v = kv[k]; if (v && hasAlpha(v)) items.push({ t: 'key', k, en: v }); }
  return items;
}

// ── 기존 i18n-sea.js 로드 (window/I18N 스텁) ──────────────────────
function loadExisting() {
  if (!fs.existsSync(SEA_FILE)) return { TL_SEA: {}, id: {}, vi: {}, th: {} };
  const sandbox = { window: {}, I18N: { en: {} } };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SEA_FILE, 'utf8'), sandbox);
  const I = sandbox.I18N;
  return { TL_SEA: sandbox.window.TL_SEA || {}, id: I.id || {}, vi: I.vi || {}, th: I.th || {} };
}

function tokens(s) { return (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort(); }
function ltCount(s) { return (s.match(/</g) || []).length; }

// ── check ──────────────────────────────────────────────────────
function check() {
  const items = collectTargets();
  const ex = loadExisting();
  let missing = [], leak = 0, tokBad = 0;
  for (const it of items) {
    const tr = it.t === 'tl' ? ex.TL_SEA[it.k] : { id: ex.id[it.k], vi: ex.vi[it.k], th: ex.th[it.k] };
    const covered = tr && ['id', 'vi', 'th'].every(L => tr[L] != null && tr[L] !== '');
    if (!covered) { missing.push(it); continue; }
    for (const L of ['id', 'vi', 'th']) {
      const v = tr[L];
      if (v === it.en && hasAlpha(it.en) && !SKIP_LEAK.has(it.en.trim())) leak++;
      if (tokens(v).join('|') !== tokens(it.en).join('|') || ltCount(v) !== ltCount(it.en)) tokBad++;
    }
  }
  const total = items.length, cov = total - missing.length;
  console.log(`[SEA i18n] 대상 ${total} | 커버 ${cov} (${(cov / total * 100).toFixed(1)}%) | 미커버 ${missing.length}`);
  console.log(`  영문 누수(id/vi/th==en): ${leak} | 토큰(플레이스홀더+태그수) 불일치: ${tokBad}`);
  if (missing.length) {
    console.log('  미커버 샘플:');
    for (const it of missing.slice(0, 10)) console.log(`    [${it.t}] ${JSON.stringify(it.en).slice(0, 70)}`);
    process.exitCode = 1;
  } else {
    console.log('  ✅ 전체 커버 (신규 문자열 없음)');
  }
  return { items, ex, missing };
}

// ── extract (미커버만) ─────────────────────────────────────────
function extract(outdir) {
  outdir = outdir || path.join(ROOT, '.sea-work');
  fs.mkdirSync(outdir, { recursive: true });
  const { missing } = check();
  if (!missing.length) { console.log('추출할 신규 문자열 없음.'); return; }
  const chunks = [];
  for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
  chunks.forEach((c, i) => {
    fs.writeFileSync(path.join(outdir, `in-${String(i).padStart(2, '0')}.json`), JSON.stringify(c, null, 0));
  });
  console.log(`추출 완료: ${missing.length} 문자열 → ${chunks.length} 청크 (${outdir}/in-NN.json)`);
  console.log('다음: 각 in-NN 을 id/vi/th 로 번역해 out-NN.json([{t,k,id,vi,th}]) 작성 후 `assemble` 실행.');
}

// ── assemble (기존 + 신규 out 병합) ─────────────────────────────
function assemble(dir) {
  dir = dir || path.join(ROOT, '.sea-work');
  const ex = loadExisting();
  const TL_SEA = Object.assign({}, ex.TL_SEA);
  const K = { id: Object.assign({}, ex.id), vi: Object.assign({}, ex.vi), th: Object.assign({}, ex.th) };
  // 기존 I18N.id 에는 en 복사분도 섞여 있을 수 있으나, 재작성 시 신규 out 만 덮어쓰면 됨.
  let added = 0;
  const outs = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^out-\d+\.json$/.test(f)) : [];
  for (const f of outs) {
    for (const it of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (it.t === 'tl') TL_SEA[it.k] = { id: it.id, vi: it.vi, th: it.th };
      else { K.id[it.k] = it.id; K.vi[it.k] = it.vi; K.th[it.k] = it.th; }
      added++;
    }
  }
  const j = o => JSON.stringify(o, null, 0);
  const body = [
    '// assets/i18n-sea.js — SEA(id/vi/th) 번역 (자동 생성, 수동 편집 금지). tools/sea-i18n.js 로 재생성.',
    '// TL_SEA[en]={id,vi,th}: inline tl() 폴백용. I18N.id/vi/th: data-i18n 사전용.',
    'window.TL_SEA = ' + j(TL_SEA) + ';',
    '(function(){ if(typeof I18N==="undefined") return;',
    '  var _id=' + j(K.id) + ';',
    '  var _vi=' + j(K.vi) + ';',
    '  var _th=' + j(K.th) + ';',
    '  I18N.id = Object.assign({}, I18N.en, I18N.id||{}, _id);',
    '  I18N.vi = Object.assign({}, I18N.en, I18N.vi||{}, _vi);',
    '  I18N.th = Object.assign({}, I18N.en, I18N.th||{}, _th);',
    '})();',
    '',
  ].join('\n');
  fs.writeFileSync(SEA_FILE, body);
  console.log(`재작성: assets/i18n-sea.js | TL_SEA ${Object.keys(TL_SEA).length} | keys ${Object.keys(K.id).length} | out 청크에서 +${added}`);
}

const mode = process.argv[2];
if (mode === 'check') check();
else if (mode === 'extract') extract(process.argv[3]);
else if (mode === 'assemble') assemble(process.argv[3]);
else { console.log('usage: node tools/sea-i18n.js <check|extract|assemble> [dir]'); process.exit(2); }

#!/usr/bin/env node
/*
 * tools/voice-manifest.js — 캠페인 라인별 음성(영어 전용) 제작 매니페스트 생성.
 *
 * docs/campaign-story/*.json 의 narration/dialogue/ending 라인을 전부 뽑아,
 * 각 라인의 화자 + 영어 대사(text.en) + **저장해야 할 파일명**을 목록으로 만든다.
 * 파일명 규칙은 런타임 재생부(assets/campaign-system.js #_campaignVoiceFile)와 동일:
 *     <questId>_<sceneId>_l<lineIdx>.mp3
 * 이 파일명으로 mp3 를 assets/audio/voice/ 에 넣으면 캠페인에서 자동 재생된다.
 *
 * 사용:
 *   node tools/voice-manifest.js
 * 산출:
 *   assets/audio/voice/voice-manifest.json  — [{questId,sceneId,lineIdx,type,speaker,chars,file,en}]
 *   assets/audio/voice/voice-manifest.csv   — file,speaker,type,chars,text  (TTS 배치 입력용; 화자별 정렬)
 *   콘솔: 화자별 라인수/글자수 요약(보이스 캐스팅·비용 산정용).
 *
 * 정책: 음성은 영어 베이스(GAME_VOICE_LANG='en'). 화자별로 보이스를 배정해 배치 생성 → 파일명대로 저장 → 드롭.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const STORY = path.join(ROOT, 'docs', 'campaign-story');
const OUTDIR = path.join(ROOT, 'assets', 'audio', 'voice');

function enText(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object') return t.en || '';
  return '';
}
function csvCell(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; }

const rows = [];
const bySpeaker = {};
const questIds = new Set();
for (const f of fs.readdirSync(STORY).filter(f => f.endsWith('.json'))) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(STORY, f), 'utf8')); } catch (e) { console.warn('skip (parse):', f, e.message); continue; }
  const questId = d.questId || d.campaignId || f.replace(/\.json$/, '');
  questIds.add(questId);
  const scenes = Array.isArray(d) ? d : (d.scenes || []);
  for (const s of scenes) {
    if (!s || (s.type !== 'narration' && s.type !== 'dialogue' && s.type !== 'ending')) continue;
    const lines = s.lines || [];
    for (let i = 0; i < lines.length; i++) {
      const en = enText(lines[i].text).trim();
      if (!en) continue;
      const speaker = lines[i].speaker || s.speaker || 'narrator';
      const file = `${questId}_${s.id}_l${i}.mp3`;
      rows.push({ questId, sceneId: s.id, lineIdx: i, type: s.type, speaker, chars: en.length, file, en });
      bySpeaker[speaker] = bySpeaker[speaker] || { lines: 0, chars: 0 };
      bySpeaker[speaker].lines++; bySpeaker[speaker].chars += en.length;
    }
  }
}

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'voice-manifest.json'), JSON.stringify(rows, null, 0));
// CSV: 화자별로 묶어 정렬(같은 화자 = 같은 보이스로 연속 배치 생성하기 좋게)
const sorted = rows.slice().sort((a, b) => a.speaker.localeCompare(b.speaker) || a.file.localeCompare(b.file));
const csv = ['file,speaker,type,chars,text'].concat(
  sorted.map(r => [csvCell(r.file), csvCell(r.speaker), csvCell(r.type), r.chars, csvCell(r.en)].join(','))
).join('\n');
fs.writeFileSync(path.join(OUTDIR, 'voice-manifest.csv'), csv + '\n');

const totalChars = rows.reduce((a, r) => a + r.chars, 0);
console.log(`[voice-manifest] 라인 ${rows.length} | 화자 ${Object.keys(bySpeaker).length} | 총 ${totalChars.toLocaleString()}자 | questId ${questIds.size}종`);
console.log(`  → ${path.relative(ROOT, path.join(OUTDIR, 'voice-manifest.json'))} , voice-manifest.csv`);
console.log('  화자별(라인/글자):');
Object.entries(bySpeaker).sort((a, b) => b[1].chars - a[1].chars).forEach(([sp, v]) => {
  console.log(`    ${sp.padEnd(18)} ${String(v.lines).padStart(4)} 라인  ${String(v.chars).padStart(7)} 자`);
});
console.log('\n  파일명 규칙(런타임과 동일): <questId>_<sceneId>_l<lineIdx>.mp3 → assets/audio/voice/ 에 저장');

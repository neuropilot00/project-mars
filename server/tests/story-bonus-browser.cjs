'use strict';
// Manual responsive fixture: actual story markup/CSS/JS and translation files.
// No game bootstrap, API, account or database. Static mode controls matchMedia
// through an explicit fixture adapter; it does not prove an OS motion preference.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const langs = ['en', 'ko', 'ja', 'zh', 'id', 'vi', 'th'];
const assets = ['assets/main.css', 'assets/i18n.js', 'assets/i18n-sea.js'];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'");
  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end('{"ok":true,"fixtureOnly":true,"database":false}');
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (assets.includes(url.pathname.slice(1))) {
    res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
    return res.end(read(url.pathname.slice(1)));
  }
  if (url.pathname === '/story.js') {
    const js = read('assets/main-game.js');
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(js.slice(js.indexOf('var _loreReturnFocus = null;'), js.indexOf('// ═══════ NOTIFICATION SYSTEM')));
  }
  if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
  const lang = langs.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'ko';
  const staticMode = url.searchParams.get('mode') === 'static';
  const html = read('index.html');
  const markup = html.slice(html.indexOf('<div class="lore-bg"'), html.indexOf('<!-- ═══ ARENA OVERLAY'));
  const trigger = html.match(/<button[^>]+class="tb-title lore-trigger"[^>]*>.*?<\/button>/)[0]
    .replace('data-action="showLorePopup"', 'onclick="showLorePopup()"');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(`<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mars · Optional story channel</title>
<link rel="stylesheet" href="/assets/main.css"><style>body{background:var(--bg);color:var(--tx);font:16px/1.5 system-ui;padding:20px;overflow:auto}h1{font-size:18px}form{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}select,form button{min-height:44px;font:14px system-ui;padding:8px;background:var(--surface1);border:1px solid var(--bdr2);border-radius:8px;color:var(--tx)}.tb-title{font-size:18px}</style>
<body><h1>OCCUPY MARS · 선택형 통신 검수</h1><p>실제 스토리/UI 코드 · 게임 API/계정 없음</p><form><select name="lang" aria-label="검수 언어">${langs.map(l => `<option value="${l}"${l === lang ? ' selected' : ''}>${l}</option>`).join('')}</select><select name="mode" aria-label="스토리 모드"><option value="animated"${!staticMode ? ' selected' : ''}>원래 애니메이션</option><option value="static"${staticMode ? ' selected' : ''}>정적 읽기 · 더미 motion</option></select><button>조건 적용</button></form><header>${trigger}</header><button type="button">배경 포커스 확인</button>${markup}
<script src="/assets/i18n.js"></script><script src="/assets/i18n-sea.js"></script><script>LANG=${JSON.stringify(lang)};var _loreCrawlData=null;${staticMode ? "window.matchMedia=function(){return {matches:true,addEventListener:function(){},removeEventListener:function(){}};};" : ''}</script><script src="/story.js"></script></body></html>`);
});
server.listen(0, '127.0.0.1', () => console.log('Story-only local fixture: http://127.0.0.1:' + server.address().port + '/'));

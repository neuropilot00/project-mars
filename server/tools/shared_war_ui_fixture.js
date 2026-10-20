'use strict';
// Local rendering fixture for the real siege panel functions. All responses are
// fixed dummy values. It neither loads the application server nor any config.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function panelSource() {
  const source = fs.readFileSync(path.join(root, 'assets/world-live-feeds.js'), 'utf8');
  return source.slice(source.indexOf('  function _siegeSideList'), source.indexOf('  // ── Betting panel loader'));
}
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const confirmMarkup = index.slice(index.indexOf('<div id="gameConfirm"'), index.indexOf('<!-- ═══ OPEN BETA NOTICE'));
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:");
  const query = new URL(req.url, 'http://127.0.0.1').searchParams;
  if (['/assets/main.css','/assets/i18n.js','/assets/i18n-sea.js','/assets/game-dialogs.js'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(fs.readFileSync(path.join(root, req.url.slice(1)), 'utf8')); return; }
  if (req.url === '/panel.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(panelSource()); return; }
  const lang = ['en','ko','ja','zh','id','vi','th'].includes(query.get('lang')) ? query.get('lang') : 'ko';
  const resolved = query.get('resolved') === '1';
  const role = query.get('role') || 'atk';
  const participation = { side: role === 'outsider' ? null : role, canCommit: !resolved && role !== 'outsider', maxFleetsPerSide: 20, result: resolved ? 'def' : null };
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="${lang}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared siege fixture</title><link rel="stylesheet" href="/assets/main.css"><style>
  body{font:14px/1.6 var(--fn);margin:0;padding:16px;max-width:420px;overflow:auto;height:auto;min-height:100vh}h1{margin-bottom:12px}p{margin-bottom:12px}.sz-btn,dialog button{min-height:44px;font-size:13px}dialog{background:var(--surface1);border:1px solid var(--bdr2);border-radius:12px;color:var(--tx);max-width:calc(100% - 24px);padding:20px;margin:auto}dialog p{line-height:1.7;font-size:15px}dialog::backdrop{background:rgba(0,0,0,.65)}#log{overflow-wrap:anywhere;font-size:13px;margin-top:12px}</style><h1 style="font-size:18px">공동 공성 작전</h1><p>고정 더미 UI · 실제 서비스/계정/자산 없음</p><div id="siegeFleetPanel_7"></div><p id="log" role="status"></p>${confirmMarkup}
  <script src="/assets/i18n.js"></script><script src="/assets/i18n-sea.js"></script><script src="/assets/game-dialogs.js"></script><script>LANG=${JSON.stringify(lang)};window.walletState={address:'newcomer'};function escapeHtml(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}function getAuthHeaders(){return {}};
  var participation=${JSON.stringify(participation)};
  function wlfReadFetch(key,url){return Promise.resolve(url.includes('/roster')?{roster:{status:${resolved ? "'resolved'" : "'pending'"},sector_code:'relay',resolution_mode:'fleet_battle',fleet_battle_id:${resolved ? "'81'" : 'null'},commits:[{side:'atk',fleet_id:'31',fleet_name:'새 길드원 함대',ship_count:2},{side:'def',fleet_id:'32',fleet_name:'수비 함대',ship_count:3}]}}:url==='/api/fleets'?{fleets:[{id:'31',name:'내 함대',ships_alive:2}]}:{participation:participation})}
  var fetch=function(url,options){document.getElementById('log').textContent='더미 합류 요청: '+url;return Promise.resolve({ok:true,json:()=>Promise.resolve({success:true,side:participation.side})})};
  function showToast(msg){document.getElementById('log').textContent=msg}function openCommandCenter(tab){document.getElementById('log').textContent='이동: '+tab}function openBattleViewer(id){document.getElementById('log').textContent='공동 전투: '+id}function loadSiegeInfoPanel(){showToast('더미 결과를 표시했습니다')};
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.getAttribute('data-i18n')));
  </script><script src="/panel.js"></script><script>_loadSiegeFleetPanel({id:'7',status:${resolved ? "'resolved'" : "'pending'"}},'relay','newcomer');</script></html>`);
});
server.listen(0, '127.0.0.1', () => console.log('Shared siege dummy UI: http://127.0.0.1:' + server.address().port));

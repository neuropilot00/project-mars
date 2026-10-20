'use strict';
// Manual browser layout/interaction fixture ONLY. No DB, identity server, real
// account, key provisioning or remote requests. All values are public test data.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const codes=Array.from({length:10},(_,i)=>String(i+1).repeat(4)+'-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA');
const files={
  '/authenticator.html':['authenticator.html','text/html; charset=utf-8'],
  '/assets/authenticator-copy.js':['assets/authenticator-copy.js','text/javascript'],
  '/assets/main.css':['assets/main.css','text/css'],
  '/assets/i18n.js':['assets/i18n.js','text/javascript'],
  '/assets/authenticator.js':['assets/authenticator.js','text/javascript'],
  '/assets/authenticator.css':['assets/authenticator.css','text/css'],
  '/assets/lib/qrcode-generator.js':['assets/lib/qrcode-generator.js','text/javascript']
};
const enrollment={enrollmentId:'a'.repeat(64),enrollmentSecret:'b'.repeat(64),secret,otpauthUri:'otpauth://totp/OCCUPY%20MARS%3Afixture_user?secret='+secret+'&issuer=OCCUPY%20MARS&algorithm=SHA1&digits=6&period=30',expiresIn:300};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'");
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Mars-Fixture','public-fixed-test-data');
  if(req.method==='GET'&&url.pathname==='/story.html') {
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const markup=html.slice(html.indexOf('<div class="lore-bg"'),html.indexOf('<!-- ═══ ARENA OVERLAY'));
    const trigger=html.match(/<button[^>]+class="tb-title lore-trigger"[^>]*>.*?<\/button>/)[0].replace('data-action="showLorePopup"','onclick="showLorePopup()"');
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/main.css"><style>:root{--fn:system-ui}body{background:#0b0710;color:#eee;font:16px system-ui;padding:24px}.tb-title{font-size:18px}</style><title>Mars isolated story</title><body><header>'+trigger+'</header><p>Isolated story: current source / fixed local text. No game API.</p><button type="button">Background focus check</button>'+markup+'<script src="/assets/i18n.js"></script><script>LANG="ko";var _loreCrawlData=null;</script><script src="/fixture-lore.js"></script></body></html>');return;
  }
  if(req.method==='GET'&&url.pathname==='/fixture-lore.js') {
    const js=fs.readFileSync(path.join(root,'assets/main-game.js'),'utf8');
    res.setHeader('Content-Type','text/javascript');res.end(js.slice(js.indexOf('var _loreReturnFocus'),js.indexOf('// ═══════ NOTIFICATION SYSTEM')));return;
  }
  if(req.method==='GET'&&files[url.pathname]){const[file,type]=files[url.pathname];res.setHeader('Content-Type',type);res.end(fs.readFileSync(path.join(root,file)));return;}
  if(req.method==='GET'&&url.pathname==='/api/auth/totp/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({enabled:true}));return;}
  if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<h1>Fixture session accepted</h1><p>Fixed dummy data only. No real account or game server was used.</p>');return;}
  if(req.method==='POST'&&url.pathname.startsWith('/api/auth/totp/')){
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});req.on('end',()=>{
      let input;try{input=JSON.parse(body);}catch(_){res.writeHead(400);res.end();return;}
      const action=url.pathname.split('/').at(-1);let output;
      if(action==='start'||action==='recover')output=enrollment;
      else if(action==='verify'&&input.code==='287082')output={recoveryCodes:codes,confirmationNonce:'fixture-confirmation'};
      else if(action==='activate'&&codes.includes(input.recoveryCode))output={success:true,token:'fixture.not-a-real.session',user:{wallet:'0x'+'1'.repeat(40)}};
      else{res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"auth_invalid"}');return;}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(output));
    });return;
  }
  res.writeHead(404);res.end();
});
server.listen(0,'127.0.0.1',()=>console.log('Isolated public-fixture UI: http://127.0.0.1:'+server.address().port+'/authenticator.html?lang=ko'));

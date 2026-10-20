'use strict';
// Original tactical HTML/inline CSS/loader/boot with localhost dummy HTTP only.
// No server/index, database, identity, config, WebSocket game, or credentials.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const files={'/tactical.html':['assets/tactical-lab-v11.html','text/html; charset=utf-8'],'/fleet-field-guide.js':['assets/fleet-field-guide.js','text/javascript'],'/fleet-field-guide.css':['assets/fleet-field-guide.css','text/css'],'/battlefield-art.js':['assets/battlefield-art.js','text/javascript']};
const counts={catalog:0,presets:0,upgrades:0,posts:0};
const catalog={ships:[{code:'mcc_int',name_en:'Dummy interceptor',name_ko:'더미 요격기',size_class:'frigate',faction_code:'mcc',role:'dps',base_hp:100,base_atk:10,base_def:2,base_speed:1,fire_interval:150,fire_type:'bullet',render_radius:2}],resources:[],factions:[],counts:{ships:1,resources:0,factions:0}};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Mars-Fixture','tactical-load-error-fixed-dummy');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'");
 if(req.method!=='GET'){counts.posts++;res.writeHead(405);res.end();return;}
 if(url.pathname==='/fixture-counts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(counts));return;}
 if(files[url.pathname]){const[file,type]=files[url.pathname];res.setHeader('Content-Type',type);res.end(fs.readFileSync(path.join(root,file)));return;}
 if(url.pathname.startsWith('/api/tactical-lab/')){
  const failure=new URL(req.headers.referer||'http://127.0.0.1').searchParams.get('failure')||'500';
  const status=['401','404','500'].includes(failure)?Number(failure):200;
  res.setHeader('Content-Type','application/json');res.statusCode=status;
  if(url.pathname.endsWith('/catalog')){counts.catalog++;res.end(JSON.stringify(status===200?catalog:{error:'FIXTURE_UNAVAILABLE'}));return;}
  if(url.pathname.endsWith('/fleet-presets')){counts.presets++;const fleet={id:'Dummy',dbFleetId:'31',ownerWallet:failure==='noowner'?null:'dummy...wner',flagship:'mcc_int',escort:{}};res.end(JSON.stringify(status!==200?{error:'FIXTURE_UNAVAILABLE'}:{source:'battle:71',atk:failure==='empty'?[]:[fleet],def:[]}));return;}
 }
 res.writeHead(404);res.end();
});
server.on('upgrade',(req,socket)=>{counts.upgrades++;socket.destroy();});
server.listen(Number(process.argv[2])||0,'127.0.0.1',()=>console.log('Tactical load error fixture: http://127.0.0.1:'+server.address().port+'/tactical.html?mode=battle&bid=71&lang=ko&failure=500'));

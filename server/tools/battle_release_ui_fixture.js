'use strict';
// Original viewer HTML/art/CSS with fixed public dummy snapshots. Local visual
// fixture only: no game server, auth, DB, scheduler, money or external service.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const counts={catalog:0,presets:0,posts:0,upgrades:0};
const catalog={ships:[{code:'mcc_frg',name_en:'Fixture Shard',name_ko:'검수 샤드',size_class:'frigate',faction_code:'mcc',role:'dps',base_hp:100,base_atk:14,base_def:7,base_speed:1.8,fire_interval:130,fire_type:'bullet',shots:2,render_radius:2.5}],resources:[],factions:[]};
const fleet=(id,name)=>({id:name,dbFleetId:id,ownerWallet:'public...dummy',flagship:'mcc_frg',escort:{mcc_frg:1}});
const frames=Array.from({length:5},(_,i)=>({type:'frame',t:i*5,tick:i*5,tick_ms:200,realtime:false,
 fleets:[{id:'11',side:'atk',cx:200+i*20,cy:150,hp:200-i*5,maxHp:200,formation:'wedge',movement:'advance'},{id:'22',side:'def',cx:800-i*20,cy:290,hp:200-i*20,maxHp:200,formation:'screen',movement:'flank'}],
 ships:[{id:'111',fid:'11',code:'mcc_frg',ff:1,x:200+i*20,y:150,hp:100-i*5,maxHp:100,shield_hp:0,shield_max:0},{id:'112',fid:'11',code:'mcc_frg',x:180+i*20,y:170,hp:100,maxHp:100,shield_hp:0,shield_max:0},{id:'221',fid:'22',code:'mcc_frg',ff:1,x:800-i*20,y:290,hp:100-i*15,maxHp:100,shield_hp:Math.max(0,30-i*10),shield_max:30},{id:'222',fid:'22',code:'mcc_frg',x:820-i*20,y:270,hp:100-i*5,maxHp:100,shield_hp:0,shield_max:0}],
 combat_events:i?[{id:'71:combat:'+i,type:'shot_hit',seq:i,tick:i*5,source_ship_id:'111',source_side:'atk',target_ship_id:'221',fire_type:'bullet',from:{x:200+i*20,y:150},to:{x:800-i*20,y:290},damage:20}]:[]}));
const replayScript=`// Fixed fixture data only, supplied through the real parent replay bridge.
(function wait(){if(typeof _battleUiReady==='undefined'||!_battleUiReady){setTimeout(wait,50);return;}
 const frames=${JSON.stringify(frames)};let index=0;
 const send=(cmd,payload)=>window.postMessage({source:'occupy-battle-viewer',battleId:'71',cmd,payload},location.origin);
 setTimeout(function next(){send('replay_frame',frames[index++]);if(index<frames.length)setTimeout(next,800);else setTimeout(()=>send('replay_end',{type:'end',winner_side:'atk',duration_seconds:4}),1000);},2000);
})();`;
const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Mars-Fixture','public-fixed-battle-visuals-only');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'");
 if(req.method!=='GET'){counts.posts++;res.writeHead(405);res.end();return;}
 if(url.pathname==='/fixture-counts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(counts));return;}
 if(url.pathname==='/tactical.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'assets/tactical-lab-v11.html'),'utf8').replace('</body>','<script src="/fixture-replay.js"></script></body>'));return;}
 if(url.pathname==='/fixture-replay.js'){res.setHeader('Content-Type','text/javascript');res.end(replayScript);return;}
 if(url.pathname==='/api/tactical-lab/catalog'){counts.catalog++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(catalog));return;}
 if(url.pathname==='/api/tactical-lab/fleet-presets'){counts.presets++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({source:'battle:71',atk:[fleet('11','Public alpha')],def:[fleet('22','Public beta')]}));return;}
 const relative=url.pathname.startsWith('/assets/')?url.pathname.slice(1):['/battlefield-art.js','/fleet-field-guide.js','/fleet-field-guide.css'].includes(url.pathname)?'assets'+url.pathname:null;
 if(relative){const file=path.resolve(root,relative),ext=path.extname(file);if(file.startsWith(path.join(root,'assets')+path.sep)&&types[ext]&&fs.existsSync(file)){res.setHeader('Content-Type',types[ext]);res.end(fs.readFileSync(file));return;}}
 res.writeHead(404);res.end();
});
server.on('upgrade',(_,socket)=>{counts.upgrades++;socket.destroy();});
server.listen(Number(process.argv[2])||0,'127.0.0.1',()=>console.log('Battle visual fixture: http://127.0.0.1:'+server.address().port+'/tactical.html?mode=battle&bid=71&lang=ko'));

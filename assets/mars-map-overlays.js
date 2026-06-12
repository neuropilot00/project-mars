var _showSectorBounds=false;

function mapOverlayReadJson(key, url, minGap, auth) {
  var walletKey = (window.walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  var fetchOptions = auth === false ? {} : { headers: getAuthHeaders() };
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('map-overlay:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: fetchOptions
    });
  }
  return fetch(url, fetchOptions).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function drawSectorBoundaries(){
  if(!_sectorsData.length) return;
  compositeClaimsOnTexture();
}

function _drawSectorOverlay(ctx,w,h){
  if(!_showSectorBounds||!_sectorsData.length) return;
  ctx.save();

  function toXY(v){return[((v[0]+180)/360)*w,((90-v[1])/180)*h]}
  function centroid(pts){
    var cx=0,cy=0;
    for(var i=0;i<pts.length;i++){var p=toXY(pts[i]);cx+=p[0];cy+=p[1]}
    return[cx/pts.length,cy/pts.length];
  }
  function sectorStyle(tier){
    var c=tier==='frontier'?'#5EC8FF':(tier==='mid'?'#FFD166':'#FF8A30');
    return {
      color:c,
      fillAlpha:tier==='core'?0.095:tier==='mid'?0.072:0.058,
      edgeAlpha:tier==='core'?0.98:tier==='mid'?0.9:0.84,
      glow:tier==='core'?26:tier==='mid'?21:18
    };
  }
  function prand(seed){var x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
  function sectorIntel(s){
    var stats=s.stats||{};
    var occ=Math.max(0,Math.min(100,parseFloat(stats.occupancyRate)||0));
    var mining=parseFloat(s.miningBonus)||1;
    var price=parseFloat(s.currentPrice)||parseFloat(stats.avgPrice)||0;
    var priceWeight=price>0?Math.max(0.35,Math.min(1.6,0.04/price)):1;
    var scarcityWeight=1+Math.min(0.75,occ/140);
    var eco=Math.max(10,Math.round(mining*priceWeight*scarcityWeight*100));
    var pressure=occ>=75?'WAR':occ>=40?'CONTEST':'OPEN';
    return {occ:occ,mining:mining,price:price,eco:eco,pressure:pressure};
  }
  function polyMetrics(poly){
    var pts=poly.map(toXY);
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,cx=0,cy=0;
    pts.forEach(function(p){
      minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);
      minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);
      cx+=p[0];cy+=p[1];
    });
    return {pts:pts,minX:minX,minY:minY,maxX:maxX,maxY:maxY,cx:cx/pts.length,cy:cy/pts.length,w:maxX-minX,h:maxY-minY};
  }
  function tracePts(pts){
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
    ctx.closePath();
  }
  function roundRect(x,y,wid,hei,r){
    var rr=Math.min(r,wid/2,hei/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.lineTo(x+wid-rr,y);
    ctx.quadraticCurveTo(x+wid,y,x+wid,y+rr);
    ctx.lineTo(x+wid,y+hei-rr);
    ctx.quadraticCurveTo(x+wid,y+hei,x+wid-rr,y+hei);
    ctx.lineTo(x+rr,y+hei);
    ctx.quadraticCurveTo(x,y+hei,x,y+hei-rr);
    ctx.lineTo(x,y+rr);
    ctx.quadraticCurveTo(x,y,x+rr,y);
    ctx.closePath();
  }
  function drawHexCellPattern(m, color, alpha, seed){
    var radius=Math.max(22,Math.min(58,Math.min(m.w,m.h)/5.2));
    var dx=Math.sqrt(3)*radius;
    var dy=1.5*radius;
    var offsetX=(prand(seed||1)-0.5)*dx*0.45;
    var offsetY=(prand((seed||1)+11)-0.5)*dy*0.45;
    ctx.save();
    tracePts(m.pts);
    ctx.clip();
    ctx.globalAlpha=alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(0.8,Math.min(2.2,radius*0.045));
    ctx.shadowColor=color;
    ctx.shadowBlur=Math.max(3,radius*0.16);
    for(var row=-1,y=m.minY-radius+offsetY; y<m.maxY+radius; row++,y+=dy){
      var rowOffset=(row%2?dx/2:0)+offsetX;
      for(var x=m.minX-radius+rowOffset; x<m.maxX+radius; x+=dx){
        ctx.beginPath();
        for(var k=0;k<6;k++){
          var a=(Math.PI/180)*(60*k-30);
          var px=x+radius*Math.cos(a);
          var py=y+radius*Math.sin(a);
          if(k===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.shadowBlur=0;
    ctx.restore();
  }

  // 1) Fill polygons (차단된 섹터는 붉고 어둡게)
  var _myLvl=parseInt((document.getElementById('profileLevel')||{}).textContent||'1')||1;
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    var m=polyMetrics(poly);
    var _entryBlocked=(s.entryCheckActive!==false)&&(s.entryMinLevel||0)>0&&_myLvl<(s.entryMinLevel||0);
    tracePts(m.pts);
    if(_entryBlocked){
      ctx.globalAlpha=0.17;
      var blockGrad=ctx.createLinearGradient(m.minX,m.minY,m.maxX,m.maxY);
      blockGrad.addColorStop(0,'rgba(120,38,22,1)');
      blockGrad.addColorStop(0.55,'rgba(168,58,32,1)');
      blockGrad.addColorStop(1,'rgba(38,8,6,1)');
      ctx.fillStyle=blockGrad;
    }else{
      var st=sectorStyle(s.tier);
      var grad=ctx.createLinearGradient(m.minX,m.minY,m.maxX,m.maxY);
      grad.addColorStop(0,'rgba(255,255,255,.08)');
      grad.addColorStop(0.28,st.color);
      grad.addColorStop(1,'rgba(0,0,0,.12)');
      ctx.globalAlpha=st.fillAlpha;
      ctx.fillStyle=grad;
    }
    ctx.fill();
    if(!_entryBlocked){
      var st2=sectorStyle(s.tier);
      drawHexCellPattern(m, st2.color, 0.13, (s.id||0)*7+3);
      drawHexCellPattern(m, 'rgba(255,232,190,.82)', 0.045, (s.id||0)*11+17);
    }

    if(!_entryBlocked){
      var intel=sectorIntel(s);
      ctx.save();
      tracePts(m.pts);
      ctx.clip();
      var rim=sectorStyle(s.tier);
      var sweepY=m.minY+m.h*(1-Math.max(0.08,intel.occ/100));
      var occGrad=ctx.createLinearGradient(m.minX,sweepY,m.maxX,m.maxY);
      occGrad.addColorStop(0,'rgba(255,255,255,.02)');
      occGrad.addColorStop(0.45,rim.color);
      occGrad.addColorStop(1,'rgba(0,0,0,.05)');
      ctx.globalAlpha=Math.min(0.16,0.04+intel.occ/700);
      ctx.fillStyle=occGrad;
      ctx.fillRect(m.minX,sweepY,m.w,m.maxY-sweepY);

      var nodeCount=Math.max(3,Math.min(10,Math.round(intel.occ/12)+Math.round(intel.eco/120)));
      ctx.globalAlpha=0.48;
      ctx.strokeStyle=rim.color;
      ctx.fillStyle=rim.color;
      for(var ni=0;ni<nodeCount;ni++){
        var nx=m.minX+m.w*(0.14+prand((s.id||0)*19+ni*5)*0.72);
        var ny=m.minY+m.h*(0.18+prand((s.id||0)*31+ni*7)*0.62);
        var nr=Math.max(2,Math.min(5,m.w*0.011));
        var halo=ctx.createRadialGradient(nx,ny,0,nx,ny,nr*5.5);
        halo.addColorStop(0,rim.color+'cc');
        halo.addColorStop(0.38,rim.color+'44');
        halo.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalAlpha=0.5;
        ctx.fillStyle=halo;
        ctx.fillRect(nx-nr*5.5,ny-nr*5.5,nr*11, nr*11);
        ctx.globalAlpha=0.92;
        ctx.fillStyle=rim.color;
        ctx.beginPath();ctx.arc(nx,ny,nr,0,Math.PI*2);ctx.fill();
        if(ni>0){
          var px=m.minX+m.w*(0.14+prand((s.id||0)*19+(ni-1)*5)*0.72);
          var py=m.minY+m.h*(0.18+prand((s.id||0)*31+(ni-1)*7)*0.62);
          ctx.globalAlpha=0.22;
          ctx.strokeStyle=rim.color;
          ctx.lineWidth=Math.max(0.8,Math.min(2,m.w*0.004));
          ctx.shadowColor=rim.color;
          ctx.shadowBlur=8;
          ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(nx,ny);ctx.stroke();
          ctx.shadowBlur=0;
        }
      }
      ctx.restore();
    }

    // 차단된 섹터: 큰 X 대신 낮은 강도의 스캔 패턴과 작은 잠금 배지만 표시.
    if(_entryBlocked){
      var c=[m.cx,m.cy];
      var polyW2=m.w;
      var polyH2=m.h;
      drawHexCellPattern(m, 'rgba(255,158,76,.92)', 0.17, (s.id||0)*13+5);

      var lvFont=Math.max(9,Math.min(18,polyW2*0.04));
      ctx.font='bold '+lvFont+'px monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,0.85)';ctx.shadowBlur=5;
      ctx.fillStyle='rgba(255,198,120,.9)';
      ctx.globalAlpha=0.82;
      ctx.fillText('🔒 Lv '+s.entryMinLevel,c[0],c[1]+Math.min(polyH2,polyW2)*0.18);
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
  });

  // 2) Unique edges — no double-drawing
  var edgeSet={};
  var edges=[];
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    for(var i=0;i<poly.length;i++){
      var a=poly[i], b=poly[(i+1)%poly.length];
      var ka=a[0]+','+a[1], kb=b[0]+','+b[1];
      var key=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(!edgeSet[key]){
        edgeSet[key]=true;
        edges.push({a:a,b:b,tier:s.tier});
      }
    }
  });
  ctx.setLineDash([]);
  edges.forEach(function(e){
    var pa=toXY(e.a), pb=toXY(e.b);
    var st=sectorStyle(e.tier);
    ctx.globalAlpha=0.34;
    ctx.strokeStyle=st.color;
    ctx.lineWidth=11;
    ctx.shadowColor=st.color;
    ctx.shadowBlur=st.glow;
    ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
  });
  ctx.shadowBlur=0;
  edges.forEach(function(e){
    var pa=toXY(e.a), pb=toXY(e.b);
    var st=sectorStyle(e.tier);
    ctx.globalAlpha=0.5;
    ctx.strokeStyle=st.color;
    ctx.lineWidth=4.2;
    ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
    ctx.globalAlpha=st.edgeAlpha;
    ctx.strokeStyle=st.color;
    ctx.lineWidth=1.45;
    ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
    ctx.globalAlpha=0.74;
    ctx.strokeStyle='rgba(255,245,220,.82)';
    ctx.lineWidth=0.65;
    ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();
  });

  // 3) Labels — no bg box, text with shadow only
  _sectorsData.forEach(function(s){
    var poly=s.polygon;
    if(!poly||poly.length<3) return;
    var m=polyMetrics(poly);
    var cx=m.cx,cy=m.cy;
    var polyW=m.w;
    var st=sectorStyle(s.tier);

    // Responsive font size — smaller on mobile canvas to avoid overlap
    var _isMobTex=(w<=2560);
    var _maxF=_isMobTex?36:56;
    var _minF=_isMobTex?14:22;
    // Tighter multiplier so long names don't blow up + clamp to polyW (never wider than sector box)
    var fontSize=Math.max(_minF,Math.min(_maxF,polyW/s.name.length*1.6));
    // Also cap so single-line label fits within 80% of polyW
    if(s.name.length*fontSize*0.55>polyW*0.85) fontSize=Math.max(_minF,Math.floor(polyW*0.85/(s.name.length*0.55)));
    ctx.font='bold '+fontSize+'px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';

    // Truncate name if still too wide
    var nameText=s.name;
    while(ctx.measureText(nameText).width>polyW*0.9 && nameText.length>4){
      nameText=nameText.slice(0,-2);
    }
    if(nameText!==s.name) nameText=nameText+'…';

    var labelW=Math.min(polyW*0.82,Math.max(ctx.measureText(nameText).width+fontSize*1.25,fontSize*5.5));
    var labelH=fontSize*1.7;
    var intel2=sectorIntel(s);
    var extraH=fontSize*0.88;
    if(polyW>fontSize*7) labelH+=extraH;
    ctx.shadowColor='transparent';ctx.shadowBlur=0;
    ctx.globalAlpha=0.32;
    ctx.fillStyle='rgba(2,6,14,.86)';
    roundRect(cx-labelW/2,cy-labelH/2,labelW,labelH,Math.max(6,fontSize*0.22));
    ctx.fill();
    ctx.globalAlpha=0.52;
    ctx.strokeStyle=st.color;
    ctx.lineWidth=Math.max(1,fontSize*0.06);
    ctx.stroke();

    // Text shadow for readability
    ctx.globalAlpha=0.95;
    ctx.shadowColor='rgba(0,0,0,0.9)';
    ctx.shadowBlur=6;
    ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
    ctx.fillStyle=st.color;
    ctx.fillText(nameText,cx,cy-fontSize*0.13);

    // Tier label below (smaller)
    var tierSize=Math.max(_isMobTex?10:14,fontSize*0.38);
    ctx.font='bold '+tierSize+'px monospace';
    ctx.globalAlpha=0.75;
    ctx.fillText(s.tier.toUpperCase(),cx,cy+fontSize*0.48);

    if(polyW>fontSize*7){
      var badgeY=cy+fontSize*0.88;
      var badgeSize=Math.max(_isMobTex?8:11,tierSize*0.62);
      var badges=[
        {text:'ECO '+intel2.eco,color:intel2.eco>=180?'#FFD166':intel2.eco>=115?'#64D8FF':'#4CD89A'},
        {text:'OCC '+Math.round(intel2.occ)+'%',color:intel2.occ>=75?'#FF7043':intel2.occ>=40?'#FFD166':'#4CD89A'},
        {text:'x'+intel2.mining.toFixed(2),color:'#B888E0'}
      ];
      var totalW=0;
      ctx.font='bold '+badgeSize+'px monospace';
      badges.forEach(function(b){ b.w=ctx.measureText(b.text).width+badgeSize*1.2; totalW+=b.w+badgeSize*0.32; });
      totalW-=badgeSize*0.32;
      var bx=cx-totalW/2;
      badges.forEach(function(b){
        ctx.globalAlpha=0.58;
        ctx.fillStyle='rgba(0,0,0,.62)';
        roundRect(bx,badgeY-badgeSize*0.82,b.w,badgeSize*1.35,Math.max(4,badgeSize*0.28));
        ctx.fill();
        ctx.globalAlpha=0.38;
        ctx.strokeStyle=b.color;
        ctx.lineWidth=1;
        ctx.stroke();
        ctx.globalAlpha=0.92;
        ctx.fillStyle=b.color;
        ctx.shadowColor='rgba(0,0,0,.9)';
        ctx.shadowBlur=3;
        ctx.fillText(b.text,bx+b.w/2,badgeY-badgeSize*0.13);
        bx+=b.w+badgeSize*0.32;
      });
      if(intel2.pressure!=='OPEN'){
        ctx.font='bold '+Math.max(8,badgeSize*0.86)+'px monospace';
        ctx.globalAlpha=0.82;
        ctx.fillStyle=intel2.pressure==='WAR'?'#FF7043':'#FFD166';
        ctx.fillText(intel2.pressure,cx,cy+fontSize*1.32);
      }
    }

    // Governor name below tier
    var govName=s.governor?s.governor.nickname:null;
    if(govName){
      var govSize=Math.max(_isMobTex?9:12,tierSize*0.8);
      var govY=cy+fontSize*0.55+tierSize*0.2+tierSize*0.8+4;
      ctx.font='bold '+govSize+'px monospace';
      ctx.globalAlpha=0.9;
      var isCommander=_cmdInfo&&_cmdInfo.commander&&s.governor&&s.governor.fullWallet&&_cmdInfo.commander.toLowerCase()===s.governor.fullWallet.toLowerCase();
      ctx.fillStyle=isCommander?'#FFD166':'#FFD166';
      var govText=(isCommander?'⭐ ':'👑 ')+govName;
      while(ctx.measureText(govText).width>polyW*0.9 && govText.length>6){ govText=govText.slice(0,-2); }
      ctx.fillText(govText,cx,govY);
    }

    // Sector announcement below governor name (only for sector members) — governor 없으면 잔존 공지 무시
    if(s.announcement && s.governor && s.myPixels > 0){
      var annSize=Math.max(_isMobTex?8:11,tierSize*0.55);
      var annY=govName?(govY+annSize+4):(cy+fontSize*0.55+tierSize*0.2+tierSize*0.8+4);
      ctx.font='italic '+annSize+'px monospace';
      ctx.globalAlpha=0.6;
      ctx.fillStyle='#FFD166';
      var annText=s.announcement.length>24?s.announcement.slice(0,24)+'…':s.announcement;
      ctx.fillText('📢 '+annText,cx,annY);
    }

    ctx.shadowColor='transparent';ctx.shadowBlur=0;
    ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  });

  ctx.restore();
}

// ═══════ WEATHER OVERLAY ═══════
var _weatherData = [];
var _weatherT = 0;

function _drawWeatherOverlay(ctx, w, h) {
  if (!_weatherData.length || !_sectorsData.length) return;
  ctx.save();
  _weatherT = Date.now();

  function toXY(v) { return [((v[0] + 180) / 360) * w, ((90 - v[1]) / 180) * h]; }
  // Pseudo-random from seed (deterministic per particle index)
  function prand(seed) { var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  // Build sector lookup
  var sectorMap = {};
  _sectorsData.forEach(function(s) { sectorMap[s.id] = s; });

  _weatherData.forEach(function(wx) {
    var sector = sectorMap[wx.sectorId];
    if (!sector || !sector.polygon || sector.polygon.length < 3) return;
    var poly = sector.polygon;

    // Compute bounding box + center
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var cx0 = 0, cy0 = 0;
    var pts = [];
    for (var i = 0; i < poly.length; i++) {
      var p = toXY(poly[i]);
      pts.push(p);
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
      cx0 += p[0]; cy0 += p[1];
    }
    cx0 /= poly.length; cy0 /= poly.length;
    var bw = maxX - minX, bh = maxY - minY;

    // Draw polygon path helper
    function drawPoly() {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
    }

    var t = _weatherT;

    if (wx.weatherType === 'sandstorm') {
      // Base tint
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 1000) * 0.02;
      ctx.fillStyle = 'rgba(200,120,40,1)';
      ctx.fill();
      // Blowing sand particles
      ctx.save();
      drawPoly(); ctx.clip();
      var windAngle = t / 3000; // slow wind direction shift
      for (var d = 0; d < 80; d++) {
        var px = prand(d * 3.1) * bw + minX;
        var py = prand(d * 7.7) * bh + minY;
        // Wind drift: particles move right and slightly down
        var drift = ((t / 8 + d * 137) % (bw + 40)) - 20;
        var driftY = Math.sin(d * 2.3 + t / 600) * 8;
        px = minX + ((px - minX + drift) % bw);
        py = py + driftY;
        var size = 1 + prand(d * 1.3) * 2.5;
        var alpha = 0.3 + prand(d * 5.1) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = prand(d) > 0.5 ? '#D49030' : '#C87828';
        // Elongated horizontal streaks for wind effect
        ctx.fillRect(px, py, size * 3, size * 0.6);
      }
      // Larger dust clouds (semi-transparent blobs)
      for (var c = 0; c < 6; c++) {
        var cloudX = minX + ((prand(c * 11) * bw + t / 15 + c * 200) % bw);
        var cloudY = minY + prand(c * 17) * bh;
        var cloudR = 12 + prand(c * 23) * 20;
        var cg = ctx.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudR);
        cg.addColorStop(0, 'rgba(200,130,60,0.25)');
        cg.addColorStop(1, 'rgba(200,130,60,0)');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = cg;
        ctx.fillRect(cloudX - cloudR, cloudY - cloudR, cloudR * 2, cloudR * 2);
      }
      ctx.restore();

    } else if (wx.weatherType === 'solar_flare') {
      // Warm glow base
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 500) * 0.02;
      ctx.fillStyle = 'rgba(255,220,60,1)';
      ctx.fill();
      // Sparkle particles rising upward
      ctx.save();
      drawPoly(); ctx.clip();
      for (var s = 0; s < 50; s++) {
        var spx = prand(s * 4.1) * bw + minX;
        var spy = minY + bh - ((t / 12 + s * 97) % (bh + 20));
        var spSize = 1 + prand(s * 2.7) * 2;
        var spAlpha = 0.4 + Math.sin(t / 200 + s * 1.7) * 0.4;
        ctx.globalAlpha = Math.max(0, spAlpha);
        // Golden-white sparkle
        var spGrad = ctx.createRadialGradient(spx, spy, 0, spx, spy, spSize * 2);
        spGrad.addColorStop(0, 'rgba(255,255,200,0.9)');
        spGrad.addColorStop(0.5, 'rgba(255,200,50,0.4)');
        spGrad.addColorStop(1, 'rgba(255,180,30,0)');
        ctx.fillStyle = spGrad;
        ctx.fillRect(spx - spSize * 2, spy - spSize * 2, spSize * 4, spSize * 4);
      }
      // Central flare pulse
      var frad = 60 + Math.sin(t / 400) * 30;
      var fGrad = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, frad);
      fGrad.addColorStop(0, 'rgba(255,240,100,0.35)');
      fGrad.addColorStop(0.6, 'rgba(255,200,50,0.12)');
      fGrad.addColorStop(1, 'rgba(255,180,30,0)');
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = fGrad;
      ctx.fillRect(cx0 - frad, cy0 - frad, frad * 2, frad * 2);
      // Light rays
      ctx.globalAlpha = 0.15 + Math.sin(t / 300) * 0.08;
      ctx.strokeStyle = 'rgba(255,240,150,0.6)';
      ctx.lineWidth = 1;
      for (var r = 0; r < 8; r++) {
        var rayAng = (r * 45 + t / 80) * Math.PI / 180;
        var rayLen = 40 + Math.sin(t / 250 + r) * 20;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx0 + Math.cos(rayAng) * rayLen, cy0 + Math.sin(rayAng) * rayLen);
        ctx.stroke();
      }
      ctx.restore();

    } else if (wx.weatherType === 'meteor_shower') {
      // Faint blue tint
      drawPoly();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = 'rgba(80,150,255,1)';
      ctx.fill();
      // Falling meteor streaks
      ctx.save();
      drawPoly(); ctx.clip();
      for (var m = 0; m < 25; m++) {
        var mx = prand(m * 5.3) * bw + minX;
        var mPhase = ((t / 6 + m * 311) % (bh + 60)) - 30;
        var my = minY + mPhase;
        var mLen = 8 + prand(m * 3.1) * 18;
        var mAlpha = 0.5 + prand(m * 9.1) * 0.4;
        // Fade in/out based on position
        if (mPhase < 20) mAlpha *= mPhase / 20;
        if (mPhase > bh - 20) mAlpha *= (bh - mPhase + 30) / 50;
        ctx.globalAlpha = Math.max(0, mAlpha);
        // Diagonal streak (top-right to bottom-left)
        var mGrad = ctx.createLinearGradient(mx, my, mx - mLen * 0.4, my + mLen);
        mGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        mGrad.addColorStop(0.3, 'rgba(150,200,255,0.6)');
        mGrad.addColorStop(1, 'rgba(100,150,255,0)');
        ctx.strokeStyle = mGrad;
        ctx.lineWidth = 1 + prand(m * 2.1) * 1.5;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx - mLen * 0.4, my + mLen);
        ctx.stroke();
        // Bright head
        ctx.globalAlpha = Math.max(0, mAlpha) * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Scattered twinkling stars
      for (var st = 0; st < 12; st++) {
        var stx = prand(st * 13.7) * bw + minX;
        var sty = prand(st * 19.3) * bh + minY;
        var stAlpha = 0.3 + Math.sin(t / 150 + st * 2.9) * 0.4;
        ctx.globalAlpha = Math.max(0, stAlpha);
        ctx.fillStyle = '#B0D4FF';
        ctx.beginPath();
        ctx.arc(stx, sty, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (wx.weatherType === 'dust_devil') {
      // Brown tint
      drawPoly();
      ctx.globalAlpha = 0.06 + Math.sin(t / 800) * 0.02;
      ctx.fillStyle = 'rgba(160,100,50,1)';
      ctx.fill();
      // Swirling dust particles around center
      ctx.save();
      drawPoly(); ctx.clip();
      // Multiple vortex points
      var vortexCount = 2;
      for (var v = 0; v < vortexCount; v++) {
        var vx = cx0 + Math.cos(t / 2000 + v * 3.14) * bw * 0.2;
        var vy = cy0 + Math.sin(t / 2500 + v * 3.14) * bh * 0.2;
        // Spiral particles
        for (var sp = 0; sp < 35; sp++) {
          var spiralAng = (sp * 25 + t / (60 + v * 20)) * Math.PI / 180;
          var spiralR = 5 + sp * 2.5 + Math.sin(t / 400 + sp) * 3;
          var spx2 = vx + Math.cos(spiralAng) * spiralR;
          var spy2 = vy + Math.sin(spiralAng) * spiralR;
          var spAlpha2 = 0.5 - sp / 70;
          ctx.globalAlpha = Math.max(0.05, spAlpha2);
          ctx.fillStyle = sp % 3 === 0 ? '#B87840' : '#A06432';
          var psize = 1 + prand(sp + v * 100) * 1.8;
          ctx.beginPath();
          ctx.arc(spx2, spy2, psize, 0, Math.PI * 2);
          ctx.fill();
        }
        // Central vortex glow
        var vGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, 25);
        vGrad.addColorStop(0, 'rgba(180,120,60,0.3)');
        vGrad.addColorStop(1, 'rgba(160,100,50,0)');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = vGrad;
        ctx.fillRect(vx - 25, vy - 25, 50, 50);
      }
      // Loose flying debris
      for (var db = 0; db < 15; db++) {
        var dbx = minX + ((prand(db * 7.7) * bw + t / 20 + db * 80) % bw);
        var dby = minY + prand(db * 11.3) * bh + Math.sin(t / 300 + db * 2) * 10;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#C89060';
        ctx.fillRect(dbx, dby, 2 + prand(db) * 2, 1);
      }
      ctx.restore();
    }
  });

  ctx.restore();
}

// ═══════ EXPLORATION POI MARKERS ═══════
var _poiData = [];
// Mars-theme harmonized palette (aligned to --gold/--mars/--gn/--cyan/--pp)
var _poiDefs = {
  ancient_ruins:  { icon: '⚜', color: '#FFD166', glow: '#FFE4A3', label: 'ANCIENT RUINS',  illust: '🏛️' },
  ore_deposit:    { icon: '◆', color: '#FF7840', glow: '#FFB085', label: 'ORE DEPOSIT',    illust: '⛏️' },
  crashed_probe:  { icon: '▼', color: '#4CD89A', glow: '#9CF0C8', label: 'CRASHED PROBE',  illust: '🛸' },
  water_ice:      { icon: '◇', color: '#5BB8E8', glow: '#A8DCF5', label: 'WATER ICE',      illust: '🧊' },
  alien_artifact: { icon: '✦', color: '#B888E0', glow: '#DCBCF0', label: 'ALIEN ARTIFACT', illust: '🔮' }
};

// ══════════════════════════════════════
// FOR SALE / AUCTION MAP OVERLAY (Migration 091)
// ══════════════════════════════════════
var _forSaleMap={}; // {claimId: {price, currency, saleType, endsAt, sellerNick}}

function loadForSaleTerritories(){
  if (!_pageIsActive()) return;
  _guardedJsonFetch('for-sale-territories', '/api/for-sale-territories', {minGap:30000, backoffMs:120000}).then(function(rows){
    if (!rows) return;
    var map={};
    if(Array.isArray(rows)) rows.forEach(function(r){
      map[r.claim_id]={price:r.price,currency:r.currency,saleType:r.sale_type,endsAt:r.ends_at,sellerNick:r.seller_nick};
    });
    _forSaleMap=map;
    claimsSnapshot=null; compositeClaimsOnTexture();
  }).catch(function(){});
}

// Poll every 60s
_setActiveInterval(loadForSaleTerritories, 60000);
// Initial load after claims are ready
_setActiveTimeout(loadForSaleTerritories, 3000);

function _drawForSaleOverlay(ctx,w,h){
  if(!Object.keys(_forSaleMap).length) return;
  ctx.save();
  var _pxDeg=w/360;
  function _claimCx(c){return ((c.lng||c.center_lng||0)+180)/360*w;}
  function _claimCy(c){return (90-(c.lat||c.center_lat||0))/180*h;}
  claims.forEach(function(c){
    var info=_forSaleMap[c.id];
    if(!info) return;
    var cx=_claimCx(c), cy=_claimCy(c);
    var claimW=(c.w||c.width||20)*_pxDeg*0.5;
    var claimH=(c.h||c.height||20)*(_pxDeg)*0.5;
    var bx=cx-claimW/2, by=cy-claimH/2;
    var bw=claimW, bh=claimH;
    // Badge background
    var isAuction=info.saleType==='auction';
    var badgeColor=isAuction?'rgba(255,165,0,0.88)':'rgba(76,216,154,0.88)';
    var icon=isAuction?'🔨':'💰';
    var priceStr=Math.round(info.price||0)+' '+(info.currency||'GP');
    var lbl=icon+' '+priceStr;
    var fz=Math.max(6,Math.min(bw*0.22,bh*0.28,11));
    ctx.font='bold '+fz+'px sans-serif';
    var tw=ctx.measureText(lbl).width;
    var padX=4, padY=3;
    var rx=bx+bw/2-tw/2-padX, ry=by+2;
    var rw=tw+padX*2, rh=fz+padY*2;
    // Only draw if territory is big enough
    if(bw<10||bh<8) return;
    // Pill background
    ctx.globalAlpha=0.92;
    ctx.fillStyle=badgeColor;
    ctx.beginPath();
    var rad=rh/2;
    ctx.moveTo(rx+rad,ry);ctx.lineTo(rx+rw-rad,ry);
    ctx.arc(rx+rw-rad,ry+rad,rad,-Math.PI/2,Math.PI/2);
    ctx.lineTo(rx+rad,ry+rh);
    ctx.arc(rx+rad,ry+rad,rad,Math.PI/2,3*Math.PI/2);
    ctx.closePath();
    ctx.fill();
    // Text
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(0,0,0,0.85)';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(lbl,rx+rw/2,ry+rh/2);
  });
  ctx.restore();
}

function _drawPOIMarkers(ctx, w, h) {
  if (!_poiData.length) return;
  ctx.save();
  var t = Date.now();

  // Draw a single POI marker at the given x (allows wrap-around copies)
  // Style: tactical hex scanner — rotating dashed ring, hex diamond, crosshairs
  function _drawOnePOI(poi, x, y, def){
    var pulse = (Math.sin(t / 500 + poi.id) + 1) / 2; // 0..1

    ctx.save();
    ctx.translate(x, y);

    // ── Outer soft glow halo ──
    var haloR = 20 + pulse * 4;
    var haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    haloGrad.addColorStop(0, def.color + '55');
    haloGrad.addColorStop(0.55, def.color + '18');
    haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();

    // ── Rotating dashed scan ring ──
    var ringR = 14 + pulse * 1.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -(t / 70) % 8;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Inner hex diamond ──
    var hexR = 7.5;
    ctx.beginPath();
    for (var hi = 0; hi < 6; hi++) {
      var ha = hi * Math.PI / 3 - Math.PI / 2;
      var hx = Math.cos(ha) * hexR;
      var hy = Math.sin(ha) * hexR;
      if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    // Dark backdrop
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#0A0604';
    ctx.fill();
    // Glowing rim
    ctx.globalAlpha = 1;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6 + pulse * 4;
    ctx.strokeStyle = def.glow || def.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Crosshair tick marks (N/S/E/W outside the hex) ──
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hexR - 5, 0); ctx.lineTo(-hexR - 1, 0);
    ctx.moveTo( hexR + 1, 0); ctx.lineTo( hexR + 5, 0);
    ctx.moveTo(0, -hexR - 5); ctx.lineTo(0, -hexR - 1);
    ctx.moveTo(0,  hexR + 1); ctx.lineTo(0,  hexR + 5);
    ctx.stroke();

    // ── Center icon (white on dark) ──
    ctx.globalAlpha = 1;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = def.glow || def.color;
    ctx.fillText(def.icon, 0, 0.5);

    ctx.restore();

    // ── Tactical label with brackets (dark outline for readability) ──
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var labelText = '\u2039 ' + (def.label || 'SIGNAL') + ' \u203A';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,2,1,0.85)';
    ctx.strokeText(labelText, x, y + 24);
    ctx.fillStyle = def.color;
    ctx.fillText(labelText, x, y + 24);
  }

  // Approximate extent the marker extends from its center (pin + beam + label)
  var MARKER_MARGIN = 80;

  _poiData.forEach(function(poi) {
    if (poi.discovered) return;
    var x = ((poi.lng + 180) / 360) * w;
    var y = ((90 - poi.lat) / 180) * h;
    var def = _poiDefs[poi.poiType] || { icon: '✦', color: '#FFFFFF', glow: '#FFFFFF' };
    // Primary draw
    _drawOnePOI(poi, x, y, def);
    // Longitude wrap-around: if the marker crosses the antimeridian, draw a
    // second copy on the opposite edge so half the pin isn't chopped off.
    if (x < MARKER_MARGIN)       _drawOnePOI(poi, x + w, y, def);
    else if (x > w - MARKER_MARGIN) _drawOnePOI(poi, x - w, y, def);
  });

  ctx.restore();
}

// ═══════ MISSION ROUTES (private — only my missions visible) ═══════
// Drawn into the 4096×2048 equirectangular Mars texture, which is then wrapped
// onto the 3D globe — straight lineTo's become great-circle curves on the sphere
// for free. Lines are deliberately thick (8–22 px) so they survive the
// texture→sphere downsampling and remain visible at any zoom.
// ── Great-circle path between two lat/lng points, sampled into N+1 points.
//    Returns an array of [lat,lng]. Used so mission lines follow the actual
//    shortest path on the sphere (more natural arc than a straight equirectangular
//    line, which would just be linear in lat/lng space). ──
function _greatCirclePath(lat1, lng1, lat2, lng2, segments){
  var d = Math.PI/180;
  var f1 = lat1*d, l1 = lng1*d, f2 = lat2*d, l2 = lng2*d;
  var x1 = Math.cos(f1)*Math.cos(l1), y1 = Math.cos(f1)*Math.sin(l1), z1 = Math.sin(f1);
  var x2 = Math.cos(f2)*Math.cos(l2), y2 = Math.cos(f2)*Math.sin(l2), z2 = Math.sin(f2);
  var dot = Math.max(-1, Math.min(1, x1*x2 + y1*y2 + z1*z2));
  var omega = Math.acos(dot);
  var sinO = Math.sin(omega);
  var pts = [];
  if(sinO < 1e-9){ pts.push([lat1,lng1]); pts.push([lat2,lng2]); return pts; }
  for(var i=0;i<=segments;i++){
    var t = i/segments;
    var a = Math.sin((1-t)*omega)/sinO;
    var b = Math.sin(t*omega)/sinO;
    var px = a*x1 + b*x2, py = a*y1 + b*y2, pz = a*z1 + b*z2;
    var lat = Math.atan2(pz, Math.sqrt(px*px + py*py))/d;
    var lng = Math.atan2(py, px)/d;
    pts.push([lat,lng]);
  }
  return pts;
}

// Convert a great-circle [lat,lng] list to canvas (x,y) points, keeping each
// successive x within ±w/2 of the previous so the polyline doesn't jump across
// the antimeridian (±180° longitude wrap).
function _projectGreatCirclePts(pts, w, h){
  var out = [];
  var lastX = null;
  for(var i=0;i<pts.length;i++){
    var x = ((pts[i][1] + 180) / 360) * w;
    var y = ((90 - pts[i][0]) / 180) * h;
    if(lastX !== null){
      while(x - lastX >  w/2) x -= w;
      while(lastX - x >  w/2) x += w;
    }
    out.push([x,y]);
    lastX = x;
  }
  return out;
}

function _drawMissionRoutes(ctx, w, h){
  var missions = window._opsMissions || [];
  if(!missions.length) return;
  var myW = (walletState && walletState.address) || null;
  if(!myW) return;
  var t = Date.now();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  missions.forEach(function(m){
    if(m.status === 'claimed' || m.status === 'cancelled') return;
    // Sample the great-circle path between origin and target so the line
    // follows the actual shortest path on the sphere. Then project each
    // sample to canvas (x,y) with antimeridian-safe continuity.
    var gcPts = _greatCirclePath(m.originLat, m.originLng, m.targetLat, m.targetLng, 32);
    var screen = _projectGreatCirclePts(gcPts, w, h);
    var ox = screen[0][0], oy = screen[0][1];
    var tx = screen[screen.length-1][0], ty = screen[screen.length-1][1];
    // Lines are yellow regardless of type — much more visible against
    // the textured globe than the previous orange/green which blended
    // into mars/foliage colors and got lost when overlapping.
    var col = '255,210,40';
    var ready = m.readyToClaim;
    var isInvade = m.type === 'invasion';

    // Width scales with the texture so the line stays visible on the globe.
    // Invasion tapers thin (origin) → thick (target). Exploration is uniform.
    var baseW = Math.max(2, w/1400);    // ~3 px on a 4096-wide canvas
    var thickW = Math.max(4, w/650);    // ~6 px

    // Compute screen-x range so we know whether to draw a wrapped copy
    var minX = screen[0][0], maxX = screen[0][0];
    for(var k=1;k<screen.length;k++){
      if(screen[k][0] < minX) minX = screen[k][0];
      if(screen[k][0] > maxX) maxX = screen[k][0];
    }

    for(var pass = 0; pass < 2; pass++){
      var off = 0;
      if(pass === 1){
        if(maxX > w) off = -w;
        else if(minX < 0) off = w;
        else break;
      }
      var ox2 = ox + off, tx2 = tx + off;

      // ── Uniform thin dashed great-circle polyline ──
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba('+col+',1)';
      ctx.lineWidth = baseW;
      ctx.setLineDash([16, 10]);
      ctx.lineDashOffset = -(t / 25) % 26;
      ctx.shadowColor = 'rgba('+col+',0.6)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for(var k2=0;k2<screen.length;k2++){
        var sx = screen[k2][0] + off;
        var sy = screen[k2][1];
        if(k2===0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // ── Origin marker ──
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba('+col+',1)';
      ctx.beginPath();
      ctx.arc(ox2, oy, baseW * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // ── Target pulse ring ──
      var pulseR = (ready ? thickW * 1.6 : thickW * 1.1) + Math.sin(t/220) * (thickW*0.15);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba('+col+',1)';
      ctx.lineWidth = Math.max(3, w/700);
      ctx.beginPath();
      ctx.arc(tx2, ty, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      if(ready){
        var r2 = thickW * 1.3 + ((t / 20) % (thickW*2));
        ctx.globalAlpha = Math.max(0, 0.6 - r2 / (thickW*4));
        ctx.beginPath();
        ctx.arc(tx2, ty, r2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Type label at target ──
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba('+col+',1)';
      ctx.font = 'bold ' + Math.max(12, Math.floor(w/280)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var lbl = isInvade ? '⚔ INVADE' : '🛰 SCAN';
      ctx.fillText(lbl, tx2, ty + thickW);
    }
  });
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ═══════ MISSION PREVIEW (route shown WHILE picking target, before launch) ═══════
function _drawMissionPreview(ctx, w, h){
  var pad = window._opsSelectedPad;
  var tgt = window._opsPreviewTarget;
  if(!pad || !tgt) return;
  if(!isFinite(pad.lat) || !isFinite(pad.lng)) return;
  if(!isFinite(tgt.lat) || !isFinite(tgt.lng)) return;
  var type = window._opsType || 'invasion';
  // Great-circle polyline so the preview matches the in-flight render.
  var gcPts = _greatCirclePath(pad.lat, pad.lng, tgt.lat, tgt.lng, 32);
  var screen = _projectGreatCirclePts(gcPts, w, h);
  var ox = screen[0][0], oy = screen[0][1];
  var tx = screen[screen.length-1][0], ty = screen[screen.length-1][1];
  var minX = ox, maxX = ox;
  for(var k=1;k<screen.length;k++){
    if(screen[k][0] < minX) minX = screen[k][0];
    if(screen[k][0] > maxX) maxX = screen[k][0];
  }
  // Yellow preview line — stays visible against any terrain
  var col = '255,210,40';
  var isInvade = type === 'invasion';
  var t = Date.now();
  var baseW = Math.max(2, w/1400);
  var thickW = Math.max(4, w/650);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for(var pass = 0; pass < 2; pass++){
    var off = 0;
    if(pass === 1){
      if(maxX > w) off = -w;
      else if(minX < 0) off = w;
      else break;
    }
    var ox2 = ox + off, tx2 = tx + off;

    // ── Uniform thin dashed great-circle polyline ──
    var pulse = 0.7 + 0.25 * Math.sin(t / 250);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = 'rgba('+col+',1)';
    ctx.lineWidth = baseW;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -(t / 22) % 30;
    ctx.shadowColor = 'rgba('+col+',0.6)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for(var k2=0;k2<screen.length;k2++){
      var sx = screen[k2][0] + off;
      var sy = screen[k2][1];
      if(k2===0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // ── Origin pad marker ──
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba('+col+',1)';
    var padR = baseW * 0.6;
    ctx.fillRect(ox2 - padR, oy - padR, padR*2, padR*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(2, w/900);
    ctx.strokeRect(ox2 - padR, oy - padR, padR*2, padR*2);

    // ── Target reticle ──
    var rR = thickW * 1.2 + Math.sin(t / 200) * (thickW*0.18);
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = 'rgba('+col+',1)';
    ctx.lineWidth = Math.max(3, w/650);
    ctx.beginPath();
    ctx.arc(tx2, ty, rR, 0, Math.PI * 2);
    ctx.stroke();
    // crosshair ticks
    ctx.beginPath();
    ctx.moveTo(tx2 - rR - 6, ty); ctx.lineTo(tx2 - rR + 4, ty);
    ctx.moveTo(tx2 + rR - 4, ty); ctx.lineTo(tx2 + rR + 6, ty);
    ctx.moveTo(tx2, ty - rR - 6); ctx.lineTo(tx2, ty - rR + 4);
    ctx.moveTo(tx2, ty + rR - 4); ctx.lineTo(tx2, ty + rR + 6);
    ctx.stroke();

    // ── PREVIEW tag ──
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba('+col+',1)';
    ctx.font = 'bold ' + Math.max(20, Math.floor(w/180)) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('▸ PREVIEW', tx2, ty + thickW);
  }

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ═══════ STARLINK SATELLITES (3D orbit via screen coords) ═══════
var _starlinkMeshes = [];
var _starlinkData = { satellites: [], passes: [] };

// 6 orbits at evenly distributed inclinations — electron shell around atom
var _satOrbits = [
  { id: 1, speed: 0.00025, phase: 0,    inclination: 25,  tiltAxis: 0 },
  { id: 2, speed: 0.00028, phase: 1.05, inclination: 50,  tiltAxis: 60 },
  { id: 3, speed: 0.00030, phase: 2.09, inclination: 75,  tiltAxis: 120 },
  { id: 4, speed: 0.00027, phase: 3.14, inclination: 40,  tiltAxis: 180 },
  { id: 5, speed: 0.00032, phase: 4.19, inclination: 65,  tiltAxis: 240 },
  { id: 6, speed: 0.00026, phase: 5.24, inclination: 85,  tiltAxis: 300 }
];
var _slDots = []; // DOM elements
var _slAlt = 0.35; // orbit altitude above globe surface
var _slRafId = null;

function _initStarlinkOrbit() {
  if (_slDots.length || !globe) return;
  var container;
  try { container = globe.renderer().domElement.parentElement; } catch(_e) { return; }
  if (!container) return;
  _satOrbits.forEach(function(orb) {
    var dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;z-index:50;pointer-events:none;transition:opacity 0.15s;';
    dot.innerHTML = '<div style="width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fff 25%,rgba(0,255,136,0.8) 60%,transparent 100%);box-shadow:0 0 8px rgba(0,255,136,0.6),0 0 16px rgba(0,255,136,0.2)"></div>' +
      '<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font:bold 7px monospace;color:#00FF88;white-space:nowrap;text-shadow:0 0 4px rgba(0,0,0,0.9)">SL-' + orb.id + '</div>';
    container.appendChild(dot);
    _slDots.push({ el: dot, orb: orb });
  });
  if (!_slRafId) _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
}

var _slLastFrame=0;
var _slFrameInterval=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?100:33;
function _animateStarlinkOrbit() {
  if (!_pageIsActive()) {
    _slRafId = null;
    return;
  }
  if (!globe || !_slDots.length) { _slRafId = requestAnimationFrame(_animateStarlinkOrbit); return; }
  var t = Date.now();
  if(t-_slLastFrame<_slFrameInterval){_slRafId = requestAnimationFrame(_animateStarlinkOrbit);return;}
  _slLastFrame=t;
  _slDots.forEach(function(sd) {
    var orb = sd.orb;
    var angle = t * orb.speed + orb.phase; // orbital angle
    // Compute lat/lng on a tilted great circle
    var incRad = orb.inclination * Math.PI / 180;
    var tiltRad = orb.tiltAxis * Math.PI / 180;
    // Position on unit circle in orbital plane, then rotate by inclination and tilt
    var x0 = Math.cos(angle);
    var y0 = Math.sin(angle);
    // Rotate around Y-axis by tiltAxis, then around X-axis by inclination
    var x1 = x0 * Math.cos(tiltRad) - y0 * Math.sin(tiltRad) * Math.cos(incRad);
    var y1 = x0 * Math.sin(tiltRad) + y0 * Math.cos(tiltRad) * Math.cos(incRad);
    var z1 = y0 * Math.sin(incRad);
    // Convert to lat/lng
    var lat = Math.asin(Math.max(-1, Math.min(1, z1))) * 180 / Math.PI;
    var lng = Math.atan2(y1, x1) * 180 / Math.PI;
    // Get screen position
    var sc = globe.getScreenCoords(lat, lng, _slAlt);
    if (sc && sc.x > -50 && sc.y > -50) {
      sd.el.style.left = (sc.x - 4) + 'px';
      sd.el.style.top = (sc.y - 4) + 'px';
      // Occlusion: dot product of surface normal with camera direction
      var cam = globe.camera().position;
      var latR = lat * Math.PI / 180, lngR = lng * Math.PI / 180;
      var px = Math.cos(latR) * Math.cos(lngR);
      var py = Math.sin(latR);
      var pz = Math.cos(latR) * Math.sin(lngR);
      var dot = px * cam.x + py * cam.y + pz * cam.z;
      // dot>0 = facing camera (visible), dot<=0 = behind globe
      // Smooth fade near the edge (dot 0~0.15)
      if (dot < 0) {
        sd.el.style.opacity = '0';
      } else if (dot < 0.15 * Math.sqrt(cam.x*cam.x+cam.y*cam.y+cam.z*cam.z)) {
        sd.el.style.opacity = '0.3';
      } else {
        sd.el.style.opacity = '1';
      }
    } else {
      sd.el.style.opacity = '0';
    }
  });
  _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
}

_onPageVisible(function(){
  if (_slDots.length && !_slRafId) _slRafId = requestAnimationFrame(_animateStarlinkOrbit);
});
_onPageHidden(function(){
  if (_slRafId) {
    cancelAnimationFrame(_slRafId);
    _slRafId = null;
  }
});

// Texture trail stub (no longer used)
function _drawStarlinkTrails() {}
function _updateStarlinkPositions() {}
function _initStarlinkSatellites() {}

// ═══════ ROCKET EVENTS ═══════
var _rocketData = { events: [] };
var _rocketMesh = null;
var _rocketParticles = [];
// Preload starship pixel art
var _starshipImg = new Image();
_starshipImg.src = '/assets/textures/rocket_drop.svg';
_starshipImg.onerror = function(){ _starshipImg.src = '/assets/textures/starship.png'; };

function _drawRocketOverlay(ctx, w, h) {
  // [v7.265 fix] API 502/미로드 시 _rocketData.events 가 undefined 일 수 있음 → undefined.length 크래시 방어.
  //   이 함수는 compositeClaimsOnTexture(globe 텍스처 합성) 중 호출되므로, 여기서 throw 하면 globe 초기화가
  //   깨져 로딩/렌더가 꼬인다(서버 다운 시 화면 전체 영향). 안전 가드로 조용히 skip.
  if (!_rocketData || !_rocketData.events || !_rocketData.events.length) return;
  ctx.save();
  var t = Date.now();

  _rocketData.events.forEach(function(ev) {
    var x = ((ev.lng + 180) / 360) * w;
    var y = ((90 - ev.lat) / 180) * h;

    if (ev.status === 'incoming') {
      // Target reticle (red horizontal ellipse)
      var pulse = 0.5 + Math.sin(t / 300) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      // Horizontal ellipse
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 22, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(x - 30, y - 2); ctx.lineTo(x - 22, y - 2);
      ctx.moveTo(x + 22, y - 2); ctx.lineTo(x + 30, y - 2);
      ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 12);
      ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 14);
      ctx.stroke();
      // Label
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4422';
      ctx.fillText('INCOMING', x, y + 22);
      if (_starshipImg.complete && _starshipImg.naturalWidth) {
        var sz = 42;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(_starshipImg, x - sz/2, y - sz, sz, sz);
      } else {
        ctx.font = '14px sans-serif';
        ctx.fillText('\u{1F680}', x, y + 42);
      }
    } else if (ev.status === 'looting') {
      // Glow circle with loot dots
      var glowR = 30 + Math.sin(t / 500) * 5;
      ctx.globalAlpha = 0.15;
      var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      if (ev.eventType === 'rud_explosion') {
        grad.addColorStop(0, 'rgba(255,100,20,0.6)');
        grad.addColorStop(1, 'rgba(255,60,10,0)');
      } else {
        grad.addColorStop(0, 'rgba(0,255,136,0.5)');
        grad.addColorStop(1, 'rgba(0,200,100,0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
      // Center icon
      ctx.globalAlpha = 0.9;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ev.eventType === 'rud_explosion' ? '\u{1F4A5}' : '\u{1F4E6}', x, y + 6);
      // LOOT label
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = ev.eventType === 'rud_explosion' ? '#FF6644' : '#00FF88';
      var remaining = ev.totalRewards - ev.claimedRewards;
      ctx.fillText(remaining + ' LOOT', x, y - 24);
    }
  });

  ctx.restore();
}

function _initRocketMesh() {
  if (!globe || !globe.scene || typeof THREE === 'undefined') return;
  var scene = globe.scene();
  var group = new THREE.Group();
  // Rocket body (cylinder + cone)
  var bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
  var bodyMat = new THREE.MeshBasicMaterial({ color: 0xDDDDDD, transparent: true, opacity: 0.95 });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));
  var noseGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
  var noseMat = new THREE.MeshBasicMaterial({ color: 0xFF4422 });
  var nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.y = 0.8;
  group.add(nose);
  // Engine glow
  var engGeo = new THREE.SphereGeometry(0.12, 8, 8);
  var engMat = new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.8 });
  var eng = new THREE.Mesh(engGeo, engMat);
  eng.position.y = -0.7;
  group.add(eng);
  group.visible = false;
  scene.add(group);
  _rocketMesh = group;
}

function _updateRocketMesh() {
  if (!_rocketMesh) return;
  var ev = _rocketData.events.find(function(e) { return e.status === 'incoming' || e.status === 'looting'; });
  if (!ev) { _rocketMesh.visible = false; return; }

  var GLOBE_RADIUS = 100;
  var phi = (90 - ev.lat) * Math.PI / 180;
  var theta = (ev.lng + 180) * Math.PI / 180;

  if (ev.status === 'incoming') {
    // Descending animation
    var now = Date.now();
    var landTime = new Date(ev.landingAt).getTime();
    var progress = Math.max(0, Math.min(1, 1 - (landTime - now) / (2 * 60 * 60 * 1000))); // 0→1 over 2h
    var alt = GLOBE_RADIUS + 30 - progress * 25; // 130 → 105
    _rocketMesh.position.set(
      -alt * Math.sin(phi) * Math.cos(theta),
       alt * Math.cos(phi),
       alt * Math.sin(phi) * Math.sin(theta)
    );
    _rocketMesh.lookAt(0, 0, 0);
    _rocketMesh.rotateX(Math.PI); // Nose pointing down toward planet
    _rocketMesh.visible = true;
  } else if (ev.status === 'looting') {
    // Landed on surface
    var alt2 = GLOBE_RADIUS + 1;
    _rocketMesh.position.set(
      -alt2 * Math.sin(phi) * Math.cos(theta),
       alt2 * Math.cos(phi),
       alt2 * Math.sin(phi) * Math.sin(theta)
    );
    _rocketMesh.lookAt(0, 0, 0);
    _rocketMesh.rotateX(Math.PI);
    _rocketMesh.visible = ev.eventType !== 'rud_explosion'; // Hide if RUD
  }
}

function _sectorColor(tier){
  switch(tier){
    case 'core': return '#E84855';
    case 'mid': return '#FFD166';
    case 'frontier': return '#4CD89A';
    default: return '#FF7840';
  }
}
function zoomIn(){globe.pointOfView({altitude:Math.max(.08,globe.pointOfView().altitude*.7)},300);isZoomedIn=true}
function zoomOut(){
  var newAlt=Math.min(4,globe.pointOfView().altitude*1.4);
  globe.pointOfView({altitude:newAlt},300);
  if(newAlt>2)isZoomedIn=false;
}
function showToast(msg){var el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show')},3500)}
// ── 슬로대 스타일 파벌 플레이버 다이얼로그 ────────────────────────────────
// 클레임/하이잭 등 결정적 액션 직전 1-2초 캐릭터 대사로 몰입도 ↑
// (Super Robot Wars / 시뮬레이션 게임 류 사전 컷)
var FACTION_FLAVOR = {
  // ── 새 영토 클레임 (빈 땅) ─────────────────────────────────────────
  claim_new: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'이 구역은 아직 등록되지 않았다. 절차대로 진행한다.', line_en:'Sector unregistered. Proceeding by the book.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'좌표 확인 완료. MCC 표준 절차 개시.', line_en:'Coordinates confirmed. Initiating MCC standard procedure.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'미등록 영역. 회사가 가장 먼저 깃발 꽂으면 그게 회사 자산이다.', line_en:'Unregistered zone. First flag planted is company property.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚪', line:'이사회 승인 떨어졌다. 등록 진행하라.', line_en:'Board approved. Proceed with registration.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'이 땅은 아직 아무도 깃발 꽂지 않은 거 같군. 우리 차례다.', line_en:'Looks like no one\'s planted a flag here yet. Our turn.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'사람이 살 수 있는 곳이라면 어디든 우리 땅이 될 수 있어.', line_en:'Anywhere people can live, we can call home.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🟢', line:'아직 이름 없는 땅. 누군가 이 자리에 새겨질 거다.', line_en:'Unnamed land. Someone will be written into this place.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🟢', line:'젊은이, 이 땅을 잘 봐둬라. 곧 너희 집이 될 거다.', line_en:'Look at this land, youngster. It\'ll be your home soon.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🟢', line:'설계도 다시 그릴 시간이군. 새 정착지가 또 하나.', line_en:'Time to redraw the blueprints. Another new settlement.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'주인 없는 땅이야. 그럼 우리 거지.', line_en:'Unclaimed land. That makes it ours.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'무주공산. 의외로 화성에는 흔하지.', line_en:'No man\'s land. Surprisingly common on Mars.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🔴', line:'이 자리에 시추공 박으면 뭐가 나올까. 일단 등록부터.', line_en:'What would we find if we drilled here. Register first, ask later.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🔴', line:'먼저 발 디딘 놈이 임자다. 그게 화성의 룰이야.', line_en:'First one to plant their feet owns it. That\'s the Mars rule.' },
    { faction:null,  speaker:'Mission Control', emoji:'📡', line:'좌표 확인. 빈 영역. 깃발 박을 준비.', line_en:'Coordinates confirmed. Empty sector. Ready to plant the flag.' },
    { faction:null,  speaker:'AI Scout',    emoji:'🛰', line:'스캔 완료 — 미등록 좌표. 점유 가능.', line_en:'Scan complete — unregistered coordinates. Occupation possible.' },
    { faction:null,  speaker:'Surveyor',    emoji:'📐', line:'이 영역 측량 끝났다. 등록 신청 가능 상태.', line_en:'Survey of this sector complete. Registration can proceed.' },
  ],
  // ── 클레임 작전 시작 (등록 진행 중) ────────────────────────────────
  claim_executing: [
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'사령부, 깃발 박는다. 등록 절차 시작.', line_en:'Command, planting the flag. Starting registration.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚪', line:'서류 정리. 영수증 보관. 회사 자산 추가.', line_en:'Paperwork done. Receipt filed. Company assets updated.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚪', line:'좋아. 이사회에 보고할 자산 한 줄 추가됐다.', line_en:'Good. One more line added to the board report.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚪', line:'시간 맞춰 등록 완료. 다음 임무로 이동.', line_en:'Registration complete on schedule. Moving to next objective.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🟢', line:'이름 하나 더 새기자. 우리가 여기 있었다고.', line_en:'Let\'s carve one more name. We were here.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🟢', line:'한 평이라도 더. 사람들 살 자리.', line_en:'One more patch of land. Space for people to live.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🟢', line:'땅이 늘었다. 차 한 잔 더 끓일 만한 자리.', line_en:'Land expanded. Enough room for another cup of tea.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🟢', line:'이 땅에 무엇을 지을지부터 정해라. 설계가 먼저다.', line_en:'Decide what to build on this land first. Design before everything.' },
    { faction:'fsp', speaker:'Yuna',        emoji:'🟢', line:'벽에 분필로 좌표 적어둘게. 다음 세대도 알 수 있게.', line_en:'I\'ll write the coordinates in chalk. So future generations know.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🔴', line:'이 땅은 이제 우리 거다. 누구도 못 뺏는다.', line_en:'This land is ours now. No one takes it back.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🔴', line:'표시 박았다. 누가 뭐라 하면 의수로 답할 거다.', line_en:'Marked it. Anyone argues, my arm has the answer.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🔴', line:'경계선 그어둘게. 넘으면 그쪽 책임이야.', line_en:'Drawing the boundary. Cross it, that\'s on you.' },
    { faction:'cv',  speaker:'Crow',        emoji:'🔴', line:'이 자리 경비 배치. 다음 작전 거점으로 쓴다.', line_en:'Security deployed here. Next operation base.' },
    { faction:null,  speaker:'Mission Control', emoji:'📡', line:'영토 등록 송신 중... 잠시 기다리세요.', line_en:'Transmitting territory registration... please wait.' },
    { faction:null,  speaker:'AI Scout',    emoji:'🛰', line:'좌표 잠그는 중. 곧 영구 기록됨.', line_en:'Locking coordinates. Permanent record incoming.' },
  ],
  // ── 하이잭 선언 직전 (전투 진입) ───────────────────────────────────
  hijack_start: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚔', line:'적성 영토 확인. 자, 다들 꽉 잡으라고. 전투 들어간다.', line_en:'Hostile territory confirmed. Hold on tight. Entering combat.' },
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'⚔', line:'분쟁 영역. 회사 자산 확보를 위해 무력 사용 승인.', line_en:'Disputed zone. Force authorized to secure company assets.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'⚔', line:'적 함대 좌표 잡혔다. 교전 규칙 1단계 발동.', line_en:'Enemy fleet coordinates locked. Rules of engagement Level 1 activated.' },
    { faction:'mcc', speaker:'Director Osei', emoji:'⚔', line:'이건 비즈니스다. 감정 빼고 처리해.', line_en:'This is business. Process it without emotion.' },
    { faction:'mcc', speaker:'MCC 사령부',  emoji:'⚔', line:'전 함대 사격 통제. 표적 락온 후 발사.', line_en:'All fleet weapons hot. Lock targets then fire.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'⚔', line:'이번엔 봐주지 마라. 우리 사람들 위한 싸움이다.', line_en:'No mercy this time. We\'re fighting for our people.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'⚔', line:'적이 먼저 시작했다. 우리는 끝낼 뿐이다.', line_en:'They started this. We just finish it.' },
    { faction:'fsp', speaker:'Lena',        emoji:'⚔', line:'팔에 새겨진 이름들이 보고 있다. 살아 돌아온다.', line_en:'The names on my arm are watching. I\'m coming back alive.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'⚔', line:'늙은이가 마지막으로 한 마디 — 살아 돌아와라.', line_en:'One last word from an old man — come back alive.' },
    { faction:'fsp', speaker:'Yuna',        emoji:'⚔', line:'우리가 지키는 건 깃발이 아니라 이름들이다. 가자.', line_en:'What we protect isn\'t flags — it\'s names. Let\'s go.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'⚔', line:'전투 개시. 의수 풀어라. 일하러 간다.', line_en:'Engaging. Arm\'s off. Going to work.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'⚔', line:'30년 전이나 지금이나, 광부의 답은 하나다 — 전투.', line_en:'Thirty years ago or today — a miner\'s answer is the same. Fight.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'⚔', line:'코드 활성. CV 전 인원 전투 모드.', line_en:'Code active. CV all hands, combat mode.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'⚔', line:'장비 점검 끝났다. 가자. 살아 돌아와라.', line_en:'Equipment check done. Go. Come back alive.' },
    { faction:'cv',  speaker:'Crow',        emoji:'⚔', line:'마스크 내려라. 본격적으로 시작이다.', line_en:'Mask down. This is where it gets real.' },
    { faction:null,  speaker:'Fleet Command', emoji:'⚔', line:'전 함대 전투 배치. 카운트다운 — 5... 4... 3...', line_en:'All fleet combat positions. Countdown — 5... 4... 3...' },
    { faction:null,  speaker:'Tactical AI', emoji:'⚔', line:'표적 락온. 사격 통제 권한 위임. 행운을 빈다.', line_en:'Target locked. Weapons authority delegated. Good luck.' },
    { faction:null,  speaker:'Mission Control', emoji:'⚔', line:'교전 규칙 발동. 전 채널 전투 주파수 전환.', line_en:'ROE activated. All channels switching to combat frequency.' },
  ],
  // ── 함대전 진입 (배틀 뷰어 오픈 직전) ──────────────────────────────
  fleet_battle_engage: [
    { faction:'mcc', speaker:'Chen Weiss',  emoji:'🚀', line:'전 함선 라일거 충전. 미사일 록온 완료. 발사 대기.', line_en:'All ships railgun charged. Missiles locked. Ready to fire.' },
    { faction:'mcc', speaker:'Li Fang',     emoji:'🚀', line:'적 함대 진형 확인. 좌측 약점, 우측 보강. 패턴 분석 중.', line_en:'Enemy fleet formation confirmed. Left flank weak, right reinforced. Pattern analysis running.' },
    { faction:'mcc', speaker:'MCC 사령부',  emoji:'🚀', line:'전 함대, 표준 교전 규약. 손해는 최소, 자산은 최대.', line_en:'All fleet, standard engagement doctrine. Minimize losses, maximize assets.' },
    { faction:'mcc', speaker:'함장',        emoji:'🚀', line:'주포 발사 — 풀 살보! 보고 좀 받자고.', line_en:'Main guns fire — full salvo! Give me a readout.' },
    { faction:'fsp', speaker:'Lena',        emoji:'🚀', line:'팀, 우리 모두 무사히 돌아간다. 그게 1순위다.', line_en:'Team, we all go home. That is priority one.' },
    { faction:'fsp', speaker:'Mikhail',     emoji:'🚀', line:'적도 사람이 타고 있다. 그래도 — 우리 사람이 먼저다.', line_en:'There are people on those ships too. Still — our people come first.' },
    { faction:'fsp', speaker:'Hagar',       emoji:'🚀', line:'어떤 적이든 결국 사람이지. 그 사실은 잊지 마라.', line_en:'Any enemy is still human. Never forget that.' },
    { faction:'fsp', speaker:'Olu Adeyemi', emoji:'🚀', line:'함선 설계 한계 안에서 싸워라. 무리하면 깨진다.', line_en:'Fight within the ship\'s limits. Push too hard and you break.' },
    { faction:'cv',  speaker:'Butcher',     emoji:'🚀', line:'좋아. 첫 살보 시작. 내가 신호 줄 때까지 다들 위치 사수.', line_en:'Alright. First salvo initiated. Everyone hold positions until my signal.' },
    { faction:'cv',  speaker:'Aisha',       emoji:'🚀', line:'코드 발동 — 누구도 뒤에 안 남는다. 가자.', line_en:'Code activated — no one gets left behind. Move.' },
    { faction:'cv',  speaker:'Crow',        emoji:'🚀', line:'시야 확보. 사격 자유. 알아서 살아남아라.', line_en:'Clear field of vision. Weapons free. Survive on your own.' },
    { faction:'cv',  speaker:'Cinder Grace',emoji:'🚀', line:'엔진 점검 끝. 무기 풀로드. 행운 빈다.', line_en:'Engine check done. Weapons fully loaded. Good luck.' },
    { faction:null,  speaker:'Tactical AI', emoji:'🎯', line:'함대전 시뮬레이션 시작. 실시간 결과 추적 중.', line_en:'Fleet battle simulation starting. Tracking results in real time.' },
    { faction:null,  speaker:'Fleet Command', emoji:'🎯', line:'주포 충전 100%. 살보 1발사. 살보 2 대기.', line_en:'Main guns at 100%. Salvo 1 fired. Salvo 2 on standby.' },
    { faction:null,  speaker:'Battle Bridge', emoji:'🎯', line:'적 진형 분석 중... 아군 손실 예측 모델 가동.', line_en:'Analyzing enemy formation... Running casualty prediction model.' },
    { faction:null,  speaker:'AI Tactical', emoji:'🎯', line:'EMP 회피 기동 권장. 자동 회피 ON.', line_en:'EMP evasion maneuver recommended. Auto-evade ON.' },
  ],
};

function _myFactionCode(){
  try{
    if(typeof factionState!=='undefined'&&factionState&&factionState.current&&factionState.current.code){
      return factionState.current.code;
    }
  }catch(_){}
  return null;
}

function showFactionFlavor(situation, opts){
  var pool = FACTION_FLAVOR[situation] || [];
  if(!pool.length) return Promise.resolve();
  var myFac = _myFactionCode();
  // 우선 내 파벌 매칭, 없으면 neutral, 없으면 random
  var candidates = pool.filter(function(p){return p.faction===myFac;});
  if(!candidates.length) candidates = pool.filter(function(p){return p.faction===null;});
  if(!candidates.length) candidates = pool;
  var pick = candidates[Math.floor(Math.random()*candidates.length)];
  var dur = (opts&&opts.duration)||1800;

  return new Promise(function(resolve){
    var prev = document.getElementById('factionFlavor'); if(prev) prev.remove();
    var box = document.createElement('div');
    box.id = 'factionFlavor';
    var color = pick.faction==='mcc'?'#5cbbff':pick.faction==='fsp'?'#7cd7a4':pick.faction==='cv'?'#ff6b6b':'#ffd166';
    box.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);z-index:10001;'
      + 'min-width:280px;max-width:90vw;padding:14px 18px;border:1px solid '+color+';'
      + 'border-radius:10px;background:linear-gradient(180deg,rgba(10,10,16,.96),rgba(20,16,28,.92));'
      + 'box-shadow:0 8px 40px '+color+'66;font-family:var(--fn);'
      + 'opacity:0;transition:opacity .35s ease,transform .35s ease;cursor:pointer';
    box.innerHTML = '<div style="font-size:9px;color:'+color+';font-weight:800;letter-spacing:1.5px;margin-bottom:5px">'
      + (pick.emoji||'') + ' ' + escapeHtmlSafe(pick.speaker)
      + '</div>'
      + '<div style="font-size:11px;color:#f0f0f0;line-height:1.55">' + escapeHtmlSafe((LANG!=='ko'&&pick.line_en)||pick.line) + '</div>';
    document.body.appendChild(box);
    requestAnimationFrame(function(){
      box.style.opacity = '1';
      box.style.transform = 'translateX(-50%) translateY(-6px)';
    });
    function close(){
      box.style.opacity='0';
      setTimeout(function(){ try{ box.remove(); }catch(_){ } resolve(); }, 250);
    }
    box.onclick = close;
    setTimeout(close, dur);
  });
}

// ── 보조 버튼 실제 구현 ─────────────────────────────────────────────────
// openMyMineralsPanel: 보유 광물 (resource_id, name, qty) 모달 표시
// openMyShipRegistry: 보유 함선 명부 모달 표시
// openWorldEventDetail: window.openWorldEventDetail (line 22814) 참조 — ENGAGE 모달로 연결

function _openInfoModal(title, bodyHtml, accentColor){
  var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
  var modal = document.createElement('div');
  modal.id = 'infoDetailModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);font-family:var(--fn)';
  modal.onclick = function(e){ if(e.target===modal) modal.remove(); };
  var color = accentColor || '#5cbbff';
  modal.innerHTML = '<div style="background:linear-gradient(180deg,#181820,#0e0e16);border:1px solid '+color+';border-radius:12px;padding:18px;max-width:420px;width:100%;max-height:80vh;overflow:auto;box-shadow:0 8px 50px '+color+'66">'
    + '<div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:12px;text-align:center;letter-spacing:1px">'+escapeHtmlSafe(title)+'</div>'
    + '<div style="font-size:10px;color:var(--tx2);line-height:1.6">'+bodyHtml+'</div>'
    + '<button onclick="document.getElementById(\'infoDetailModal\').remove()" style="width:100%;margin-top:14px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-family:var(--fn);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer">'+(LANG==='ko'?'닫기':LANG==='ja'?'閉じる':LANG==='zh'?'关闭':'Close')+'</button>'
    + '</div>';
  document.body.appendChild(modal);
}

function openMyMineralsPanel(){
  var w = walletState.address;
  if(!w){ showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')); return; }
  _openInfoModal('💎 MY MINERALS', '<div style="text-align:center;color:var(--tx3)">Loading...</div>', '#81c784');
  mapOverlayReadJson('resources-my', '/api/resources/my', 10000)
    .then(function(d){
      if(!d) return;
      var items = d.resources || d.inventory || d || [];
      if(!Array.isArray(items)) items = items.resources || [];
      var body = '';
      if(!items.length){
        body = '<div style="text-align:center;color:var(--tx3);padding:14px">'+(LANG==='ko'?'보유 광물 없음':LANG==='ja'?'保有鉱物なし':LANG==='zh'?'无持有矿石':'No minerals held')+'</div>';
      } else {
        body = '<div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px">';
        items.forEach(function(it){
          var name = it.name || it.resource_name || it.resource_id || it.id || '?';
          var qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 0);
          var tier = it.tier!=null?' T'+it.tier:'';
          body += '<div style="color:var(--tx2)">'+escapeHtmlSafe(String(name))+tier+'</div><div style="color:#ffd166;font-weight:600;text-align:right">'+qty+'</div>';
        });
        body += '</div>';
      }
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('💎 MY MINERALS', body, '#81c784');
    })
    .catch(function(){
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('💎 MY MINERALS', '<div style="text-align:center;color:var(--mars)">'+(LANG==='ko'?'로드 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>', '#81c784');
    });
}

function openMyShipRegistry(){
  var w = walletState.address;
  if(!w){ showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录')); return; }
  _openInfoModal('🚀 SHIP REGISTRY', '<div style="text-align:center;color:var(--tx3)">Loading...</div>', '#5cbbff');
  mapOverlayReadJson('ships-my', '/api/ships/my', 10000)
    .then(function(d){
      if(!d) return;
      var ships = (d && d.ships) || [];
      var summary = (d && d.summary) || null;
      var body = '';
      if(summary){
        body += '<div style="text-align:center;color:var(--tx3);font-size:9px;margin-bottom:10px">'+(LANG==='ko'?'총 ':LANG==='ja'?'計 ':LANG==='zh'?'共 ':'Total ')+(summary.total_ships||ships.length||0)+(LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships')+(summary.alive!=null?(LANG==='ko'?' · 가용 ':LANG==='ja'?' · 可 ':LANG==='zh'?' · 可用 ':' · Available ')+summary.alive+(LANG==='ko'?'척':LANG==='ja'?'隻':LANG==='zh'?'艘':' ships'):'')+'</div>';
      }
      if(!ships.length){
        body += '<div style="text-align:center;color:var(--tx3);padding:14px">'+t('fleet_no_ships_hint')+'</div>';
      } else {
        body += '<div style="display:grid;grid-template-columns:1fr auto auto;gap:5px 10px;font-size:9px">';
        body += '<div style="color:var(--tx3);font-weight:700">SHIP</div><div style="color:var(--tx3);font-weight:700;text-align:center">HP</div><div style="color:var(--tx3);font-weight:700;text-align:right">STATUS</div>';
        ships.forEach(function(s){
          var name = s.name || s.ship_type_name || s.ship_type_code || 'Ship#'+s.id;
          var hp = (s.current_hp!=null && s.max_hp!=null) ? (s.current_hp+'/'+s.max_hp) : (s.hp||'?');
          var status = s.is_alive===false || s.status==='destroyed' ? '💥' : (s.in_battle ? '⚔' : '✅');
          body += '<div style="color:var(--tx2)">'+escapeHtmlSafe(String(name))+'</div><div style="color:#7cd7a4;text-align:center">'+escapeHtmlSafe(String(hp))+'</div><div style="text-align:right">'+status+'</div>';
        });
        body += '</div>';
      }
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('🚀 SHIP REGISTRY', body, '#5cbbff');
    })
    .catch(function(){
      var prev = document.getElementById('infoDetailModal'); if(prev) prev.remove();
      _openInfoModal('🚀 SHIP REGISTRY', '<div style="text-align:center;color:var(--mars)">'+(LANG==='ko'?'로드 실패':LANG==='ja'?'読込失敗':LANG==='zh'?'加载失败':'Load failed')+'</div>', '#5cbbff');
    });
}

// openWorldEventDetail: window.openWorldEventDetail (ENGAGE 모달) 로 위임
// 중복 function 선언 제거 — 호이스팅으로 window 할당을 덮어쓰는 문제 수정됨
// Alias: legacy callers (OPS, guild upgrades) use showAlert(msg[,type]).
// Route them through the toast so they don't ReferenceError.
window.showAlert=function(m){return showToast(m);};

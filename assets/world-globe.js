/* ── Noise helpers (improved) ─────────────────────── */
function _h(a,b){var n=a*374761393+b*668265263;n=(n^(n>>13))*1274126177;return((n^(n>>16))&0xffff)/65535}
function _n(px,py){var ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;fx=fx*fx*fx*(fx*(fx*6-15)+10);fy=fy*fy*fy*(fy*(fy*6-15)+10);return _h(ix,iy)+((_h(ix+1,iy)-_h(ix,iy))*fx)+((_h(ix,iy+1)-_h(ix,iy))*fy)+((_h(ix,iy)-_h(ix+1,iy)-_h(ix,iy+1)+_h(ix+1,iy+1))*fx*fy)}
function _fbm(px,py){return _n(px,py)*.5+_n(px*2.1,py*2.1)*.25+_n(px*4.3,py*4.3)*.125+_n(px*8.7,py*8.7)*.0625}
function _fbm6(px,py){return _fbm(px,py)+_n(px*17.3,py*17.3)*.03+_n(px*33,py*33)*.015}
function _ridge(px,py){var v=_n(px,py);return 1-Math.abs(v*2-1)}

/* ── Crater generator (no overlap, spherical-correct) ── */
var CRATERS=[];
(function(){
  // Spherical distance on equirectangular UV (u=360°, v=180° → 2:1 ratio)
  function uvDist(u1,v1,u2,v2){
    var lat=(v1-0.5)*Math.PI;
    var cosLat=Math.cos(lat);
    var du=(u1-u2)*2*cosLat; // ×2 because u spans 360° but v spans 180°
    return Math.sqrt(du*du+(v1-v2)*(v1-v2));
  }
  function tryPlace(r,d,ring,tries){
    for(var t=0;t<tries;t++){
      var u=Math.random(),v=Math.random()*0.78+0.11;
      var ok=true;
      for(var j=0;j<CRATERS.length;j++){
        var c2=CRATERS[j];
        if(uvDist(u,v,c2.u,c2.v)<r+c2.r+0.005){ok=false;break}
      }
      if(ok){CRATERS.push({u:u,v:v,r:r,d:d,ring:ring});return true}
    }
    return false;
  }
  // Large impact basins (no overlap)
  for(var i=0;i<8;i++) tryPlace(Math.random()*0.035+0.03, Math.random()*0.25+0.3, true, 200);
  // Medium craters
  for(var i=0;i<50;i++) tryPlace(Math.random()*0.018+0.008, Math.random()*0.3+0.2, false, 100);
  // Small craters
  for(var i=0;i<180;i++) tryPlace(Math.random()*0.005+0.002, Math.random()*0.2+0.1, false, 50);
})();
setLoadProgress(10,'Generating craters...');

function marsAuthHeaders(){
  try{
    return (window.getAuthHeaders && window.getAuthHeaders()) || {};
  }catch(_){
    return {};
  }
}

function craterAt(u,v){
  var val=0;
  // cosine correction + 2:1 aspect ratio: make craters circular on sphere
  var lat=(v-0.5)*Math.PI;
  var cosLat=Math.cos(lat);
  if(cosLat<0.15) cosLat=0.15;
  for(var i=0;i<CRATERS.length;i++){
    var c=CRATERS[i];
    var du=(u-c.u)*2*cosLat; // ×2 for u:v aspect (360°:180°), ×cosLat for latitude
    var dv=v-c.v;
    var dist=Math.sqrt(du*du+dv*dv);
    if(dist<c.r*1.3){
      var t=dist/c.r;
      if(t<0.75){
        // Bowl floor with subtle noise
        val-=c.d*(1-t/0.75)*(0.85+_n(u*40+i,v*40)*0.3);
      }else if(t<1.0){
        // Rim wall
        var rimH=c.ring?0.7:0.45;
        val+=c.d*rimH*Math.pow((t-0.75)/0.25,0.6);
      }else if(c.ring){
        // Ejecta blanket for large craters only
        var ej=(1-(t-1.0)/0.3)*0.06;
        val+=ej*_n(u*60+i,v*60)*c.d;
      }
    }
  }
  return val;
}

/* ── Generate Procedural Mars Texture (HD) ───────── */
// Texture compositing budget:
// - Default desktop stays 4K for stable gameplay.
// - Strong desktop can auto-use 6K, and localStorage.marsHiResTexture='1' opts into 8K.
// - Mobile stays 3K to avoid JPEG upload stalls and black-texture GPU failures.
var marsCanvas=document.createElement('canvas');
(function(){
  var _isMobCanvas=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  var _mem=(navigator.deviceMemory||4);
  var _cores=(navigator.hardwareConcurrency||4);
  var _force8k=false;
  try{ _force8k=localStorage.getItem('marsHiResTexture')==='1'; }catch(_e){}
  var _auto6k=(!_isMobCanvas && _mem>=8 && _cores>=8 && (window.devicePixelRatio||1)<=2);
  marsCanvas.width  = _isMobCanvas ? 3072 : (_force8k ? 8192 : (_auto6k ? 6144 : 4096));
  marsCanvas.height = _isMobCanvas ? 1536 : (_force8k ? 4096 : (_auto6k ? 3072 : 2048));
})();
var marsBaseData=null;

function genMarsTexture(){
  var c=marsCanvas;
  var x=c.getContext('2d'),w=c.width,h=c.height;
  // Simple Mars gradient — NASA texture is the real one
  var g=x.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'#c4714a');g.addColorStop(0.15,'#b8623c');
  g.addColorStop(0.4,'#a85535');g.addColorStop(0.5,'#9e4e30');
  g.addColorStop(0.6,'#a85535');g.addColorStop(0.85,'#b8623c');
  g.addColorStop(1,'#c4714a');
  x.fillStyle=g;x.fillRect(0,0,w,h);
  // Slight noise for non-flat look
  var id=x.getImageData(0,0,w,h),d=id.data;
  for(var i=0;i<d.length;i+=4){
    var n=(Math.random()*16-8)|0;
    d[i]+=n;d[i+1]+=(n/2)|0;d[i+2]+=(n/3)|0;
  }
  x.putImageData(id,0,0);
  marsBaseData=c.toDataURL('image/jpeg',.85);
  return marsBaseData;
}

/* ── lat/lng → UV pixel coords on equirectangular texture ── */
function latlngToUV(lat,lng,w,h){
  var x=((lng+180)/360)*w;
  var y=((90-lat)/180)*h;
  return {x:x,y:y};
}

/* ── Composite all claim images onto Mars texture ── */
// Image rect on texture — supports non-square w×h
function getCellRect(lat,lng,cw,ch,tw,th){
  var pxPerDeg=tw/360;
  // Cosine correction: compress width at higher latitudes
  // so images appear undistorted on the 3D sphere
  var cosLat=Math.cos(lat*Math.PI/180);
  if(cosLat<0.15) cosLat=0.15; // clamp near poles to avoid extreme stretch
  var gs=_actualGridStep||GRID_SIZE;
  var pw=gs*cw*pxPerDeg/cosLat;
  var ph=gs*ch*pxPerDeg;
  var uv=latlngToUV(lat,lng,tw,th);
  return {x:uv.x-pw/2, y:uv.y-ph/2, w:pw, h:ph};
}

// Cached base+claims snapshot for fast preview overlay
var claimsSnapshot=null; // ImageData of base Mars + claims (no preview)
var previewRafId=null;
var marsCanvasTexture=null; // THREE.CanvasTexture for direct GPU upload (no JPEG)
var nasaBaseImg=null; // cached NASA texture Image for composite

// Per-user territory color from wallet address hash
function _ownerColor(addr){
  if(!addr) return {r:255,g:120,b:60};
  var h=0;
  for(var i=0;i<addr.length;i++) h=((h<<5)-h+addr.charCodeAt(i))|0;
  // Generate HSL hue from hash, keep saturation/lightness in pleasant range
  var hue=((h%360)+360)%360;
  var s=55+((h>>8)%20); // 55-75%
  var l=50+((h>>16)%15); // 50-65%
  // HSL to RGB
  var c=(1-Math.abs(2*l/100-1))*s/100;
  var x=c*(1-Math.abs((hue/60)%2-1));
  var m=l/100-c/2;
  var r1,g1,b1;
  if(hue<60){r1=c;g1=x;b1=0}else if(hue<120){r1=x;g1=c;b1=0}
  else if(hue<180){r1=0;g1=c;b1=x}else if(hue<240){r1=0;g1=x;b1=c}
  else if(hue<300){r1=x;g1=0;b1=c}else{r1=c;g1=0;b1=x}
  return {r:Math.round((r1+m)*255),g:Math.round((g1+m)*255),b:Math.round((b1+m)*255)};
}

function compositeClaimsOnTexture(previewOnly){
  if(!globe||!marsCanvas) return;
  // Skip compositing while waiting for NASA texture on mobile
  if(currentTexMode==='simple') return;
  var _isMob=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  // On mobile with NASA mode: skip if NASA image not cached yet (let globe.gl show it directly)
  if(currentTexMode==='nasa' && _isMob){
    var _nasaKey = nasa8kLoaded ? NASA_MARS_8K : NASA_MARS_2K;
    if(!imgCache[_nasaKey]){
      if(_imgFailed[_nasaKey]){
        if(!marsBaseData) return;
        console.warn('[Mars] NASA cache unavailable on mobile — using procedural fallback for composite');
      } else {
        // Ensure cache load kicks off (idempotent)
        cacheImage(_nasaKey, function(img){
          if(img) compositeClaimsOnTexture();
        });
        return;
      }
    }
    // Extra safety: verify the cached image actually has valid dimensions
    if(imgCache[_nasaKey] && (!imgCache[_nasaKey].width || !imgCache[_nasaKey].height)){
      delete imgCache[_nasaKey];
      cacheImage(_nasaKey, function(img){
        if(img) compositeClaimsOnTexture();
      });
      return;
    }
  }
  try{ globe.globeMaterial(); }catch(e){ return; } // globe not ready yet
  var ctx=marsCanvas.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  var w=marsCanvas.width,h=marsCanvas.height;

  // Choose base image based on current texture mode
  var baseUrl=marsBaseData;
  if(currentTexMode==='nasa'){
    var nasaUrl=nasa8kLoaded?NASA_MARS_8K:NASA_MARS_2K;
    if(imgCache[nasaUrl]){
      baseUrl=nasaUrl;
    }else{
      // Keep the already-mounted NASA globe texture visible until the cache is ready.
      // Falling through to the procedural base here makes the planet appear as if the
      // 2K/8K texture disappeared, even though the real NASA image is still loading.
      cacheImage(nasaUrl,function(){compositeClaimsOnTexture()});
      if(_imgFailed[nasaUrl] && marsTexUrl && globe){
        try{ globe.globeImageUrl(marsTexUrl); }catch(_nf){}
      }
      return;
    }
  }

  var base=imgCache[baseUrl];
  if(!base){cacheImage(baseUrl,function(){compositeClaimsOnTexture()});return}

  if(!previewOnly){
    // Full rebuild: base + grid + claims → cache snapshot
    ctx.drawImage(base,0,0,w,h);

    // Faint grid (every 10°)
    ctx.strokeStyle='rgba(255,107,53,0.03)';ctx.lineWidth=0.5;
    for(var glat=-70;glat<=70;glat+=10){
      var gy=((90-glat)/180)*h;
      ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke();
    }
    for(var glng=-180;glng<180;glng+=10){
      var gx=((glng+180)/360)*w;
      ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke();
    }

    // Draw each claim (with longitude wrap-around handling)
    function _drawOneRect(ctx,img,rx,ry,rw,rh,noImage,ownerLabel,oc,imgParams){
      if(img){
        // Masking render: clip to territory rect, apply scale/rotate/offset
        ctx.save();
        ctx.beginPath();ctx.rect(rx,ry,rw,rh);ctx.clip();
        var ip=imgParams||{};
        var s=(ip.scale||100)/100;
        var rot=(ip.rotate||0)*Math.PI/180;
        var ox=ip.ox||0, oy=ip.oy||0;
        var _gsTPx2=_gs*_pxDeg;
        var cx=rx+rw/2+ox*_gsTPx2*s, cy=ry+rh/2+oy*_gsTPx2*s;
        ctx.translate(cx,cy);
        ctx.rotate(rot);
        var coverScale=Math.max(rw/img.width, rh/img.height)*s;
        var dw=img.width*coverScale, dh=img.height*coverScale;
        ctx.drawImage(img,-dw/2,-dh/2,dw,dh);
        ctx.restore();
        // Borders drawn in grouped exterior pass
      }else if(noImage){
        // Land-only claim — colored territory
        var tc=oc||{r:255,g:120,b:60};
        ctx.fillStyle='rgba('+tc.r+','+tc.g+','+tc.b+',0.35)';
        ctx.fillRect(rx,ry,rw,rh);
        // Borders drawn in grouped exterior pass
        // Owner label
        if(rw>20&&rh>12){
          ctx.save();
          ctx.beginPath();ctx.rect(rx,ry,rw,rh);ctx.clip();
          var lfs=Math.max(5,Math.min(rw*0.15,rh*0.28,12));
          ctx.fillStyle='rgba('+tc.r+','+tc.g+','+tc.b+',1)';ctx.font='bold '+lfs+'px sans-serif';
          ctx.textAlign='center';ctx.textBaseline='middle';
          var lbl=ownerLabel||'CLAIMED';
          var maxW=rw-4;
          if(ctx.measureText(lbl).width>maxW){
            while(lbl.length>1&&ctx.measureText(lbl+'…').width>maxW) lbl=lbl.slice(0,-1);
            lbl=lbl+'…';
          }
          ctx.fillText(lbl,rx+rw/2,ry+rh/2,maxW);
          ctx.restore();
        }
      }else{
        // Loading placeholder
        ctx.fillStyle='rgba(255,255,255,0.08)';
        ctx.fillRect(rx,ry,rw,rh);
        ctx.strokeStyle='rgba(255,209,102,0.25)';ctx.lineWidth=1;
        ctx.setLineDash([3,3]);ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
        var lfs=Math.max(6,Math.min(rw,rh)*0.2);
        ctx.fillStyle='rgba(255,209,102,0.6)';ctx.font='bold '+lfs+'px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('LOADING',rx+rw/2,ry+rh/2);
      }
    }
    function _drawClaimRect(ctx,img,r,w,noImage,ownerLabel,oc,imgParams){
      _drawOneRect(ctx,img,r.x,r.y,r.w,r.h,noImage,ownerLabel,oc,imgParams);
      if(r.x<0) _drawOneRect(ctx,img,r.x+w,r.y,r.w,r.h,noImage,ownerLabel,oc,imgParams);
      else if(r.x+r.w>w) _drawOneRect(ctx,img,r.x-w,r.y,r.w,r.h,noImage,ownerLabel,oc,imgParams);
    }
    // Shield glow effect — drawn once per merged territory group, not per claim.
    // Shield glow: soft tinted overlay on territory + single icon at center.
    function _drawShieldGroup(ctx,groupStrips,bx1,by1,bx2,by2,shieldType){
      if(!groupStrips.length) return;
      var isAdvanced=shieldType==='shield_advanced';
      var glowColor=isAdvanced?'rgba(80,200,255,':'rgba(60,160,255,';
      ctx.save();
      // Shield icon only — no border lines
      ctx.globalAlpha=_shieldPulse;
      var iconSz=Math.max(14,Math.min(bx2-bx1,by2-by1)*0.18);
      iconSz=Math.min(iconSz,32);
      ctx.font='bold '+iconSz+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor=isAdvanced?'#50C8FF':'#3CA0FF';
      ctx.shadowBlur=6;
      ctx.fillStyle=glowColor+'0.9)';
      ctx.fillText(isAdvanced?'🔰':'🛡️',bx2-iconSz*0.6,by1+iconSz*0.6);
      ctx.globalAlpha=1;
      ctx.restore();
    }
    var myAddr=(walletState.address||'').toLowerCase();
    var _shieldPulse=Math.sin(Date.now()/600)*0.15+0.85;

    // 내 영토는 항상 마지막에 그려 위에 올라오도록 (old→new, isMine last)
    var sortedClaims=claims.slice().sort(function(a,b){
      var aM=(myAddr&&(a.owner||'').toLowerCase()===myAddr)?1:0,bM=(myAddr&&(b.owner||'').toLowerCase()===myAddr)?1:0;
      if(aM!==bM) return aM-bM;
      return (a.ts||0)-(b.ts||0);
    });
    // Pre-compute rects for clipping
    var claimRects=sortedClaims.map(function(c){
      var cw=c.w||c.size||20, ch=c.h||c.size||20;
      return getCellRect(c.lat,c.lng,cw,ch,w,h);
    });

    // ── Pixel-accurate rendering via horizontal strips (global cache) ──
    var _ownerStrips=_globalOwnerStrips;
    var _stripsByOwnerLat=_globalOwnerStripsByLat;

    // Strip → screen rect
    var _pxDeg=w/360, _gs=_actualGridStep;
    var _sRectOx=0; // wrap-around x-offset (0 or ±w)
    function _sRect(s){
      var dw=s.lng2-s.lng1+_gs;
      var pw=dw*_pxDeg, ph=_gs*_pxDeg;
      var cx=((s.lng1+s.lng2)/2+180)/360*w+_sRectOx;
      var cy=(90-s.lat)/180*h;
      return{x:cx-pw/2,y:cy-ph/2,w:pw,h:ph};
    }

    // Render: claim rects for fills/images, strips for borders only
    var _processedOwners={};
    sortedClaims.forEach(function(c){
      if(_processedOwners[c.owner]) return;
      _processedOwners[c.owner]=true;
      var strips=_ownerStrips[c.owner];
      if(!strips||!strips.length) return;

      var isNPC=c.owner&&c.owner.indexOf('0xnpc_')===0;
      var isMine=!!(myAddr&&(c.owner||'').toLowerCase()===myAddr);
      var oc=_ownerColor(c.owner);
      var territoryTone=isMine
        ? {fill:{r:255,g:209,b:102}, line:{r:255,g:222,b:116}, text:'rgba(255,238,166,1)', alpha:0.40, halo:0.42, dash:null}
        : (isNPC
          ? {fill:{r:126,g:106,b:170}, line:{r:126,g:106,b:170}, text:'rgba(238,232,255,0.78)', alpha:0.08, halo:0.22, dash:[7,5]}
          : {fill:{r:55,g:183,b:255}, line:{r:74,g:205,b:255}, text:'rgba(226,250,255,0.96)', alpha:0.14, halo:0.34, dash:null});

      // Pass 1: Fill + images per group
      ctx.save();
      var ownerGroups=_ownerGroups[c.owner]||[];
      ownerGroups.forEach(function(grp){
        // Detect if group extends past ±180° boundary
        var _grpWrapOffsets=[0];
        var gb0=grp.bounds;
        if(gb0&&gb0.maxLng>180) _grpWrapOffsets.push(-w); // right overflow → draw wrapped copy on left
        if(gb0&&gb0.minLng<-180) _grpWrapOffsets.push(w);  // left overflow → draw wrapped copy on right
        _grpWrapOffsets.forEach(function(_wrapOx){
        _sRectOx=_wrapOx;
        var groupClaims=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
        // Find shared image + anchor claim
        var sharedImg=null, sharedImgParams=null, anchorClaim=null;
        for(var gi=0;gi<groupClaims.length;gi++){
          var gc=groupClaims[gi];
          if(gc.imgUrl&&gc.imgUrl.length>0){
            sharedImg=imgCache[gc.imgUrl]||null;
            sharedImgParams={scale:gc.imgScale||100,rotate:gc.imgRotate||0,ox:gc.imgOffsetX||0,oy:gc.imgOffsetY||0};
            anchorClaim=gc;
            break;
          }
        }
        // Compute claim rects + group bounding box
        var rects=[], bx1=Infinity, by1=Infinity, bx2=-Infinity, by2=-Infinity;
        groupClaims.forEach(function(gc){
          var r=getCellRect(gc.lat,gc.lng,gc.w||20,gc.h||20,w,h);
          rects.push(r);
          if(r.x<bx1)bx1=r.x;if(r.y<by1)by1=r.y;
          if(r.x+r.w>bx2)bx2=r.x+r.w;if(r.y+r.h>by2)by2=r.y+r.h;
        });
        if(sharedImg){
          // Clip to territory shape using strips (pixel-accurate, no gaps)
          var gb2i=grp.bounds;
          var gStripsClip=(strips||[]).filter(function(s){
            return s.lat>=gb2i.minLat-_gs*0.5&&s.lat<=gb2i.maxLat+_gs*0.5&&
                   s.lng1>=gb2i.minLng-_gs*0.5&&s.lng2<=gb2i.maxLng+_gs*0.5;
          });
          // If no strips match this group, skip drawing (pixels were hijacked)
          if(gStripsClip.length===0) return;
          ctx.save();
          ctx.beginPath();
          // Pad each strip rect by 0.75px so adjacent strips overlap — eliminates
          // subpixel gaps that produce dark horizontal lines inside claim images.
          for(var sci=0;sci<gStripsClip.length;sci++){
            var ssr=_sRect(gStripsClip[sci]);
            ctx.rect(ssr.x-0.75, ssr.y-0.75, ssr.w+1.5, ssr.h+1.5);
          }
          ctx.clip();
          // Solid fill under image (covers all clipped area — prevents Mars surface bleed)
          ctx.fillStyle='rgb(30,20,15)';
          ctx.fill();
          // Image FIXED at anchor claim center (large scale, clip path reveals territory shape)
          var ar=getCellRect(anchorClaim.lat,anchorClaim.lng,anchorClaim.w||20,anchorClaim.h||20,w,h);
          ar.x+=_sRectOx; // apply wrap-around offset
          var ip=sharedImgParams, s=(ip.scale||100)/100;
          var rot=(ip.rotate||0)*Math.PI/180;
          var _gsTPx=_gs*_pxDeg; // 1 grid unit in texture pixels
          ctx.translate(ar.x+ar.w/2+(ip.ox||0)*_gsTPx*s, ar.y+ar.h/2+(ip.oy||0)*_gsTPx*s);
          ctx.rotate(rot);
          var cs=_gsTPx*s;
          ctx.drawImage(sharedImg,-sharedImg.width*cs/2,-sharedImg.height*cs/2,sharedImg.width*cs,sharedImg.height*cs);
          ctx.restore();
          // Strip-based exterior border (same as non-image groups)
          var byLat2=_stripsByOwnerLat[c.owner]||{};
          var gsKey2=byLat2._latStep||Math.round(_gs*100);
          var gb2=grp.bounds;
          var gStrips2=(strips||[]).filter(function(s){
            return s.lat>=gb2.minLat-_gs*0.5&&s.lat<=gb2.maxLat+_gs*0.5&&
                   s.lng1>=gb2.minLng-_gs*0.5&&s.lng2<=gb2.maxLng+_gs*0.5;
          });
          var bc2=territoryTone.line;
          ctx.setLineDash([]);
          ctx.lineCap='square';
          ctx.beginPath();
          for(var si2=0;si2<gStrips2.length;si2++){
            var ss2=gStrips2[si2], sr2=_sRect(ss2);
            var lk2=Math.round(ss2.lat*100);
            ctx.moveTo(sr2.x,sr2.y);ctx.lineTo(sr2.x,sr2.y+sr2.h);
            ctx.moveTo(sr2.x+sr2.w,sr2.y);ctx.lineTo(sr2.x+sr2.w,sr2.y+sr2.h);
            var adj3=byLat2[lk2+gsKey2]||[];
            var covX3=[];for(var ai3=0;ai3<adj3.length;ai3++){var ar3=_sRect(adj3[ai3]);var o13=Math.max(sr2.x,ar3.x),o23=Math.min(sr2.x+sr2.w,ar3.x+ar3.w);if(o23>o13)covX3.push([o13,o23]);}
            covX3.sort(function(a,b){return a[0]-b[0]});var pos3=sr2.x;
            for(var ci3=0;ci3<covX3.length;ci3++){if(covX3[ci3][0]>pos3+0.5){ctx.moveTo(pos3,sr2.y);ctx.lineTo(covX3[ci3][0],sr2.y);}pos3=covX3[ci3][1];}
            if(pos3<sr2.x+sr2.w-0.5){ctx.moveTo(pos3,sr2.y);ctx.lineTo(sr2.x+sr2.w,sr2.y);}
            var adj4=byLat2[lk2-gsKey2]||[];
            var covX4=[];for(var ai4=0;ai4<adj4.length;ai4++){var ar4=_sRect(adj4[ai4]);var o14=Math.max(sr2.x,ar4.x),o24=Math.min(sr2.x+sr2.w,ar4.x+ar4.w);if(o24>o14)covX4.push([o14,o24]);}
            covX4.sort(function(a,b){return a[0]-b[0]});var pos4=sr2.x, yb2=sr2.y+sr2.h;
            for(var ci4=0;ci4<covX4.length;ci4++){if(covX4[ci4][0]>pos4+0.5){ctx.moveTo(pos4,yb2);ctx.lineTo(covX4[ci4][0],yb2);}pos4=covX4[ci4][1];}
            if(pos4<sr2.x+sr2.w-0.5){ctx.moveTo(pos4,yb2);ctx.lineTo(sr2.x+sr2.w,yb2);}
          }
          // Pass 1: Wide halo (atmospheric bleed)
          ctx.strokeStyle='rgba('+bc2.r+','+bc2.g+','+bc2.b+','+territoryTone.halo+')';
          ctx.lineWidth=isMine?2:2;
          ctx.stroke();
          // Pass 2: Crisp tactical line
          if(territoryTone.dash) ctx.setLineDash(territoryTone.dash); else ctx.setLineDash([]);
          ctx.strokeStyle='rgba('+bc2.r+','+bc2.g+','+bc2.b+','+(isMine?'1':'0.9')+')';
          ctx.lineWidth=isMine?0.8:0.8;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineCap='butt';
        }else{
          // No image: pixel-accurate fill using strips + label
          var displayLabel=isNPC?(c.owner.replace('0xnpc_','').replace(/_/g,' ').toUpperCase()):(c.nickname||c.label||shortAddr(c.owner));
          var byLat=_stripsByOwnerLat[c.owner]||{};
          var gsKey=byLat._latStep||Math.round(_gs*100);
          var gb=grp.bounds;
          var gStrips=(strips||[]).filter(function(s){
            return s.lat>=gb.minLat-_gs*0.5&&s.lat<=gb.maxLat+_gs*0.5&&
                   s.lng1>=gb.minLng-_gs*0.5&&s.lng2<=gb.maxLng+_gs*0.5;
          });
          // Fill with strips (pixel-accurate, matches border exactly).
          // Pad by 0.75px so adjacent strips overlap — eliminates subpixel gap lines.
          // isMine: 골드 오버레이, 나머지는 지갑 해시 색상
          var tc=territoryTone.fill;
          var _tAlpha=territoryTone.alpha;
          ctx.fillStyle='rgba('+tc.r+','+tc.g+','+tc.b+','+_tAlpha+')';
          var fbx1=Infinity,fby1=Infinity,fbx2=-Infinity,fby2=-Infinity;
          for(var fi=0;fi<gStrips.length;fi++){
            var fr=_sRect(gStrips[fi]);
            ctx.fillRect(fr.x-0.75,fr.y-0.75,fr.w+1.5,fr.h+1.5);
            if(fr.x<fbx1)fbx1=fr.x;if(fr.y<fby1)fby1=fr.y;
            if(fr.x+fr.w>fbx2)fbx2=fr.x+fr.w;if(fr.y+fr.h>fby2)fby2=fr.y+fr.h;
          }
          // Label centered in bounding box (with drop shadow for tactical readability)
          var fbw=fbx2-fbx1, fbh=fby2-fby1;
          if(fbw>20&&fbh>12){
            ctx.save();
            ctx.beginPath();
            for(var fci=0;fci<gStrips.length;fci++){var fcr=_sRect(gStrips[fci]);ctx.rect(fcr.x,fcr.y,fcr.w,fcr.h);}
            ctx.clip();
            var lfs=Math.max(5,Math.min(fbw*0.15,fbh*0.28,12));
            ctx.font='bold '+lfs+'px sans-serif';
            ctx.textAlign='center';ctx.textBaseline='middle';
            var lbl=displayLabel;
            while(ctx.measureText(lbl).width>fbw-4&&lbl.length>3) lbl=lbl.slice(0,-1);
            // Dark outline for contrast
            ctx.lineWidth=Math.max(2,lfs*0.28);
            ctx.strokeStyle='rgba(8,4,2,0.85)';
            ctx.lineJoin='round';
            ctx.strokeText(lbl,fbx1+fbw/2,fby1+fbh/2);
            // Fill on top — isMine는 골드 텍스트
            ctx.fillStyle=territoryTone.text;
            ctx.fillText(lbl,fbx1+fbw/2,fby1+fbh/2);
            ctx.restore();
          }
          var bc3=territoryTone.line;
          if(territoryTone.dash) ctx.setLineDash(territoryTone.dash); else ctx.setLineDash([]);
          ctx.lineCap='square';
          ctx.beginPath();
          for(var si=0;si<gStrips.length;si++){
            var ss=gStrips[si], sr=_sRect(ss);
            var lk=Math.round(ss.lat*100);
            ctx.moveTo(sr.x,sr.y);ctx.lineTo(sr.x,sr.y+sr.h);
            ctx.moveTo(sr.x+sr.w,sr.y);ctx.lineTo(sr.x+sr.w,sr.y+sr.h);
            var adj=byLat[lk+gsKey]||[];
            var covX=[];for(var ai=0;ai<adj.length;ai++){var ar=_sRect(adj[ai]);var o1=Math.max(sr.x,ar.x),o2=Math.min(sr.x+sr.w,ar.x+ar.w);if(o2>o1)covX.push([o1,o2]);}
            covX.sort(function(a,b){return a[0]-b[0]});var pos=sr.x;
            for(var ci=0;ci<covX.length;ci++){if(covX[ci][0]>pos+0.5){ctx.moveTo(pos,sr.y);ctx.lineTo(covX[ci][0],sr.y);}pos=covX[ci][1];}
            if(pos<sr.x+sr.w-0.5){ctx.moveTo(pos,sr.y);ctx.lineTo(sr.x+sr.w,sr.y);}
            var adj2=byLat[lk-gsKey]||[];
            var covX2=[];for(var ai2=0;ai2<adj2.length;ai2++){var ar2=_sRect(adj2[ai2]);var o12=Math.max(sr.x,ar2.x),o22=Math.min(sr.x+sr.w,ar2.x+ar2.w);if(o22>o12)covX2.push([o12,o22]);}
            covX2.sort(function(a,b){return a[0]-b[0]});var pos2=sr.x, yb=sr.y+sr.h;
            for(var ci2=0;ci2<covX2.length;ci2++){if(covX2[ci2][0]>pos2+0.5){ctx.moveTo(pos2,yb);ctx.lineTo(covX2[ci2][0],yb);}pos2=covX2[ci2][1];}
            if(pos2<sr.x+sr.w-0.5){ctx.moveTo(pos2,yb);ctx.lineTo(sr.x+sr.w,yb);}
          }
          // Pass 1: Wide atmospheric halo
          if(isMine){ctx.shadowColor='rgba(255,209,102,0.45)';ctx.shadowBlur=4;}
          ctx.strokeStyle='rgba('+bc3.r+','+bc3.g+','+bc3.b+','+territoryTone.halo+')';
          ctx.lineWidth=isMine?2:2;
          ctx.stroke();
          if(isMine) ctx.shadowBlur=0;
          // Pass 2: Crisp tactical inner line
          ctx.strokeStyle='rgba('+bc3.r+','+bc3.g+','+bc3.b+','+(isMine?'1':'0.9')+')';
          ctx.lineWidth=isMine?0.8:0.8;
          ctx.stroke();
          ctx.lineCap='butt';ctx.setLineDash([]);
        }
        _sRectOx=0; // reset wrap offset
        }); // end _grpWrapOffsets.forEach
      });
      ctx.restore();

      // ═══ COSMETIC EFFECTS (overhaul — group-based, strips outline) ═══
      var _ct=Date.now();
      var _cosLite=(w<=2048); // lighter effects on smaller textures (mobile)
      ownerGroups.forEach(function(grp){
        var groupClaims=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
        var cos=null, _cosOwner=null;
        for(var gi=0;gi<groupClaims.length;gi++){
          if(!_cosOwner) _cosOwner=groupClaims[gi].owner;
          if(groupClaims[gi].cosmetics){cos=groupClaims[gi].cosmetics;break;}
        }
        if(!cos) return;
        if(!_cosOwner && groupClaims.length) _cosOwner=groupClaims[0].owner;
        var gb2i=grp.bounds;
        var gStrips=(strips||[]).filter(function(s){
          return s.lat>=gb2i.minLat-_gs*0.5&&s.lat<=gb2i.maxLat+_gs*0.5&&
                 s.lng1>=gb2i.minLng-_gs*0.5&&s.lng2<=gb2i.maxLng+_gs*0.5;
        });
        if(!gStrips.length) return;
        // Bounding box for particle seeding
        var _cbx1=Infinity,_cby1=Infinity,_cbx2=-Infinity,_cby2=-Infinity;
        // _cosClip: fills path with individual rects (good for fill/clip, NOT for stroke)
        function _cosClip(){
          ctx.beginPath();
          for(var si=0;si<gStrips.length;si++){
            var sr=_sRect(gStrips[si]);
            ctx.rect(sr.x,sr.y,sr.w,sr.h);
            if(sr.x<_cbx1)_cbx1=sr.x;if(sr.y<_cby1)_cby1=sr.y;
            if(sr.x+sr.w>_cbx2)_cbx2=sr.x+sr.w;if(sr.y+sr.h>_cby2)_cby2=sr.y+sr.h;
          }
        }
        // _cosOutline: builds path with ONLY outer edges (for stroke — no internal strip lines)
        // Cached: compute edge segments once, replay for each stroke layer
        var _outlineSegs=null;
        function _computeOutlineSegs(){
          if(_outlineSegs) return;
          _outlineSegs=[];
          var byLat=_stripsByOwnerLat[_cosOwner]||{};
          var gsKey=byLat._latStep||Math.round(_gs*100);
          for(var si=0;si<gStrips.length;si++){
            var ss=gStrips[si], sr=_sRect(ss);
            var lk=Math.round(ss.lat*100);
            _outlineSegs.push(sr.x,sr.y,sr.x,sr.y+sr.h);
            _outlineSegs.push(sr.x+sr.w,sr.y,sr.x+sr.w,sr.y+sr.h);
            var adj=byLat[lk+gsKey]||[];
            var covX=[];for(var ai=0;ai<adj.length;ai++){var ar=_sRect(adj[ai]);var o1=Math.max(sr.x,ar.x),o2=Math.min(sr.x+sr.w,ar.x+ar.w);if(o2>o1)covX.push([o1,o2]);}
            covX.sort(function(a,b){return a[0]-b[0]});var pos=sr.x;
            for(var ci=0;ci<covX.length;ci++){if(covX[ci][0]>pos+0.5){_outlineSegs.push(pos,sr.y,covX[ci][0],sr.y);}pos=covX[ci][1];}
            if(pos<sr.x+sr.w-0.5){_outlineSegs.push(pos,sr.y,sr.x+sr.w,sr.y);}
            var adj2=byLat[lk-gsKey]||[];
            var covX2=[];for(var ai2=0;ai2<adj2.length;ai2++){var ar2=_sRect(adj2[ai2]);var o12=Math.max(sr.x,ar2.x),o22=Math.min(sr.x+sr.w,ar2.x+ar2.w);if(o22>o12)covX2.push([o12,o22]);}
            covX2.sort(function(a,b){return a[0]-b[0]});var pos2=sr.x, yb=sr.y+sr.h;
            for(var ci2=0;ci2<covX2.length;ci2++){if(covX2[ci2][0]>pos2+0.5){_outlineSegs.push(pos2,yb,covX2[ci2][0],yb);}pos2=covX2[ci2][1];}
            if(pos2<sr.x+sr.w-0.5){_outlineSegs.push(pos2,yb,sr.x+sr.w,yb);}
          }
        }
        function _cosOutline(){
          _computeOutlineSegs();
          ctx.beginPath();
          for(var i=0;i<_outlineSegs.length;i+=4){
            ctx.moveTo(_outlineSegs[i],_outlineSegs[i+1]);
            ctx.lineTo(_outlineSegs[i+2],_outlineSegs[i+3]);
          }
        }
        _cosClip(); // compute bbox

        // ── TERRAIN: animated texture patterns ──
        if(cos.terrain){
          ctx.save();
          _cosClip();ctx.clip();
          var tw=_cbx2-_cbx1, th=_cby2-_cby1;
          if(cos.terrain==='volcanic_terrain'){
            // Lava cracks + ember particles
            ctx.fillStyle='rgba(255,60,10,0.12)';ctx.fill();
            // Lava cracks
            ctx.strokeStyle='rgba(255,120,20,0.4)';ctx.lineWidth=1.2;ctx.shadowColor='#FF4400';ctx.shadowBlur=4;
            var _seed=grp.claimIndices[0]||0;
            for(var vi=0;vi<8;vi++){
              var vx=_cbx1+(((_seed*137+vi*97)%100)/100)*tw;
              var vy=_cby1+(((_seed*241+vi*53)%100)/100)*th;
              ctx.beginPath();ctx.moveTo(vx,vy);
              for(var vj=0;vj<3;vj++){
                vx+=(((_seed*31+vi*17+vj*71)%60)-30);
                vy+=(((_seed*43+vi*23+vj*37)%40)-10);
                ctx.lineTo(vx,vy);
              }
              ctx.stroke();
            }
            // Ember dots
            ctx.shadowBlur=6;ctx.shadowColor='#FF6600';
            for(var ei=0;ei<12;ei++){
              var ex=_cbx1+(((_seed*73+ei*131+Math.floor(_ct/800))%100)/100)*tw;
              var ey=_cby1+(((_seed*89+ei*167+Math.floor(_ct/1200))%100)/100)*th;
              var eAlpha=0.3+0.4*Math.sin(_ct/300+ei*1.7);
              ctx.globalAlpha=eAlpha;ctx.fillStyle='#FFAA22';
              ctx.beginPath();ctx.arc(ex,ey,1.5+Math.sin(_ct/400+ei)*0.8,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.terrain==='frozen_terrain'){
            // Ice crystals + frost shimmer
            ctx.fillStyle='rgba(80,160,255,0.1)';ctx.fill();
            ctx.strokeStyle='rgba(180,220,255,0.35)';ctx.lineWidth=0.8;ctx.shadowColor='#88DDFF';ctx.shadowBlur=3;
            var _seed2=grp.claimIndices[0]||0;
            for(var fi=0;fi<10;fi++){
              var fx=_cbx1+(((_seed2*97+fi*127)%100)/100)*tw;
              var fy=_cby1+(((_seed2*151+fi*83)%100)/100)*th;
              // 6-point snowflake
              ctx.beginPath();
              for(var fa=0;fa<6;fa++){
                var ang=fa*Math.PI/3;var fl=3+(((_seed2+fi*37)%5));
                ctx.moveTo(fx,fy);ctx.lineTo(fx+Math.cos(ang)*fl,fy+Math.sin(ang)*fl);
              }
              ctx.stroke();
            }
            // Shimmer particles
            ctx.shadowBlur=5;ctx.shadowColor='#AAEEFF';
            for(var si2=0;si2<8;si2++){
              var sx=_cbx1+(((_seed2*67+si2*113+Math.floor(_ct/1500))%100)/100)*tw;
              var sy=_cby1+(((_seed2*83+si2*149+Math.floor(_ct/2000))%100)/100)*th;
              ctx.globalAlpha=0.2+0.5*Math.abs(Math.sin(_ct/500+si2*2.3));
              ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(sx,sy,1.2,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.terrain==='crystal_terrain'){
            // Crystal shards + prismatic sparkles
            ctx.fillStyle='rgba(160,80,255,0.08)';ctx.fill();
            var _seed3=grp.claimIndices[0]||0;
            for(var ci2=0;ci2<7;ci2++){
              var cx=_cbx1+(((_seed3*109+ci2*139)%100)/100)*tw;
              var cy=_cby1+(((_seed3*173+ci2*89)%100)/100)*th;
              var cSize=2+(((_seed3+ci2*41)%4));
              var cHue=((_ct/20+ci2*60)%360);
              ctx.fillStyle='hsla('+cHue+',80%,70%,0.35)';
              ctx.shadowColor='hsl('+cHue+',100%,60%)';ctx.shadowBlur=6;
              ctx.beginPath();
              ctx.moveTo(cx,cy-cSize);ctx.lineTo(cx+cSize*0.6,cy);ctx.lineTo(cx,cy+cSize*0.4);ctx.lineTo(cx-cSize*0.6,cy);
              ctx.closePath();ctx.fill();
            }
            // Prismatic sparkles
            for(var pi=0;pi<10;pi++){
              var px=_cbx1+(((_seed3*47+pi*179+Math.floor(_ct/600))%100)/100)*tw;
              var py=_cby1+(((_seed3*61+pi*131+Math.floor(_ct/900))%100)/100)*th;
              var pHue=((_ct/10+pi*36)%360);
              ctx.globalAlpha=0.3+0.5*Math.abs(Math.sin(_ct/250+pi*1.9));
              ctx.fillStyle='hsl('+pHue+',100%,75%)';ctx.shadowColor='hsl('+pHue+',100%,60%)';ctx.shadowBlur=4;
              ctx.beginPath();ctx.arc(px,py,1,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.terrain==='toxic_terrain'){
            // Toxic bubbles + green haze
            ctx.fillStyle='rgba(60,255,60,0.08)';ctx.fill();
            var _seed4=grp.claimIndices[0]||0;
            ctx.strokeStyle='rgba(80,255,80,0.25)';ctx.lineWidth=0.8;ctx.shadowColor='#44FF44';ctx.shadowBlur=4;
            for(var ti=0;ti<10;ti++){
              var tx2=_cbx1+(((_seed4*83+ti*151)%100)/100)*tw;
              var ty=_cby1+(((_seed4*127+ti*97+Math.floor(_ct/1000)*3)%100)/100)*th;
              var tRad=1.5+Math.sin(_ct/400+ti*1.3)*1;
              ctx.globalAlpha=0.2+0.4*Math.abs(Math.sin(_ct/350+ti*2.1));
              ctx.beginPath();ctx.arc(tx2,ty,tRad,0,Math.PI*2);ctx.stroke();
              ctx.fillStyle='rgba(80,255,80,0.15)';ctx.fill();
            }
            // Rising toxic mist dots
            for(var mi=0;mi<6;mi++){
              var mx=_cbx1+(((_seed4*59+mi*173)%100)/100)*tw;
              var myBase=_cby2-(((_ct/800+mi*1.7)%1))*th;
              ctx.globalAlpha=0.15+0.2*Math.sin(_ct/600+mi);
              ctx.fillStyle='rgba(100,255,80,0.3)';ctx.shadowBlur=8;
              ctx.beginPath();ctx.arc(mx,myBase,3+Math.sin(_ct/500+mi)*1.5,0,Math.PI*2);ctx.fill();
            }
          }
          ctx.restore();
        }

        // ── BORDER: multi-layer glow + animated effects ──
        if(cos.border){
          // Layer 1: Wide outer glow (skip on mobile for perf)
          ctx.save();
          if(cos.border==='neon_border'){
            if(!_cosLite){ctx.strokeStyle='rgba(0,255,255,0.15)';ctx.shadowColor='#00FFFF';ctx.shadowBlur=18;ctx.lineWidth=6;
            _cosOutline();ctx.stroke();}
            // Layer 2: Bright inner
            ctx.strokeStyle='rgba(0,255,255,0.5)';ctx.shadowColor='#00FFFF';ctx.shadowBlur=_cosLite?6:10;ctx.lineWidth=2.5;
            _cosOutline();ctx.stroke();
            // Layer 3: White core
            ctx.strokeStyle='rgba(200,255,255,0.8)';ctx.shadowBlur=4;ctx.lineWidth=1;
            _cosOutline();ctx.stroke();
            // Sparkle particles along border
            ctx.shadowBlur=6;ctx.shadowColor='#00FFFF';
            for(var ni=0;ni<15;ni++){
              var nPhase=(_ct/600+ni*0.42)%(Math.PI*2);
              var nIdx=Math.floor((ni/15)*gStrips.length);
              if(nIdx>=gStrips.length)nIdx=gStrips.length-1;
              var nsr=_sRect(gStrips[nIdx]);
              var nx=nsr.x+Math.abs(Math.sin(nPhase))*nsr.w;
              var ny=nsr.y+(ni%2===0?0:nsr.h);
              ctx.globalAlpha=0.4+0.6*Math.abs(Math.sin(_ct/200+ni*1.3));
              ctx.fillStyle='#AAFFFF';ctx.beginPath();ctx.arc(nx,ny,1.5,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.border==='flame_border'){
            // Fire glow
            if(!_cosLite){ctx.strokeStyle='rgba(255,80,0,0.12)';ctx.shadowColor='#FF4400';ctx.shadowBlur=20;ctx.lineWidth=8;
            _cosOutline();ctx.stroke();}
            ctx.strokeStyle='rgba(255,120,20,0.5)';ctx.shadowColor='#FF4400';ctx.shadowBlur=_cosLite?6:10;ctx.lineWidth=2.5;
            _cosOutline();ctx.stroke();
            ctx.strokeStyle='rgba(255,200,60,0.7)';ctx.shadowBlur=3;ctx.lineWidth=1;
            _cosOutline();ctx.stroke();
            // Fire particles rising from border
            ctx.shadowBlur=5;ctx.shadowColor='#FF6600';
            for(var ffi=0;ffi<20;ffi++){
              var ffIdx=Math.floor((ffi/20)*gStrips.length);
              if(ffIdx>=gStrips.length)ffIdx=gStrips.length-1;
              var fsr=_sRect(gStrips[ffIdx]);
              var ffx=fsr.x+((ffi*37+Math.floor(_ct/300))%Math.max(1,Math.floor(fsr.w)));
              var ffy=fsr.y-(((_ct/400+ffi*0.8)%8));
              var ffAlpha=0.6-(((_ct/400+ffi*0.8)%8))/8;
              if(ffAlpha<0)ffAlpha=0;
              ctx.globalAlpha=ffAlpha;
              var ffHue=20+Math.sin(_ct/200+ffi)*15;
              ctx.fillStyle='hsl('+ffHue+',100%,'+Math.floor(50+ffAlpha*30)+'%)';
              ctx.beginPath();ctx.arc(ffx,ffy,1+ffAlpha*1.5,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.border==='ice_border'){
            if(!_cosLite){ctx.strokeStyle='rgba(100,180,255,0.12)';ctx.shadowColor='#88CCFF';ctx.shadowBlur=16;ctx.lineWidth=6;
            _cosOutline();ctx.stroke();}
            ctx.strokeStyle='rgba(150,210,255,0.5)';ctx.shadowColor='#88CCFF';ctx.shadowBlur=_cosLite?5:8;ctx.lineWidth=2;
            _cosOutline();ctx.stroke();
            ctx.strokeStyle='rgba(220,240,255,0.8)';ctx.shadowBlur=3;ctx.lineWidth=1;
            _cosOutline();ctx.stroke();
            // Frost sparkles
            ctx.shadowBlur=4;ctx.shadowColor='#CCEFFF';
            for(var ici=0;ici<12;ici++){
              var icIdx=Math.floor((ici/12)*gStrips.length);
              if(icIdx>=gStrips.length)icIdx=gStrips.length-1;
              var icsr=_sRect(gStrips[icIdx]);
              var icx=icsr.x+Math.abs(Math.sin(_ct/1200+ici*0.8))*icsr.w;
              var icy=icsr.y+((ici%2)?icsr.h:0);
              ctx.globalAlpha=0.3+0.7*Math.abs(Math.sin(_ct/400+ici*1.7));
              ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(icx,icy,1.2,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.border==='gold_border'){
            if(!_cosLite){ctx.strokeStyle='rgba(255,200,0,0.1)';ctx.shadowColor='#FFD700';ctx.shadowBlur=24;ctx.lineWidth=8;
            _cosOutline();ctx.stroke();}
            ctx.strokeStyle='rgba(255,215,0,0.5)';ctx.shadowColor='#FFD700';ctx.shadowBlur=_cosLite?6:12;ctx.lineWidth=3;
            _cosOutline();ctx.stroke();
            ctx.strokeStyle='rgba(255,240,150,0.85)';ctx.shadowBlur=4;ctx.lineWidth=1.2;
            _cosOutline();ctx.stroke();
            // Gold shimmer particles
            ctx.shadowBlur=6;ctx.shadowColor='#FFD700';
            for(var goi=0;goi<18;goi++){
              var goIdx=Math.floor((goi/18)*gStrips.length);
              if(goIdx>=gStrips.length)goIdx=gStrips.length-1;
              var gosr=_sRect(gStrips[goIdx]);
              var gox=gosr.x+Math.abs(Math.sin(_ct/700+goi*0.55))*gosr.w;
              var goy=gosr.y+((goi%3===0)?0:(goi%3===1)?gosr.h:gosr.h*0.5);
              ctx.globalAlpha=0.3+0.7*Math.abs(Math.sin(_ct/300+goi*1.1));
              ctx.fillStyle='#FFEE88';ctx.beginPath();ctx.arc(gox,goy,1.3,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.border==='starship_border'){
            if(!_cosLite){ctx.strokeStyle='rgba(255,60,0,0.1)';ctx.shadowColor='#FF4400';ctx.shadowBlur=20;ctx.lineWidth=7;
            _cosOutline();ctx.stroke();}
            ctx.strokeStyle='rgba(255,80,20,0.45)';ctx.shadowColor='#FF4400';ctx.shadowBlur=_cosLite?5:8;ctx.lineWidth=2.5;ctx.setLineDash([6,3]);
            _cosOutline();ctx.stroke();ctx.setLineDash([]);
            ctx.strokeStyle='rgba(255,160,60,0.7)';ctx.shadowBlur=3;ctx.lineWidth=1;
            _cosOutline();ctx.stroke();
            // Re-entry spark trail
            ctx.shadowBlur=8;ctx.shadowColor='#FF6600';
            for(var sti=0;sti<14;sti++){
              var stIdx=Math.floor(((_ct/100+sti*3)%(gStrips.length)));
              var stsr=_sRect(gStrips[stIdx]);
              ctx.globalAlpha=0.5+0.5*Math.abs(Math.sin(_ct/150+sti*2));
              ctx.fillStyle='#FFAA44';ctx.beginPath();ctx.arc(stsr.x+stsr.w*0.5,stsr.y,1.5,0,Math.PI*2);ctx.fill();
            }
          }
          ctx.restore();
        }

        // ── GLOW: strong territory-wide aura ──
        if(cos.glow){
          ctx.save();
          if(cos.glow==='pulse_glow'){
            var pVal=Math.sin(_ct/400);
            // Outer aura
            ctx.globalAlpha=0.08+0.06*pVal;
            ctx.shadowBlur=20+pVal*8;ctx.shadowColor=_ownerColor(_cosOwner);
            ctx.fillStyle=_ownerColor(_cosOwner);
            _cosClip();ctx.fill();
            // Border pulse
            ctx.globalAlpha=0.3+0.2*pVal;
            ctx.strokeStyle=_ownerColor(_cosOwner);ctx.lineWidth=3+pVal*1.5;
            ctx.shadowBlur=14+pVal*6;
            _cosOutline();ctx.stroke();
          }else if(cos.glow==='rainbow_glow'){
            var rHue=(_ct/12)%360;
            // Rainbow fill aura
            ctx.globalAlpha=0.08;
            ctx.fillStyle='hsl('+rHue+',100%,60%)';ctx.shadowColor='hsl('+rHue+',100%,50%)';ctx.shadowBlur=20;
            _cosClip();ctx.fill();
            // Multi-hue border layers
            for(var ri=0;ri<3;ri++){
              var rH2=(rHue+ri*40)%360;
              ctx.globalAlpha=0.25-ri*0.06;
              ctx.strokeStyle='hsl('+rH2+',100%,65%)';ctx.shadowColor='hsl('+rH2+',100%,50%)';
              ctx.shadowBlur=12-ri*3;ctx.lineWidth=3-ri*0.8;
              _cosOutline();ctx.stroke();
            }
            // Rainbow sparkles inside
            for(var rsi=0;rsi<8;rsi++){
              var rsH=(rHue+rsi*45)%360;
              var rsx=_cbx1+(((rsi*137+Math.floor(_ct/500))%100)/100)*(_cbx2-_cbx1);
              var rsy=_cby1+(((rsi*97+Math.floor(_ct/700))%100)/100)*(_cby2-_cby1);
              ctx.globalAlpha=0.3+0.5*Math.abs(Math.sin(_ct/250+rsi*1.5));
              ctx.fillStyle='hsl('+rsH+',100%,75%)';ctx.shadowColor='hsl('+rsH+',100%,60%)';ctx.shadowBlur=5;
              ctx.beginPath();ctx.arc(rsx,rsy,1.2,0,Math.PI*2);ctx.fill();
            }
          }else if(cos.glow==='dark_aura'){
            var dPulse=Math.sin(_ct/600);
            // Dark inner shadow
            ctx.globalAlpha=0.12+0.04*dPulse;
            ctx.fillStyle='rgba(40,0,60,0.5)';ctx.shadowColor='rgba(100,0,160,0.8)';ctx.shadowBlur=22;
            _cosClip();ctx.fill();
            // Purple border
            ctx.globalAlpha=0.35+0.15*dPulse;
            ctx.strokeStyle='rgba(140,0,220,0.6)';ctx.shadowBlur=16;ctx.lineWidth=3;
            _cosOutline();ctx.stroke();
            ctx.strokeStyle='rgba(180,80,255,0.4)';ctx.shadowBlur=6;ctx.lineWidth=1;
            _cosOutline();ctx.stroke();
            // Dark mist particles
            for(var di=0;di<8;di++){
              var dx=_cbx1+(((di*131+Math.floor(_ct/900))%100)/100)*(_cbx2-_cbx1);
              var dy=_cby1+(((di*97+Math.floor(_ct/1100))%100)/100)*(_cby2-_cby1);
              ctx.globalAlpha=0.15+0.2*Math.abs(Math.sin(_ct/500+di*1.8));
              ctx.fillStyle='rgba(120,0,200,0.4)';ctx.shadowColor='rgba(80,0,140,0.6)';ctx.shadowBlur=8;
              ctx.beginPath();ctx.arc(dx,dy,2+Math.sin(_ct/400+di)*1,0,Math.PI*2);ctx.fill();
            }
          }
          ctx.restore();
        }
      });

      // ═══ INFAMY TIER SYSTEM (replaces the old skull + red-glow) ═══
      // Four escalating tiers based on hijackCount. Each tier stacks its own
      // marker icon + glow color. Higher tiers get stronger pulsing auras.
      //
      //  Tier 1  (  10+ hijacks): 🎯  BOUNTY       — gold marker, no aura
      //  Tier 2  (  50+ hijacks): ⚔   WARBLADE     — amber marker, subtle glow
      //  Tier 3  ( 100+ hijacks): 🔥  MARS RAGE    — orange glow
      //  Tier 4  ( 250+ hijacks): ☢   RADIOACTIVE  — red pulsing hazard aura
      var ownerHijackCount=0;
      sortedClaims.forEach(function(sc){ if(sc.owner===c.owner && sc.hijackCount) ownerHijackCount=Math.max(ownerHijackCount,sc.hijackCount); });
      var _infTier = ownerHijackCount>=250 ? 4
                   : ownerHijackCount>=100 ? 3
                   : ownerHijackCount>=50  ? 2
                   : ownerHijackCount>=10  ? 1 : 0;
      // Tier config (color, aura alpha, icon, glow blur)
      var _infTierCfg = [
        null,
        { icon:'🎯', marker:'#FFD166', aura:null,       pulseMs:0    }, // Tier 1: icon only
        { icon:'⚔',  marker:'#FFB045', aura:'255,160,60',pulseMs:1400}, // Tier 2: bronze glow
        { icon:'🔥', marker:'#FF6B2C', aura:'255,90,20', pulseMs:1000}, // Tier 3: orange rage
        { icon:'☢',  marker:'#FF2E2E', aura:'255,20,20', pulseMs:700 }  // Tier 4: radioactive red
      ];
      var _infCfg = _infTierCfg[_infTier];
      // Strip-based aura outline for Tier 2+ (skips interior lines — avoids
      // the old per-claim strokeRect "ghost box" bug inside large territories)
      if(_infCfg && _infCfg.aura){
        var _infStrips=_ownerStrips[c.owner];
        if(_infStrips&&_infStrips.length){
          var _infByLat=_stripsByOwnerLat[c.owner]||{};
          var _infGsKey=_infByLat._latStep||Math.round(_gs*100);
          var _infPulse = 0.22 + Math.sin(Date.now()/_infCfg.pulseMs)*0.12;
          ctx.save();
          ctx.globalAlpha = _infPulse + (_infTier>=4 ? 0.12 : 0);
          ctx.strokeStyle = 'rgba('+_infCfg.aura+',0.9)';
          ctx.shadowColor = 'rgba('+_infCfg.aura+',0.55)';
          ctx.shadowBlur  = _infTier>=4 ? 14 : (_infTier>=3 ? 11 : 8);
          ctx.lineWidth   = _infTier>=4 ? 2.5 : 2;
          ctx.setLineDash(_infTier>=4 ? [] : []);
          ctx.beginPath();
          for(var _isi=0;_isi<_infStrips.length;_isi++){
            var _iss=_infStrips[_isi], _isr=_sRect(_iss);
            var _ilk=Math.round(_iss.lat*100);
            ctx.moveTo(_isr.x,_isr.y);ctx.lineTo(_isr.x,_isr.y+_isr.h);
            ctx.moveTo(_isr.x+_isr.w,_isr.y);ctx.lineTo(_isr.x+_isr.w,_isr.y+_isr.h);
            var _iadj=_infByLat[_ilk+_infGsKey]||[];
            var _icovX=[];
            for(var _iai=0;_iai<_iadj.length;_iai++){
              var _iar=_sRect(_iadj[_iai]);
              var _io1=Math.max(_isr.x,_iar.x),_io2=Math.min(_isr.x+_isr.w,_iar.x+_iar.w);
              if(_io2>_io1)_icovX.push([_io1,_io2]);
            }
            _icovX.sort(function(a,b){return a[0]-b[0]});
            var _ipos=_isr.x;
            for(var _ici=0;_ici<_icovX.length;_ici++){
              if(_icovX[_ici][0]>_ipos+0.5){ctx.moveTo(_ipos,_isr.y);ctx.lineTo(_icovX[_ici][0],_isr.y);}
              _ipos=_icovX[_ici][1];
            }
            if(_ipos<_isr.x+_isr.w-0.5){ctx.moveTo(_ipos,_isr.y);ctx.lineTo(_isr.x+_isr.w,_isr.y);}
            var _iadj2=_infByLat[_ilk-_infGsKey]||[];
            var _icovX2=[];
            for(var _iai2=0;_iai2<_iadj2.length;_iai2++){
              var _iar2=_sRect(_iadj2[_iai2]);
              var _io12=Math.max(_isr.x,_iar2.x),_io22=Math.min(_isr.x+_isr.w,_iar2.x+_iar2.w);
              if(_io22>_io12)_icovX2.push([_io12,_io22]);
            }
            _icovX2.sort(function(a,b){return a[0]-b[0]});
            var _ipos2=_isr.x, _iyb=_isr.y+_isr.h;
            for(var _ici2=0;_ici2<_icovX2.length;_ici2++){
              if(_icovX2[_ici2][0]>_ipos2+0.5){ctx.moveTo(_ipos2,_iyb);ctx.lineTo(_icovX2[_ici2][0],_iyb);}
              _ipos2=_icovX2[_ici2][1];
            }
            if(_ipos2<_isr.x+_isr.w-0.5){ctx.moveTo(_ipos2,_iyb);ctx.lineTo(_isr.x+_isr.w,_iyb);}
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      // Tier icon badge on the anchor claim (all tiers 1-4)
      if(_infCfg){
        var fc=sortedClaims.find(function(sc){return sc.owner===c.owner});
        if(fc){
          var sr=getCellRect(fc.lat,fc.lng,fc.w||20,fc.h||20,w,h);
          var skSz=Math.min(sr.w,sr.h)*0.3;
          if(skSz>=4){
            ctx.save();
            ctx.font='bold '+skSz+'px sans-serif';
            ctx.textAlign='right';ctx.textBaseline='top';
            ctx.globalAlpha=0.85;
            // Dark plate behind icon for legibility
            ctx.shadowColor='rgba(0,0,0,0.9)';
            ctx.shadowBlur=5;
            ctx.fillText(_infCfg.icon, sr.x+sr.w-1, sr.y+1);
            // Tier 3+: colored outer glow on the icon itself
            if(_infTier>=3){
              ctx.shadowColor=_infCfg.marker;
              ctx.shadowBlur=10;
              ctx.fillText(_infCfg.icon, sr.x+sr.w-1, sr.y+1);
            }
            ctx.restore();
          }
        }
      }

      // Shield effects — per merged territory group, not per claim
      var shieldType=null;
      var shieldedInGroup=ownerGroups.some(function(grp){
        var gc=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
        return gc.some(function(sc){return sc.shield&&sc.shield.expires>Date.now()});
      });
      if(shieldedInGroup){
        ownerGroups.forEach(function(grp){
          var gc=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
          var hasShield=gc.some(function(sc){return sc.shield&&sc.shield.expires>Date.now()});
          if(!hasShield) return;
          var sType=null;
          gc.forEach(function(sc){if(sc.shield&&sc.shield.expires>Date.now()&&!sType)sType=sc.shield.type;});
          // Collect strips for this group
          var gb=grp.bounds;
          var gStrips=(strips||[]).filter(function(s){
            return s.lat>=gb.minLat-_gs*0.5&&s.lat<=gb.maxLat+_gs*0.5&&
                   s.lng1>=gb.minLng-_gs*0.5&&s.lng2<=gb.maxLng+_gs*0.5;
          });
          var sbx1=Infinity,sby1=Infinity,sbx2=-Infinity,sby2=-Infinity;
          for(var ssi=0;ssi<gStrips.length;ssi++){
            var ssr=_sRect(gStrips[ssi]);
            if(ssr.x<sbx1)sbx1=ssr.x;if(ssr.y<sby1)sby1=ssr.y;
            if(ssr.x+ssr.w>sbx2)sbx2=ssr.x+ssr.w;if(ssr.y+ssr.h>sby2)sby2=ssr.y+ssr.h;
          }
          _drawShieldGroup(ctx,gStrips,sbx1,sby1,sbx2,sby2,sType);
        });
      }
    });

    // Governor glow effect: gold border around governor/commander territories
    if(typeof _govWalletRoles!=='undefined'){
      var _govPulse=Math.sin(Date.now()/1200)*0.1+0.9;
      var _processedGovOwners={};
      sortedClaims.forEach(function(c){
        if(_processedGovOwners[c.owner]) return;
        var roles=_govWalletRoles[c.owner]||[];
        if(!roles.length) return;
        _processedGovOwners[c.owner]=true;
        var isCmd=roles.indexOf('commander')>=0;
        var strips=_ownerStrips[c.owner];
        if(!strips||!strips.length) return;
        // Draw glow border on outer edges of territory
        ctx.save();
        ctx.globalAlpha=_govPulse*(isCmd?0.7:0.5);
        ctx.strokeStyle=isCmd?'rgba(255,209,102,0.9)':'rgba(91,184,232,0.7)';
        ctx.lineWidth=isCmd?3:2;
        ctx.shadowColor=isCmd?'rgba(255,209,102,0.6)':'rgba(91,184,232,0.4)';
        ctx.shadowBlur=isCmd?10:6;
        ctx.setLineDash([]);
        ctx.beginPath();
        for(var si=0;si<strips.length;si++){
          var sr=_sRect(strips[si]);
          ctx.rect(sr.x,sr.y,sr.w,sr.h);
        }
        ctx.stroke();
        ctx.restore();
      });
    }

    // FOR SALE / AUCTION territory overlay
    if(typeof _drawForSaleOverlay==='function') _drawForSaleOverlay(ctx,w,h);

    // Sector boundaries overlay
    _drawSectorOverlay(ctx,w,h);

    // Weather overlay
    if(typeof _drawWeatherOverlay==='function') _drawWeatherOverlay(ctx,w,h);
    if(typeof _drawPOIMarkers==='function') _drawPOIMarkers(ctx,w,h);
    if(typeof _drawMissionRoutes==='function') _drawMissionRoutes(ctx,w,h);
    if(typeof _drawMissionPreview==='function') _drawMissionPreview(ctx,w,h);
    if(typeof _drawRocketOverlay==='function') _drawRocketOverlay(ctx,w,h);
    if(typeof _drawStarlinkTrails==='function') _drawStarlinkTrails(ctx,w,h);

    // Selection highlight: yellow dashed border on selected group's territory (strip-based)
    if(selectedPlot&&selectedPlot.owner){
      var _selOwner=selectedPlot.owner;
      // Filter strips for the selected group's bounding box
      var _allSelStrips=_ownerStrips[_selOwner]||[];
      var _selBounds=selectedPlot._bounds;
      var _selStrips;
      if(_selBounds){
        _selStrips=_allSelStrips.filter(function(s){
          return s.lat>=_selBounds.minLat-_gs*0.5&&s.lat<=_selBounds.maxLat+_gs*0.5&&
                 s.lng1>=_selBounds.minLng-_gs*0.5&&s.lng2<=_selBounds.maxLng+_gs*0.5;
        });
      }else{
        _selStrips=_allSelStrips;
      }
      if(_selStrips&&_selStrips.length){
        var _selByLat={};
        _selStrips.forEach(function(s){var lk=Math.round(s.lat*100);if(!_selByLat[lk])_selByLat[lk]=[];_selByLat[lk].push(s);});
        var _selFullByLat=_stripsByOwnerLat[_selOwner]||{};
        var _selGsKey=_selFullByLat._latStep||Math.round(_gs*100);
        // Detect wrap-around for selection highlight
        var _selWrapOffsets=[0];
        if(_selBounds&&_selBounds.maxLng>180) _selWrapOffsets.push(-w);
        if(_selBounds&&_selBounds.minLng<-180) _selWrapOffsets.push(w);
        _selWrapOffsets.forEach(function(_selWox){
        _sRectOx=_selWox;
        ctx.save();
        ctx.strokeStyle='#FFD166';ctx.lineWidth=2.5;ctx.setLineDash([6,4]);
        ctx.beginPath();
        for(var _si=0;_si<_selStrips.length;_si++){
          var _ss=_selStrips[_si],_ssr=_sRect(_ss);
          var _slk=Math.round(_ss.lat*100);
          ctx.moveTo(_ssr.x,_ssr.y);ctx.lineTo(_ssr.x,_ssr.y+_ssr.h);
          ctx.moveTo(_ssr.x+_ssr.w,_ssr.y);ctx.lineTo(_ssr.x+_ssr.w,_ssr.y+_ssr.h);
          var _sadj=_selByLat[_slk+_selGsKey]||[];
          var _scovX=[];for(var _sai=0;_sai<_sadj.length;_sai++){var _sar=_sRect(_sadj[_sai]);var _so1=Math.max(_ssr.x,_sar.x),_so2=Math.min(_ssr.x+_ssr.w,_sar.x+_sar.w);if(_so2>_so1)_scovX.push([_so1,_so2]);}
          _scovX.sort(function(a,b){return a[0]-b[0]});
          var _sp=_ssr.x;
          for(var _sci=0;_sci<_scovX.length;_sci++){if(_scovX[_sci][0]>_sp+0.5){ctx.moveTo(_sp,_ssr.y);ctx.lineTo(_scovX[_sci][0],_ssr.y);}_sp=_scovX[_sci][1];}
          if(_sp<_ssr.x+_ssr.w-0.5){ctx.moveTo(_sp,_ssr.y);ctx.lineTo(_ssr.x+_ssr.w,_ssr.y);}
          var _sadj2=_selByLat[_slk-_selGsKey]||[];
          var _scovX2=[];for(var _sai2=0;_sai2<_sadj2.length;_sai2++){var _sar2=_sRect(_sadj2[_sai2]);var _so12=Math.max(_ssr.x,_sar2.x),_so22=Math.min(_ssr.x+_ssr.w,_sar2.x+_sar2.w);if(_so22>_so12)_scovX2.push([_so12,_so22]);}
          _scovX2.sort(function(a,b){return a[0]-b[0]});
          var _sp2=_ssr.x,_syb=_ssr.y+_ssr.h;
          for(var _sci2=0;_sci2<_scovX2.length;_sci2++){if(_scovX2[_sci2][0]>_sp2+0.5){ctx.moveTo(_sp2,_syb);ctx.lineTo(_scovX2[_sci2][0],_syb);}_sp2=_scovX2[_sci2][1];}
          if(_sp2<_ssr.x+_ssr.w-0.5){ctx.moveTo(_sp2,_syb);ctx.lineTo(_ssr.x+_ssr.w,_syb);}
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        _sRectOx=0;
        }); // end _selWrapOffsets
      }
    }

    // Cache this snapshot for fast preview redraws
    claimsSnapshot=ctx.getImageData(0,0,w,h);
  }else{
    // Fast path: restore cached snapshot, only add preview overlay
    if(claimsSnapshot) ctx.putImageData(claimsSnapshot,0,0);
  }

  // Stamp preview (semi-transparent ghost following cursor)
  if(stampMode&&stampImgUrl&&stampPreviewLat!==null){
    var spw=stampW, sph=stampH;
    var pr=getCellRect(stampPreviewLat,stampPreviewLng,spw,sph,w,h);
    var simg=imgCache[stampImgUrl];
    if(simg){
      var _stampBlocked=!!_getBlockedSector(stampPreviewLat,stampPreviewLng);
      function _drawStampPreview(px,py,pw,ph){
        if(_stampBlocked){
          // 붉은 반투명 영역
          ctx.globalAlpha=0.22;
          ctx.fillStyle='rgba(180,0,0,1)';
          ctx.fillRect(px,py,pw,ph);
          ctx.globalAlpha=1;
          // 빨간 점선 테두리
          ctx.strokeStyle='rgba(255,60,60,0.9)';ctx.lineWidth=2;ctx.setLineDash([6,4]);
          ctx.strokeRect(px,py,pw,ph);ctx.setLineDash([]);
          ctx.globalAlpha=0.55;
          ctx.strokeStyle='rgba(255,158,76,0.78)';
          ctx.lineWidth=Math.max(1,Math.min(pw,ph)*0.018);
          ctx.setLineDash([]);
          for(var hx=px-pw;hx<px+pw*2;hx+=Math.max(8,Math.min(pw,ph)*0.16)){
            ctx.beginPath();ctx.moveTo(hx,py+ph);ctx.lineTo(hx+pw,py);ctx.stroke();
          }
          ctx.globalAlpha=1;
        }else{
          ctx.globalAlpha=0.45;
          ctx.drawImage(simg,px,py,pw,ph);
          ctx.globalAlpha=1;
          ctx.strokeStyle='rgba(255,107,53,0.7)';ctx.lineWidth=2;ctx.setLineDash([6,4]);
          ctx.strokeRect(px,py,pw,ph);ctx.setLineDash([]);
        }
      }
      _drawStampPreview(pr.x,pr.y,pr.w,pr.h);
      // Wrap around longitude boundary
      if(pr.x<0) _drawStampPreview(pr.x+w,pr.y,pr.w,pr.h);
      else if(pr.x+pr.w>w) _drawStampPreview(pr.x-w,pr.y,pr.w,pr.h);
      // Crosshair at center
      var cx=pr.x+pr.w/2, cy=pr.y+pr.h/2;
      ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(cx-10,cy);ctx.lineTo(cx+10,cy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-10);ctx.lineTo(cx,cy+10);ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Land select preview (cyan rectangle) — now rendered as a separate
  // WebGL polygon overlay via _setDragPreviewPolygon() so we never touch
  // the texture during drag. Skip all canvas drawing for this path.
  if(false && landSelectMode&&landDragStart){
    var lr=landDragRect||computeLandRect(landDragStart.lat,landDragStart.lng,
      landDragEnd?landDragEnd.lat:landDragStart.lat,
      landDragEnd?landDragEnd.lng:landDragStart.lng);
    if(lr){
      var lrr=getCellRect(lr.lat,lr.lng,lr.w,lr.h,w,h);
      // Helper: draw selection rect at given offset (for wrap-around)
      function _drawLandSel(ox){
        var rx=lrr.x+ox,ry=lrr.y,rw=lrr.w,rh=lrr.h;
        ctx.fillStyle='rgba(0,200,255,0.12)';
        ctx.fillRect(rx,ry,rw,rh);
        ctx.strokeStyle='rgba(0,220,255,0.85)';ctx.lineWidth=2;ctx.setLineDash([8,4]);
        ctx.strokeRect(rx,ry,rw,rh);ctx.setLineDash([]);
        var cm=6;
        ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(rx,ry+cm);ctx.lineTo(rx,ry);ctx.lineTo(rx+cm,ry);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx+rw-cm,ry);ctx.lineTo(rx+rw,ry);ctx.lineTo(rx+rw,ry+cm);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx,ry+rh-cm);ctx.lineTo(rx,ry+rh);ctx.lineTo(rx+cm,ry+rh);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx+rw-cm,ry+rh);ctx.lineTo(rx+rw,ry+rh);ctx.lineTo(rx+rw,ry+rh-cm);ctx.stroke();
      }
      // Draw main rect + wrapped copy if crossing texture edge
      var _landWrapOffsets=[0];
      if(lrr.x<0) _landWrapOffsets.push(w);
      else if(lrr.x+lrr.w>w) _landWrapOffsets.push(-w);
      // Helper: draw pin + size label at offset
      var lfs=Math.max(8,Math.min(lrr.w,lrr.h)*0.15);
      var ltxt=lr.w+'×'+lr.h;
      function _drawLandPin(ox){
        var pcx=lrr.x+lrr.w/2+ox, pcy=lrr.y+lrr.h/2;
        ctx.fillStyle='rgba(0,0,0,0.4)';
        ctx.beginPath();ctx.ellipse(pcx+1,pcy+1,3,1.5,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#fff';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(pcx,pcy);ctx.lineTo(pcx,pcy-24);ctx.stroke();
        ctx.beginPath();ctx.arc(pcx,pcy-28,7,0,Math.PI*2);
        ctx.fillStyle='rgba(0,200,255,0.95)';ctx.fill();
        ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
        ctx.beginPath();ctx.arc(pcx,pcy-28,2.5,0,Math.PI*2);
        ctx.fillStyle='#fff';ctx.fill();
        ctx.font='bold '+lfs+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        var ltw=ctx.measureText(ltxt).width;
        ctx.fillStyle='rgba(0,0,0,0.6)';
        ctx.fillRect(pcx-ltw/2-4,pcy+4,ltw+8,lfs+4);
        ctx.fillStyle='#fff';
        ctx.fillText(ltxt,pcx,pcy+6+lfs/2);
      }
      for(var _lwi=0;_lwi<_landWrapOffsets.length;_lwi++){
        _drawLandSel(_landWrapOffsets[_lwi]);
        _drawLandPin(_landWrapOffsets[_lwi]);
      }
    }
  }

  // Safety: verify the canvas actually has non-black content before replacing the globe texture.
  // On mobile, drawImage() can silently fail under memory pressure, leaving a black canvas.
  // If we replace the good Three.js-loaded texture with a black canvas, the globe appears black.
  try{
    var _safetyCtx = marsCanvas.getContext('2d');
    var _sample = _safetyCtx.getImageData(Math.floor(marsCanvas.width/2), Math.floor(marsCanvas.height/2), 2, 2).data;
    var _allBlack = true;
    for(var _si=0;_si<_sample.length;_si+=4){
      if(_sample[_si]>8 || _sample[_si+1]>8 || _sample[_si+2]>8){ _allBlack = false; break; }
    }
    if(_allBlack){
      console.warn('[Mars] Canvas empty/black after composite — skipping texture replacement');
      // Fallback: restore NASA texture via globe.gl TextureLoader (reliable path)
      if(currentTexMode==='nasa' && globe){
        try{ globe.globeImageUrl(nasa8kLoaded?NASA_MARS_8K:NASA_MARS_2K); }catch(_re){}
      }
      return;
    }
  }catch(_se){
    // getImageData can fail on tainted canvas — safer to skip than corrupt the globe
    console.warn('[Mars] Canvas safety check failed:', _se.message);
    return;
  }

  // ═══ TEXTURE UPLOAD ═══
  // Mobile: route through globe.globeImageUrl() with high-quality JPEG dataURL.
  // (CanvasTexture replacement AND in-place image swap both render as black
  //  on some mobile GPUs — only the TextureLoader path is reliable.)
  // Desktop: direct CanvasTexture GPU upload (fastest, no encoding cost).
  if(_isMob){
    // Preview drags (previewOnly=true) happen every animation frame while the
    // user moves the claim pin — re-encoding a 2K JPEG at 0.95 each frame
    // tanks the framerate. Use a coarser quality + tighter throttle while
    // previewing, and only do a high-quality upload on commit.
    try{
      var _now = Date.now();
      var _lastUp = window._lastMobileTexUpload || 0;
      if(previewOnly){
        // Coalesce preview uploads — max ~6 fps, quality 0.6 (tiny encode cost)
        if(_now - _lastUp < 160) return;
        window._lastMobileTexUpload = _now;
        var _dataUrlP = marsCanvas.toDataURL('image/jpeg', 0.60);
        globe.globeImageUrl(_dataUrlP);
      } else {
        // Full rebuild — commit quality. Throttle light (500ms).
        if(_now - _lastUp < 500) return;
        window._lastMobileTexUpload = _now;
        var _dataUrlF = marsCanvas.toDataURL('image/jpeg', 0.92);
        globe.globeImageUrl(_dataUrlF);
      }
    }catch(_mu){
      console.warn('[Mars] Mobile texture upload failed:', _mu.message);
    }
    return;
  }

  // Desktop: update the mounted material map directly. Re-routing this through
  // globe.globeImageUrl(dataURL) can briefly clear/reload the globe texture and
  // leave the planet invisible while overlays keep rendering.
  if(!marsCanvasTexture){
    var mat=globe.globeMaterial(); if(!mat) return;
    var existingMap=mat.map;
    var TexClass=existingMap&&existingMap.constructor ? existingMap.constructor : (window.THREE&&THREE.CanvasTexture);
    if(!TexClass){
      // No existing map to clone the constructor from, and THREE isn't exposed on
      // window in this globe.gl build. Rather than returning silently (which could
      // leave mat.map null → fully transparent/invisible planet while Starlink
      // overlays keep rendering), fall back to globe.gl's own TextureLoader, which
      // does not need window.THREE. Once it populates mat.map, a later composite
      // clones its constructor via existingMap and the claim overlay returns.
      try{
        var _fallbackTex = (currentTexMode==='nasa')
          ? (nasa8kLoaded ? NASA_MARS_8K : NASA_MARS_2K)
          : (marsTexUrl || NASA_MARS_2K);
        if(_fallbackTex) globe.globeImageUrl(_fallbackTex);
      }catch(_fe){}
      return;
    }
    marsCanvasTexture=new TexClass(marsCanvas);
    if(existingMap){
      try{
        if(existingMap.colorSpace) marsCanvasTexture.colorSpace=existingMap.colorSpace;
        else if(existingMap.encoding!=null) marsCanvasTexture.encoding=existingMap.encoding;
      }catch(_ce){}
    }
    try{
      var _renderer = globe.renderer && globe.renderer();
      var _maxAniso = _renderer && _renderer.capabilities && _renderer.capabilities.getMaxAnisotropy
        ? _renderer.capabilities.getMaxAnisotropy() : 16;
      marsCanvasTexture.anisotropy = _maxAniso;
    }catch(_ae){}
    marsCanvasTexture.needsUpdate=true;
    mat.map=marsCanvasTexture;
    mat.needsUpdate=true;
  }else{
    marsCanvasTexture.needsUpdate=true;
  }

}

// Simple alias used by short-lived previews (mission routes, hover hints, etc.)
// — kicks the texture re-composite without callers needing to know the function name.
window.requestRedraw = function(){ try{ compositeClaimsOnTexture(true); }catch(_e){} };

/* ── Generate Bump Map (higher detail) ───────────── */
function genMarsBump(){
  var c=document.createElement('canvas');c.width=2048;c.height=1024;
  var x=c.getContext('2d'),w=c.width,h=c.height;
  var id=x.createImageData(w,h),d=id.data;
  for(var y=0;y<h;y++){
    for(var i2=0;i2<w;i2++){
      var idx=(y*w+i2)*4,u=i2/w,v=y/h;
      var n=_fbm6(u*12,v*12)*.45+_fbm(u*24,v*24)*.22+_n(u*48,v*48)*.1+_n(u*96,v*96)*.04;
      var cr=craterAt(u,v);
      var ridge=_ridge(u*6+3,v*4+2)*0.15;
      // Valles Marineris depression
      var vm=0;
      if(v>.40&&v<.50&&u>.15&&u<.60){
        var vc=Math.abs(v-(.445+_n(u*8,v*2)*.012))/.02;
        if(vc<1)vm=-(1-vc)*0.4;
      }
      // Olympus Mons elevation
      var om=0;
      var od=Math.sqrt((u-.38)*(u-.38)+(v-.35)*(v-.35));
      if(od<.1)om=(1-od/.1)*0.3;
      var val=Math.max(0,Math.min(255,(n+cr*.45+ridge+vm+om+0.2)*255));
      d[idx]=d[idx+1]=d[idx+2]=val;d[idx+3]=255;
    }
  }
  x.putImageData(id,0,0);
  return c.toDataURL('image/jpeg',.85);
}

/* ── Generate Star Background (richer) ───────────── */
function genStarBg(){
  var c=document.createElement('canvas');c.width=2048;c.height=1024;
  var x=c.getContext('2d');
  // Deep space — subtle blue-violet gradient
  var gr=x.createRadialGradient(800,400,50,1024,512,1100);
  gr.addColorStop(0,'#0E0A1A');gr.addColorStop(0.5,'#080614');gr.addColorStop(1,'#030208');
  x.fillStyle=gr;x.fillRect(0,0,2048,1024);
  // Milky way band (faint diagonal glow)
  x.save();x.translate(1024,512);x.rotate(-0.3);
  var mw=x.createLinearGradient(-1200,0,1200,0);
  mw.addColorStop(0,'rgba(120,100,160,0)');mw.addColorStop(0.3,'rgba(120,100,160,0.015)');
  mw.addColorStop(0.5,'rgba(140,120,180,0.025)');mw.addColorStop(0.7,'rgba(120,100,160,0.015)');
  mw.addColorStop(1,'rgba(120,100,160,0)');
  x.fillStyle=mw;x.fillRect(-1200,-120,2400,240);x.restore();
  // Dim stars (varied colors)
  for(var i=0;i<1800;i++){
    var sx=Math.random()*2048,sy=Math.random()*1024;
    var sr=Math.random()*1+0.2,sb=Math.random()*0.45+0.15;
    var hues=[0,0,0,30,45,200,220,240]; // mostly white, some colored
    var hue=hues[Math.floor(Math.random()*hues.length)];
    var sat=hue===0?0:Math.random()*40+20;
    x.fillStyle='hsla('+hue+','+sat+'%,80%,'+sb+')';
    x.beginPath();x.arc(sx,sy,sr,0,Math.PI*2);x.fill();
  }
  // Bright stars with glow + diffraction spikes
  for(var i=0;i<45;i++){
    var sx=Math.random()*2048,sy=Math.random()*1024;
    var bright=Math.random()*0.3+0.7;
    var starHue=Math.random()>.7?(Math.random()>.5?220:30):0;
    x.fillStyle='hsla('+starHue+',20%,95%,'+bright+')';
    x.beginPath();x.arc(sx,sy,1.2+Math.random(),0,Math.PI*2);x.fill();
    var gg=x.createRadialGradient(sx,sy,0,sx,sy,10);
    gg.addColorStop(0,'hsla('+starHue+',30%,85%,0.2)');gg.addColorStop(1,'hsla('+starHue+',30%,85%,0)');
    x.fillStyle=gg;x.fillRect(sx-10,sy-10,20,20);
  }
  // Nebula patches (richer, more varied)
  var nebColors=[[280,45],[220,40],[340,35],[180,30],[30,25]];
  for(var i=0;i<8;i++){
    var nx=Math.random()*2048,ny=Math.random()*1024,ns=Math.random()*250+80;
    var nc=nebColors[i%nebColors.length];
    var ng=x.createRadialGradient(nx+Math.random()*60-30,ny+Math.random()*40-20,0,nx,ny,ns);
    ng.addColorStop(0,'hsla('+nc[0]+','+nc[1]+'%,18%,0.05)');
    ng.addColorStop(0.5,'hsla('+nc[0]+','+nc[1]+'%,14%,0.025)');
    ng.addColorStop(1,'hsla('+nc[0]+','+nc[1]+'%,10%,0)');
    x.fillStyle=ng;x.fillRect(nx-ns,ny-ns,ns*2,ns*2);
  }
  return c.toDataURL('image/jpeg',.92);
}

/* ── Generate Demo Logo Images ───────────────────── */
function genLogo(emoji,bg,border){
  var c=document.createElement('canvas');c.width=80;c.height=80;
  var x=c.getContext('2d');
  x.fillStyle=bg;x.fillRect(0,0,80,80);
  x.strokeStyle=border;x.lineWidth=3;x.strokeRect(1,1,78,78);
  x.font='40px serif';x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#fff';x.fillText(emoji,40,42);
  return c.toDataURL();
}
/* ── Globe Init (async pipeline — lets browser paint loading screen) ── */
var NASA_MARS_2K='/assets/textures/mars_nasa_2k.jpg';
var NASA_MARS_8K='/assets/textures/mars_nasa_8k.jpg';
var marsBumpUrl, starBgUrl, marsTexUrl;
var currentTexMode='nasa';
var nasa8kLoaded=false;
var globe, scene;

// ---- Void Raider Globe Layer ----
let _vrEvents = [];
let _vrPollTimer = null;

async function _initVoidRaiderLayer() {
  await _vrRefresh();
  if (_vrPollTimer) _clearActiveInterval(_vrPollTimer);
  _vrPollTimer = _setActiveInterval(_vrRefresh, 30000);
}

async function _vrRefresh() {
  if (!_pageIsActive()) return;
  try {
    const data = (typeof _guardedJsonFetch === 'function')
      ? await _guardedJsonFetch('void-raider-world-events', '/api/world-events', {minGap:25000, backoffMs:120000})
      : await fetch('/api/world-events').then(function(r){ return r.ok ? r.json() : null; });
    if (!data) return;
    const events = Array.isArray(data) ? data : (data.events || []);
    _vrEvents = events.filter(e => e.lat != null && e.lng != null);
    _vrRenderLayer();
  } catch(err) { console.warn('[VR] poll error', err); }
}

function _vrMakeClusterEl(ev) {
  const tier = (ev.boss_tier || ev.meta?.boss_tier || 'raider');
  const rawSprites = ev.ship_sprites || ev.meta?.ship_sprites;
  const sprites = (Array.isArray(rawSprites) && rawSprites.length) ? rawSprites : ['cv_crs','cv_frg','cv_dst'];
  const currentHp = ev.current_hp != null ? ev.current_hp : ev.hp_current;
  const maxHp = ev.max_hp != null ? ev.max_hp : ev.hp_max;
  const hp = currentHp != null && maxHp ? Math.round(currentHp / maxHp * 100) : 100;

  // ── 함선 크기 (전술랩 비율 기준) ───────────────────────────
  function _sz(code) {
    const s = (code || '').toLowerCase();
    if (s.includes('ttn')  || s.includes('titan'))    return 32;
    if (s.includes('bs')   || s.includes('battle'))   return 15;
    if (s.includes('crs')  || s.includes('cruiser'))  return 11;
    if (s.includes('dst')  || s.includes('destroyer'))return  9;
    return  6; // frigate
  }

  // ── 기함 결정: 가장 큰 함선 ─────────────────────────────────
  const fleet = sprites.slice(0,9).map((code,i) => ({code, i, sz: _sz(code)}));
  fleet.sort((a,b) => b.sz - a.sz);

  // ── 컨테이너 ─────────────────────────────────────────────────
  const SZ = 96;
  const cx0 = SZ/2, cy0 = SZ/2;

  // ── 쐐기 진형 9슬롯 (위=전선, 아래=후방) ────────────────────
  //         [0]            row0: 최전방 tip (가장 작은 함선)
  //       [1] [2]          row1: 전위
  //     [3] [4] [5]        row2: 기함(4) 정중앙 + 강력 호위
  //       [6] [7]          row3: 후위
  //         [8]            row4: 후미
  const W = 12; // 좌우 간격
  const H = 11; // 전후 간격
  const fmOff = [
    { dy:-H*2,   dx:  0,    rot:  0  }, // [0] tip
    { dy:-H,     dx: -W,    rot:  -8 }, // [1] 좌전
    { dy:-H,     dx:  W,    rot:   8 }, // [2] 우전
    { dy:  0,    dx:-W*2,   rot: -12 }, // [3] 좌익
    { dy:  0,    dx:  0,    rot:   0 }, // [4] 기함 정중앙
    { dy:  0,    dx: W*2,   rot:  12 }, // [5] 우익
    { dy:  H,    dx: -W,    rot:  -6 }, // [6] 좌후
    { dy:  H,    dx:  W,    rot:   6 }, // [7] 우후
    { dy:  H*2,  dx:  0,    rot:   0 }, // [8] 후미
  ];
  // 기함=슬롯4, 이후 크기순: 바로 옆 호위 → 전위 → 후위 → tip(최소)
  const escortSlots = [3, 5, 1, 2, 6, 7, 8, 0];

  const wrap = document.createElement('div');
  wrap.className = `vr-boss-cluster vr-tier-${tier}`;
  wrap.style.cssText = `position:absolute;width:${SZ}px;height:${SZ}px;display:none;pointer-events:auto;cursor:pointer`;
  wrap.title = '';
  wrap.onclick = (e) => { e.stopPropagation(); openWorldEventDetail(ev.id); };
  wrap.addEventListener('wheel', (e) => { e.currentTarget.style.pointerEvents='none'; setTimeout(()=>{ e.currentTarget.style.pointerEvents='auto'; },50); }, {passive:true});

  // ── 후광 (radial glow backdrop) ──────────────────────────────
  const haloSz = 64;
  const halo = document.createElement('div');
  halo.className = 'vr-cluster-halo';
  halo.style.cssText = `position:absolute;width:${haloSz}px;height:${haloSz}px;`+
    `top:${cy0-haloSz/2}px;left:${cx0-haloSz/2}px;pointer-events:none`;
  wrap.appendChild(halo);

  // ── 경고 링 (얇고 절제된) ────────────────────────────────────
  const ringR = 33;
  const ring = document.createElement('div');
  ring.className = 'vr-warn-ring';
  ring.style.cssText = `position:absolute;`+
    `width:${ringR*2}px;height:${ringR*2}px;`+
    `top:${cy0-ringR}px;left:${cx0-ringR}px;pointer-events:none`;
  wrap.appendChild(ring);

  // ── 함선 렌더 ────────────────────────────────────────────────
  fleet.forEach((ship, rank) => {
    const slot = rank === 0 ? 4 : escortSlots[rank-1];
    if (slot == null) return;
    const f   = fmOff[slot];
    const img = document.createElement('img');
    img.className = 'vr-ship-img';
    img.src = `/assets/ships/top/${ship.code}.png?v=` + (typeof ASSET_VER!=='undefined'?ASSET_VER:'1');
    img.onerror = () => { img.style.display='none'; };
    img.style.width  = ship.sz + 'px';
    img.style.height = ship.sz + 'px';
    img.style.top    = Math.round(cy0 + f.dy - ship.sz/2) + 'px';
    img.style.left   = Math.round(cx0 + f.dx - ship.sz/2) + 'px';
    img.style.setProperty('--vr-rot', f.rot + 'deg');
    img.style.setProperty('--vr-dur',   (3.5 + rank * 0.5) + 's');
    img.style.setProperty('--vr-delay', (rank * 0.3) + 's');
    // 기함 강조
    if (rank === 0) {
      img.style.filter = `drop-shadow(0 0 6px var(--vr-glow,#f44)) brightness(1.3)`;
      img.style.zIndex = '2';
    }
    wrap.appendChild(img);
  });

  // ── HP 바 (컴팩트) ───────────────────────────────────────────
  const barW = 36;
  const bar = document.createElement('div');
  bar.className = 'vr-hp-bar';
  bar.style.cssText = `position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:${barW}px;height:2px;`;
  const fill = document.createElement('div');
  fill.className = 'vr-hp-fill';
  fill.style.cssText = `height:100%;width:${Math.round(Math.max(0,Math.min(100,hp))/100*barW)}px`;
  bar.appendChild(fill);
  wrap.appendChild(bar);

  return wrap;
}

// ── Void Raider 스크린 좌표 투영 ──────────────────────────────
// globe.gl 카메라 행렬로 lat/lng → 픽셀 변환. THREE 전역 불필요.
var _vrOverlayEl = null;
var _vrOverlayNodes = [];  // [{el, evId}]
var _vrRafId = null;

function _vrLatLngToScreen(lat, lng) {
  var g = window.globe || globe;
  if (!g) return null;
  var cam = g.camera && g.camera();
  var ren = g.renderer && g.renderer();
  if (!cam || !ren) return null;
  // 구 좌표 → 3D
  var phi = (90 - lat) * Math.PI / 180;
  var theta = (lng + 180) * Math.PI / 180;
  var R = 100; // globe.gl 기본 반지름
  var x = -R * Math.sin(phi) * Math.cos(theta);
  var y =  R * Math.cos(phi);
  var z =  R * Math.sin(phi) * Math.sin(theta);
  // 뷰 행렬 적용
  var vm = cam.matrixWorldInverse.elements;
  var vx = vm[0]*x+vm[4]*y+vm[8]*z+vm[12];
  var vy = vm[1]*x+vm[5]*y+vm[9]*z+vm[13];
  var vz = vm[2]*x+vm[6]*y+vm[10]*z+vm[14];
  var vw = vm[3]*x+vm[7]*y+vm[11]*z+vm[15];
  // 프로젝션 행렬 적용
  var pm = cam.projectionMatrix.elements;
  var cx = pm[0]*vx+pm[4]*vy+pm[8]*vz+pm[12]*vw;
  var cy = pm[1]*vx+pm[5]*vy+pm[9]*vz+pm[13]*vw;
  var cw = pm[3]*vx+pm[7]*vy+pm[11]*vz+pm[15]*vw;
  if (cw <= 0) return null; // 카메라 뒤
  var ndx = cx / cw, ndy = cy / cw;
  if (ndx < -1.2 || ndx > 1.2 || ndy < -1.2 || ndy > 1.2) return null;
  // 글로브 뒤쪽 + 지평선 근처 판별
  var camPos = cam.position;
  var dot = camPos.x*x + camPos.y*y + camPos.z*z;
  if (dot < 0) return null; // 뒤쪽
  // 지평선 근처(limb)는 기울기가 안 맞아 보임 — dot이 작을수록 가장자리
  var camLen = Math.sqrt(camPos.x*camPos.x+camPos.y*camPos.y+camPos.z*camPos.z);
  if (dot < camLen * R * 0.28) return null; // ~73° 이상 = 가장자리 숨김
  var w = ren.domElement.clientWidth  || window.innerWidth;
  var h = ren.domElement.clientHeight || window.innerHeight;
  return { x: (ndx+1)/2*w, y: (1-ndy)/2*h };
}

function _vrUpdateOverlay() {
  if (!_pageIsActive()) {
    _vrRafId = null;
    return;
  }
  _vrRafId = requestAnimationFrame(_vrUpdateOverlay);
  if (!_vrOverlayEl || !_vrEvents.length) return;
  // 너무 줌인되면 전체 숨김 (표면 기울기와 안 맞아서 이상하게 보임)
  var g = window.globe || globe;
  var alt = (g && g.pointOfView) ? (g.pointOfView().altitude || 2) : 2;
  if (alt < 0.55) {
    _vrOverlayNodes.forEach(function(n){ n.el.style.display='none'; });
    return;
  }
  _vrOverlayNodes.forEach(function(n) {
    var ev = _vrEvents.find(function(e){ return String(e.id)===String(n.evId); });
    if (!ev) { n.el.style.display='none'; return; }
    var sc = _vrLatLngToScreen(parseFloat(ev.lat), parseFloat(ev.lng));
    if (!sc) { n.el.style.display='none'; return; }
    var half = Math.round((n.sz || 96) / 2);
    n.el.style.display = '';
    n.el.style.left = (sc.x - half) + 'px';
    n.el.style.top  = (sc.y - half) + 'px';
  });
}

function _vrBuildOverlay() {
  if (!_vrOverlayEl) {
    _vrOverlayEl = document.createElement('div');
    _vrOverlayEl.id = 'vrOverlay';
    _vrOverlayEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12';
    document.body.appendChild(_vrOverlayEl);
  }
  // 기존 노드 정리
  _vrOverlayNodes.forEach(function(n){ n.el.remove(); });
  _vrOverlayNodes = [];
  _vrEvents.forEach(function(ev) {
    var el = _vrMakeClusterEl(ev);
    _vrOverlayEl.appendChild(el);
    // SZ는 el의 inline width에서 읽어서 중심 오프셋 계산
    _vrOverlayNodes.push({el:el, evId:ev.id, sz:parseInt(el.style.width)||70});
  });
  if (!_vrRafId) _vrUpdateOverlay();
}

_onPageVisible(function(){
  if (_vrEvents.length) _vrRefresh();
  if (_vrOverlayEl && !_vrRafId) _vrUpdateOverlay();
});
_onPageHidden(function(){
  if (_vrRafId) {
    cancelAnimationFrame(_vrRafId);
    _vrRafId = null;
  }
});

function _vrRenderLayer() {
  var g = window.globe || globe;
  if (!g) return;
  // 글로우 포인트 (클릭 핸들러 포함)
  if (typeof g.pointsData === 'function') {
    var tierRadius = {scout:0.35, raider:0.55, fleet:0.75, leviathan:0.95};
    var tierCol    = {scout:'#ff8800', raider:'#ff3333', fleet:'#cc0000', leviathan:'#aa00ff'};
    g.pointsData(_vrEvents)
      .pointLat(function(d){ return parseFloat(d.lat); })
      .pointLng(function(d){ return parseFloat(d.lng); })
      .pointAltitude(0.01)
      .pointRadius(function(d){ return tierRadius[d.boss_tier]||0.55; })
      .pointColor(function(d){ return tierCol[d.boss_tier]||'#ff3333'; })
      .pointsMerge(false)
      .onPointClick(function(d){ openWorldEventDetail(d.id); });
  }
  // CSS 오버레이 클러스터
  _vrBuildOverlay();
}

function _initStep1(){
  setLoadProgress(20,'Generating bump map...');
  requestAnimationFrame(function(){
    marsBumpUrl=genMarsBump();
    setLoadProgress(35,'Generating star field...');
    requestAnimationFrame(function(){
      starBgUrl=genStarBg();
      setLoadProgress(42,'Generating Mars terrain...');
      requestAnimationFrame(_initStep2);
    });
  });
}

function _initStep2(){
  // Mobile: skip heavy procedural texture generation
  if(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)){
    console.log('[Mars] Mobile — skipping procedural texture generation');
    setLoadProgress(72,'Textures ready...');
    requestAnimationFrame(_initStep3);
    return;
  }
  marsTexUrl=genMarsTexture();
  setLoadProgress(72,'Textures ready...');
  requestAnimationFrame(_initStep3);
}

function _initStep3(){
  // Re-generate procedural texture once Orbitron font loads (DESKTOP ONLY — mobile skips procedural)
  var _isMobileInit=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if(!_isMobileInit && document.fonts&&document.fonts.load){
    document.fonts.load('900 48px "Orbitron"').then(function(){
      console.log('[Mars] Orbitron font loaded, regenerating procedural texture');
      marsTexUrl=genMarsTexture();
      if(currentTexMode==='procedural'&&globe) globe.globeImageUrl(marsTexUrl);
    }).catch(function(){});
  }

  // On mobile: skip procedural, use simple placeholder → NASA 2K loads in background
  var isMobileDevice=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  var initTexUrl;
  if(isMobileDevice){
    console.log('[Mars] Mobile — using NASA 2K directly from start');
    initTexUrl=NASA_MARS_2K;
    currentTexMode='nasa';
  } else {
    // Desktop starts from the already-generated procedural surface so a hard refresh
    // never shows a blank/white globe while the NASA texture is still downloading.
    initTexUrl=(currentTexMode==='nasa')?(marsTexUrl||NASA_MARS_2K):marsTexUrl;
  }
  setLoadProgress(80,'Initializing globe...');

  requestAnimationFrame(function(){
    if(typeof Globe==='undefined'){
      setLoadProgress(85,'Loading globe library...');
      var _retryCount=0;
      var _waitForGlobe=_setActiveInterval(function(){
        _retryCount++;
        if(typeof Globe!=='undefined'){_clearActiveInterval(_waitForGlobe);_doInitGlobe();}
        else if(_retryCount>30){_clearActiveInterval(_waitForGlobe);setLoadProgress(90,'Globe library failed. Please refresh.');}
      },1000);
      return;
    }
    _doInitGlobe();
  });
  window._globeRetryInit=_doInitGlobe;
  function _doInitGlobe(){
  requestAnimationFrame(function(){
    globe=Globe()
      .globeImageUrl(initTexUrl)
      .bumpImageUrl(marsBumpUrl)
      .backgroundImageUrl(starBgUrl)
      .showAtmosphere(true)
      .atmosphereColor('#FF6E32')
      .atmosphereAltitude(0.2)
      .width(window.innerWidth)
      .height(window.innerHeight)
      .onGlobeReady(function(){
        setLoadProgress(95,'Loading Mars texture...');
        globe.pointOfView({altitude:3.2},0);
        if(isMobileDevice){
          // Wait for NASA texture to load before dismissing
          setLoadProgress(96,'Downloading Mars surface...');
        } else if(currentTexMode==='nasa'){
          setLoadProgress(96,'Preparing Mars surface...');
        } else {
          setTimeout(dismissLoader,200);
        }
        // 글로브 준비 완료 후 Void Raider 레이어 초기화
        _initVoidRaiderLayer();
      })
      (document.getElementById('globe-wrap'));

    window.globe=globe;
    scene=globe.scene();
    setLoadProgress(90,'Rendering globe...');

    // ═══ DRAG-PIN OVERLAY (WebGL polygon, no JPEG re-encoding) ═══
    // Renders the land-select preview rectangle as a separate polygon layer
    // instead of drawing it onto marsCanvas — eliminates the toDataURL cost
    // per drag frame on mobile and keeps the pin perfectly crisp.
    try{
      globe
        .polygonsData([])
        .polygonAltitude(0.003)
        .polygonCapColor(function(){ return 'rgba(0,220,255,0.22)'; })
        .polygonSideColor(function(){ return 'rgba(0,220,255,0.10)'; })
        .polygonStrokeColor(function(){ return 'rgba(0,255,255,1)'; })
        .polygonsTransitionDuration(0);
    }catch(_pe){ console.warn('[Mars] polygonsData init failed:', _pe.message); }

    // Init texture toggle button label
    var tl=document.getElementById('texToggleLabel');if(tl)tl.textContent='MAP';

    // Pre-cache initial NASA 2K so compositeClaimsOnTexture can use it immediately
    if(currentTexMode==='nasa'){
      cacheImage(NASA_MARS_2K,function(img){
        console.log('[Mars] NASA 2K cached for compositing');
        if(!img || !globe) return;
        compositeClaimsOnTexture();
        if(!isMobileDevice){
          setLoadProgress(100,'Ready!');
          setTimeout(dismissLoader,150);
        }
      });
    }
    // Mobile: NASA 2K already set as initTexUrl, just cache for compositing
    if(isMobileDevice){
      console.log('[Mars] Mobile — caching NASA 2K for compositing');
      setLoadProgress(97,'Rendering Mars surface...');
      var _mobNasaDone = false;
      cacheImage(NASA_MARS_2K, function(img){
        if(_mobNasaDone) return;
        _mobNasaDone = true;
        if(img){
          console.log('[Mars] NASA 2K cached on mobile — success');
          compositeClaimsOnTexture();
        } else {
          console.warn('[Mars] NASA 2K cache failed — globe.gl renders directly');
        }
        setLoadProgress(100,'Ready!');
        setTimeout(dismissLoader, 300);
      });
      // Safety timeout
      setTimeout(function(){
        if(!_mobNasaDone){
          _mobNasaDone = true;
          console.warn('[Mars] Mobile NASA cache timeout — dismissing loader');
          setLoadProgress(100,'Ready!');
          dismissLoader();
        }
      }, 12000);
    } else {
      // Desktop: progressive load 8K NASA texture in background
      _setActiveTimeout(loadNasa8k, 2000);
    }

    // Auto-rotation
    globe.controls().autoRotate=true;
    globe.controls().autoRotateSpeed=0.6;
    globe.controls().enableDamping=true;
    globe.controls().dampingFactor=0.12;
    globe.controls().minDistance=160;
    globe.controls().maxDistance=600;

    // Override double-click zoom to prevent zooming too close
    var gWrap=document.getElementById('globe-wrap');
    gWrap.addEventListener('dblclick',function(e){
      e.stopPropagation();
      var pov=globe.pointOfView();
      var newAlt=Math.max(0.25, pov.altitude*0.55);
      globe.pointOfView({altitude:newAlt},400);
    },true);

    // Resize (debounced — avoids thrashing WebGL context on every pixel of resize/rotate)
    window.addEventListener('resize',_debounce(function(){
      globe.width(window.innerWidth);
      globe.height(window.innerHeight);
    },200));

    // Fallback dismiss
    var checkImg=new Image();
    checkImg.onload=function(){
      if(_loadPct<100){setLoadProgress(98,'Ready...');setTimeout(dismissLoader,200);}
    };
    checkImg.src=initTexUrl;
    setTimeout(function(){ if(_loadPct<100) dismissLoader(); }, 8000);

    // WebGL context lost/restored recovery
    var gCanvas=document.querySelector('#globe-wrap canvas');
    if(gCanvas){
      gCanvas.addEventListener('webglcontextlost',function(e){
        e.preventDefault();
        console.warn('[Mars] WebGL context lost — will restore');
      });
      gCanvas.addEventListener('webglcontextrestored',function(){
        console.log('[Mars] WebGL context restored — reloading globe');
        if(globe){
          globe.globeImageUrl(currentTexMode==='nasa'?NASA_MARS_2K:marsTexUrl);
        }
      });
    }

    // Attach globe click handler now that globe exists
    _attachGlobeClick();

    // Signal globe is ready — remaining code runs at global scope
    window._globeReady=true;
    // Load season data
    try{loadSeasonData();}catch(e){};
  });
}
} // end _initStep3

function toggleMarsTexture(){
  marsCanvasTexture=null;
  claimsSnapshot=null;
  if(currentTexMode==='procedural'){
    currentTexMode='nasa';
    document.getElementById('texToggleLabel').textContent='MAP';
  }else{
    currentTexMode='procedural';
    document.getElementById('texToggleLabel').textContent='MAP';
  }
  localStorage.setItem('marsTexMode',currentTexMode);
  compositeClaimsOnTexture();
}

function toggleSectorOverlay(){
  _showSectorBounds=!_showSectorBounds;
  var btn=document.getElementById('sectorToggleBtn');
  if(btn) btn.style.background=_showSectorBounds?'rgba(90,180,230,0.25)':'';
  var label = document.getElementById('sectorToggleLabel');
  if(label && _showSectorBounds) {
    label.dataset.prevText = label.textContent || label.dataset.prevText || 'SECTORS';
    label.textContent = '...';
  }
  function repaintSectors(data){
    if(label && label.dataset.prevText) label.textContent = label.dataset.prevText;
    if (Array.isArray(data) && data.length) {
      _sectorsData = data;
      try { window._sectorsData = data; } catch(_) {}
    }
    try {
      marsCanvasTexture = null;
      claimsSnapshot = null;
      compositeClaimsOnTexture();
    } catch(_) {}
    if(_showSectorBounds && (!_sectorsData || !_sectorsData.length)){
      try{ showToast(tl('Sector data not loaded yet','섹터 데이터를 아직 불러오지 못했습니다','セクターデータ未読込','扇区数据尚未加载'), 'warn'); }catch(_){}
    }
  }
  // 토글 ON/OFF 어느 쪽이든 fresh sector data 가져온 후 텍스처 재합성.
  // 이렇게 해야 admin 의 governor/공지/tier 변경이 즉시 반영됨.
  if (_showSectorBounds) {
    fetch('/api/sectors?ui_toggle=' + Date.now(), { headers: marsAuthHeaders(), cache:'no-store' })
      .then(function(r){
        if(!r.ok) throw new Error('HTTP_'+r.status);
        return r.json();
      })
      .then(repaintSectors)
      .catch(function(){
        if (typeof refreshSectors === 'function') {
          refreshSectors().then(repaintSectors).catch(function(){ repaintSectors(null); });
        } else {
          repaintSectors(null);
        }
      });
  } else {
    repaintSectors(null);
  }
}
window.toggleSectorOverlay = toggleSectorOverlay;
function bindSectorToggleButton(){
  var btn = document.getElementById('sectorToggleBtn');
  if (!btn || btn.dataset.sectorToggleBound === '1') return;
  btn.dataset.sectorToggleBound = '1';
  btn.onclick = null;
  btn.removeAttribute('onclick');
  btn.addEventListener('click', function(ev){
    ev.preventDefault();
    ev.stopPropagation();
    toggleSectorOverlay();
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindSectorToggleButton, { once:true });
} else {
  bindSectorToggleButton();
}

var _myLandMode=false;
var _myLandIdx=-1; // current territory GROUP index for cycling
function toggleMyLand(){
  if(!walletState.connected){showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));openAuthModal();return;}
  var myAddr=walletState.address||'';
  var groups=_ownerGroups[myAddr]||[];

  if(!_myLandMode){
    _myLandMode=true;
    _myLandIdx=0;
    var btn=document.getElementById('myLandBtn');
    if(btn) btn.style.background='rgba(255,120,60,0.25)';
    if(globe&&globe.controls) globe.controls().autoRotate=false;
    claimsSnapshot=null;
    compositeClaimsOnTexture();
    _updateMyTerritories();
    document.getElementById('myTerritoriesSection').style.display='';
  }else{
    _myLandIdx++;
    if(_myLandIdx>=groups.length){
      _myLandMode=false;
      _myLandIdx=-1;
      var btn=document.getElementById('myLandBtn');
      if(btn) btn.style.background='';
      if(globe&&globe.controls) globe.controls().autoRotate=true;
      claimsSnapshot=null;
      compositeClaimsOnTexture();
      document.getElementById('myTerritoriesSection').style.display='none';
      showToast(tl('My Land off','내 영토 보기 종료','マイ領土表示オフ','我的领地视图已关闭'));
      return;
    }
  }

  // Zoom to current merged territory group
  if(groups.length>0&&_myLandIdx<groups.length){
    var grp=groups[_myLandIdx];
    var firstClaim=claims[grp.claimIndices[0]];
    if(!firstClaim){showToast(tl('No territories owned','보유한 영토가 없습니다','所有している領土がありません','没有拥有的领地'));return;}
    var merged=_buildMergedPlot(myAddr,firstClaim.lat,firstClaim.lng);
    if(!merged) merged=firstClaim;
    var pw=merged.w||merged.size||20, ph=merged.h||merged.size||20;
    globe.pointOfView({lat:merged.lat,lng:merged.lng,altitude:Math.max(0.8,Math.max(pw,ph)*0.008)},600);
    selectedPlot=merged;
    showTerritoryInfo(merged);
    showToast(tl('My Land ','내 영토 ','マイ領土 ','我的领地 ')+(_myLandIdx+1)+'/'+groups.length+(merged._pixelCount?' — '+merged._pixelCount+' px':''));
    _highlightMyTerritoryItem(_myLandIdx);
  }else{
    showToast(tl('No territories owned','보유한 영토가 없습니다','所有している領土がありません','没有拥有的领地'));
  }
}
function _highlightMyTerritoryItem(idx){
  var list=document.getElementById('myTerritoryList');
  if(!list) return;
  var items=list.children;
  for(var i=0;i<items.length;i++){
    items[i].style.borderColor=i===idx?'rgba(255,120,60,0.6)':'rgba(255,120,60,.12)';
    items[i].style.background=i===idx?'rgba(255,120,60,.2)':'rgba(255,120,60,.06)';
  }
}
function _updateMyTerritories(){
  var myAddr=walletState.address||'';
  var mine=claims.filter(function(c){return c.owner===myAddr});
  var countEl=document.getElementById('myTerritoryCount');
  var listEl=document.getElementById('myTerritoryList');
  if(!listEl) return;
  listEl.innerHTML='';
  if(mine.length===0){
    if(countEl) countEl.textContent='0';
    listEl.innerHTML='<div style="font-size:10px;color:var(--tx3);padding:4px 0">No territories yet</div>';
    return;
  }
  // _myTerritoryGroups 헬퍼로 그룹 목록 가져오기 (BASE 내 영토 탭 공통 로직)
  var grpList=_myTerritoryGroups(myAddr);
  var entries=grpList.map(function(g){
    var totalPP=g.claims.reduce(function(s,c){return s+(c.price||0);},0);
    return {claims:g.claims,group:_ownerGroups[myAddr]?_ownerGroups[myAddr].find(function(og){return og.claimIndices[0]!==undefined&&claims[og.claimIndices[0]]&&claims[og.claimIndices[0]].id===g.primaryId;})||null:null,totalPP:totalPP,hasImg:g.hasImg,_grp:g};
  });
  if(countEl) countEl.textContent=entries.length;
  entries.forEach(function(entry,i){
    var d=document.createElement('div');
    d.style.cssText='border-radius:6px;margin-bottom:3px;background:rgba(255,120,60,.06);border:1px solid rgba(255,120,60,.12);transition:all .15s;overflow:hidden';
    // Main row (always visible)
    var mainRow=document.createElement('div');
    mainRow.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:5px 8px;cursor:pointer';
    mainRow.onmouseenter=function(){d.style.background='rgba(255,120,60,.15)'};
    mainRow.onmouseleave=function(){d.style.background='rgba(255,120,60,.06)'};
    var ec=entry.claims;
    var g=entry._grp;
    var centerLat=g?g.centerLat:ec[0].lat;
    var centerLng=g?g.centerLng:ec[0].lng;
    var totalPx=g?g.totalPx:ec.reduce(function(s,c){return s+((c.w||c.width||1)*(c.h||c.height||1));},0);
    var left=document.createElement('div');
    var subLabel=ec.length>1?' <span style="color:var(--gold);font-size:9px">('+ec.length+' merged)</span>':'';
    left.innerHTML='<div style="font-size:10px;color:var(--tx2)">#'+(i+1)+' · '+centerLat.toFixed(1)+'°, '+centerLng.toFixed(1)+'°'+subLabel+'</div><div style="font-size:9px;color:var(--tx3)">'+totalPx+'px · '+(entry.hasImg?'📷':'🏴 No image')+'</div>';
    var right=document.createElement('div');
    right.style.cssText='display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:60px';
    right.innerHTML='<span style="font-size:10px;color:var(--gold);white-space:nowrap">'+entry.totalPP.toFixed(1)+' PP</span>';
    // FOR SALE badge or SELL button
    var anyForSale=ec.some(function(c){return _forSaleMap[c.id]});
    var anyAuction=ec.some(function(c){var fs=_forSaleMap[c.id];return fs&&fs.saleType==='auction'});
    var sellBtn=document.createElement('button');
    if(anyForSale){
      sellBtn.textContent=anyAuction?'🔨 AUCTION':'💰 FOR SALE';
      sellBtn.style.cssText='font-size:7px;padding:2px 6px;border-radius:4px;border:1px solid rgba(76,216,154,.4);background:rgba(76,216,154,.12);color:#4cd89a;cursor:pointer;font-family:var(--fn);font-weight:700;white-space:nowrap';
      sellBtn.title='Currently listed for sale';
      sellBtn.onclick=function(e){e.stopPropagation();switchBaseTab('market',document.getElementById('baseTabMarket'));};
    } else {
      sellBtn.textContent='💰 SELL';
      sellBtn.style.cssText='font-size:7px;padding:2px 6px;border-radius:4px;border:1px solid rgba(160,100,220,.35);background:rgba(160,100,220,.08);color:#a064dc;cursor:pointer;font-family:var(--fn);font-weight:700;white-space:nowrap';
      (function(claimItem){
        sellBtn.onclick=function(e){
          e.stopPropagation();
          if(!walletState||!walletState.address){showToast(t('connect_wallet')||'Connect wallet first','error');return;}
          // Direct sell: open listing modal immediately if we have the claim id
          if(claimItem&&claimItem.id){
            openListModal('claim',claimItem.id,'Territory #'+claimItem.id,'🗺️',0);
          } else {
            // Fallback: navigate to market sell tab
            switchBaseTab('market',document.getElementById('baseTabMarket'));
            setTimeout(function(){switchMarketView('sell',document.querySelectorAll('.mkt-view-btn')[1]);},200);
          }
        };
      })(ec[0]);
    }
    right.appendChild(sellBtn);
    mainRow.appendChild(left);mainRow.appendChild(right);
    d.appendChild(mainRow);
    // Click: zoom to territory
    var zoomW=b?(b.maxLng-b.minLng):((ec[0].w||10)*0.22);
    var zoomH=b?(b.maxLat-b.minLat):((ec[0].h||10)*0.22);
    mainRow.onclick=function(){
      globe.pointOfView({lat:centerLat,lng:centerLng,altitude:Math.max(0.4,Math.max(zoomW,zoomH)*0.03)},600);
      selectedPlot=ec[0];showTerritoryInfo(ec[0]);
    };
    // Sub-list for merged territories (expandable)
    if(ec.length>1){
      var subList=document.createElement('div');
      subList.style.cssText='display:none;border-top:1px solid rgba(255,120,60,.1);padding:2px 0';
      ec.forEach(function(sc,si){
        var sub=document.createElement('div');
        sub.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:3px 12px 3px 16px;cursor:pointer;font-size:9px;color:var(--tx3)';
        sub.onmouseenter=function(){sub.style.background='rgba(255,120,60,.1)'};
        sub.onmouseleave=function(){sub.style.background='transparent'};
        var sw=sc.w||sc.size||10, sh=sc.h||sc.size||10;
        sub.innerHTML='<span>↳ '+sc.lat.toFixed(1)+'°, '+sc.lng.toFixed(1)+'° ('+sw+'×'+sh+')</span><span style="color:var(--gold)">'+(sc.price||0)+' PP</span>';
        sub.onclick=function(e){
          e.stopPropagation();
          globe.pointOfView({lat:sc.lat,lng:sc.lng,altitude:Math.max(0.4,Math.max(sw,sh)*0.006)},600);
          selectedPlot=sc;showTerritoryInfo(sc);
        };
        subList.appendChild(sub);
      });
      d.appendChild(subList);
      // Toggle expand on main row click with alt or second click
      var expandBtn=document.createElement('span');
      expandBtn.textContent='▸';
      expandBtn.style.cssText='font-size:10px;color:var(--tx3);cursor:pointer;padding:0 4px;flex-shrink:0';
      mainRow.insertBefore(expandBtn,mainRow.firstChild);
      expandBtn.onclick=function(e){
        e.stopPropagation();
        var vis=subList.style.display==='none';
        subList.style.display=vis?'block':'none';
        expandBtn.textContent=vis?'▾':'▸';
      };
    }
    listEl.appendChild(d);
  });
  // ── BASE 탭 territory 목록도 업데이트 ──
  _updateBaseTerritoryGroupList(grpList);
}

function _updateBaseTerritoryGroupList(grpList){
  var baseList=document.getElementById('baseTerritoryGroupList');
  var badgeEl=document.getElementById('baseTerritoryCountBadge');
  if(!baseList) return;
  var myAddr=(walletState&&walletState.address)||'';
  if(!grpList) grpList=_myTerritoryGroups(myAddr);
  if(badgeEl) badgeEl.textContent=grpList.length;
  if(grpList.length===0){
    baseList.innerHTML='<div style="color:var(--tx3);font-size:10px;text-align:center;padding:16px">'+(LANG==='ko'?'영토가 없습니다. 지도에서 영토를 구매하세요.':LANG==='ja'?'領土がありません。地図で領土を購入してください。':LANG==='zh'?'没有领地。请在地图上购买领地。':'No territory. Buy territory on the map.')+'</div>';
    return;
  }
  // 기존 확장 상태 유지 (새로고침 시 닫힘)
  if(!window._baseTerritoryExpanded) window._baseTerritoryExpanded={};
  var html='';
  grpList.forEach(function(g,i){
    var anyForSale=g.claims.some(function(c){return _forSaleMap&&_forSaleMap[c.id];});
    var saleStyle=anyForSale?'border-color:rgba(76,216,154,.4);':'';
    var saleBadge=anyForSale?'<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:rgba(76,216,154,.15);border:1px solid rgba(76,216,154,.3);color:#4cd89a;font-weight:700;margin-left:4px">'+(LANG==='ko'?'판매중':LANG==='ja'?'販売中':LANG==='zh'?'出售中':'For Sale')+'</span>':'';
    var imgBadge=g.hasImg?'<span style="font-size:12px">📷</span>':'<span style="font-size:12px;opacity:.4">🏴</span>';
    var merged=g.claims.length>1?'<span style="font-size:9px;color:var(--gold);margin-left:3px">('+g.claims.length+(LANG==='ko'?'개':LANG==='ja'?'個':LANG==='zh'?'个':'')+')</span>':'';
    var name=g.claims.map(function(c){return c.customName||c.custom_name;}).filter(Boolean)[0]||null;
    var displayName=name?('<span style="font-weight:700;color:var(--tx)">'+name+'</span>'):('<span style="color:var(--tx2)">'+g.centerLat.toFixed(1)+'°, '+g.centerLng.toFixed(1)+'°</span>');
    var isOpen=!!window._baseTerritoryExpanded[i];
    var toggleIcon=isOpen?'▼':'▶';
    html+='<div style="border-radius:8px;border:1px solid rgba(255,120,60,.15);overflow:hidden;'+saleStyle+'">';
    // 헤더 행 (클릭 → 아코디언 토글)
    html+='<div onclick="_baseTerritoryAccordion('+i+')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,120,60,.06);cursor:pointer;transition:background .15s" onmouseenter="this.style.background=\'rgba(255,120,60,.14)\'" onmouseleave="this.style.background=\'rgba(255,120,60,.06)\'">';
    html+='<span style="font-size:20px;min-width:26px;text-align:center">'+imgBadge+'</span>';
    html+='<div style="flex:1;min-width:0">';
    html+='<div style="font-size:12px;margin-bottom:2px">'+displayName+merged+saleBadge+'</div>';
    html+='<div style="font-size:10px;color:var(--tx3)">'+g.totalPx+' px</div>';
    html+='</div>';
    html+='<span id="bterrToggle'+i+'" style="font-size:10px;color:var(--mars);min-width:14px;text-align:center">'+toggleIcon+'</span>';
    html+='</div>';
    // 아코디언 본문
    html+='<div id="bterrBody'+i+'" style="display:'+(isOpen?'block':'none')+';background:rgba(0,0,0,.18);padding:10px 14px 12px">';
    html+='<div id="bterrProd'+i+'" style="font-size:9px;color:var(--tx2);line-height:1.7">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読み込み中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
    var claimId=g.claims[0]&&g.claims[0].id;
    html+='<button type="button" onclick="event.stopPropagation();_baseTerritoryHarvest('+i+')" style="flex:1;min-width:60px;font-size:10px;padding:6px 8px;border-radius:6px;background:rgba(255,171,64,.12);border:1px solid rgba(255,171,64,.3);color:#ffab40;cursor:pointer">⛏ '+(LANG==='ko'?'수확':LANG==='ja'?'採掘':LANG==='zh'?'采掘':'Harvest')+'</button>';
    html+='<button type="button" onclick="event.stopPropagation();_baseTerritoryShield('+i+')" style="flex:1;min-width:60px;font-size:10px;padding:6px 8px;border-radius:6px;background:rgba(91,184,232,.08);border:1px solid rgba(91,184,232,.25);color:var(--cyan,#5bb8e8);cursor:pointer">🛡 '+(LANG==='ko'?'보호막':LANG==='ja'?'シールド':LANG==='zh'?'护盾':'Shield')+'</button>';
    html+='<button type="button" onclick="event.stopPropagation();_baseTerritoryUpgrade('+i+')" style="flex:1;min-width:60px;font-size:10px;padding:6px 8px;border-radius:6px;background:rgba(187,134,252,.08);border:1px solid rgba(187,134,252,.25);color:#bb86fc;cursor:pointer">🔧 '+(LANG==='ko'?'업그레이드':LANG==='ja'?'アップグレード':LANG==='zh'?'升级':'Upgrade')+'</button>';
    html+='<button type="button" onclick="event.stopPropagation();_baseTerritoryGlobe('+i+')" style="font-size:10px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--tx3);cursor:pointer">🌐 '+(LANG==='ko'?'지도':LANG==='ja'?'マップ':LANG==='zh'?'地图':'Map')+'</button>';
    html+='</div>';
    html+='</div>';
    html+='</div>';
  });
  baseList.innerHTML=html;
  window._baseTerritoryGroups=grpList;
  // 이미 열린 항목이 있으면 production 로드
  grpList.forEach(function(g,i){
    if(window._baseTerritoryExpanded[i]) _bterrLoadProd(i,g);
  });
}

function _baseTerritoryAccordion(idx){
  var grpList=window._baseTerritoryGroups||[];
  var g=grpList[idx];
  if(!g) return;
  if(!window._baseTerritoryExpanded) window._baseTerritoryExpanded={};
  var isOpen=!!window._baseTerritoryExpanded[idx];
  var body=document.getElementById('bterrBody'+idx);
  var toggle=document.getElementById('bterrToggle'+idx);
  if(isOpen){
    window._baseTerritoryExpanded[idx]=false;
    if(body) body.style.display='none';
    if(toggle) toggle.textContent='▶';
  } else {
    window._baseTerritoryExpanded[idx]=true;
    if(body) body.style.display='block';
    if(toggle) toggle.textContent='▼';
    _bterrLoadProd(idx,g);
  }
}

function _bterrLoadProd(idx,g){
  var prodEl=document.getElementById('bterrProd'+idx);
  if(!prodEl) return;
  var wallet=(walletState&&walletState.address)||'';
  var claimId=g.claims[0]&&g.claims[0].id;
  if(!claimId||!wallet){prodEl.textContent='—';return;}
  prodEl.textContent=LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…';
  fetch('/api/territory/'+claimId+'/production', { headers: marsAuthHeaders() })
    .then(function(r){return r.json();})
    .then(function(d){
      if(!document.getElementById('bterrProd'+idx)) return; // 이미 닫힘
      if(d.error){prodEl.textContent=LANG==='ko'?'생산 정보 없음':LANG==='ja'?'生産情報なし':LANG==='zh'?'无生产信息':'No production data';return;}
      var html='';
      // [v7.203] BASE > 내 영토 카드에 HP/등급 표시 — 사이드 패널/모달엔 있었는데 이 리스트엔 누락.
      //   condition(HP) 0~100 + grade S/A/B/C/D/F + TEND 버튼 한 줄. 정비도 카드 안에서 가능.
      if(typeof d.condition!=='undefined'){
        var cond=Math.max(0,Math.min(100,parseFloat(d.condition)||0));
        var grade=d.grade||'B';
        var gColor=({S:'#69f0ae',A:'#7cf0ff',B:'#ffd700',C:'#ffab40',D:'#ff8a65',F:'#ff5252'})[grade]||'#ffd700';
        var barColor=cond>=60?'#69f0ae':cond>=30?'#ffab40':'#ff5252';
        html+='<div style="margin-bottom:6px;padding:6px 8px;background:rgba(255,255,255,.03);border:1px solid '+gColor+'33;border-radius:6px">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
        html+='<span style="color:var(--tx3);font-size:9px">'+(LANG==='ko'?'영토 상태 (HP)':LANG==='ja'?'領土状態(HP)':LANG==='zh'?'领土状态(HP)':'Condition (HP)')+'</span>';
        html+='<span style="display:flex;align-items:center;gap:5px">';
        html+='<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:8px;color:'+gColor+';border:1px solid '+gColor+'66;background:'+gColor+'1a">'+grade+'</span>';
        html+='<span style="color:'+barColor+';font-weight:700;font-size:10px">'+cond.toFixed(0)+'/100</span>';
        html+='</span></div>';
        html+='<div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+cond+'%;background:'+barColor+';transition:width .3s"></div></div>';
        if (cond < 100) {
          html+='<button type="button" onclick="event.stopPropagation();tendTerritory('+claimId+',\''+(wallet||'').replace(/\047/g,"\\\047")+'\')" style="margin-top:5px;width:100%;font-size:9px;padding:5px;background:rgba(105,240,174,.1);border:1px solid rgba(105,240,174,.3);border-radius:5px;color:#69f0ae;cursor:pointer;font-family:var(--fn)">'+(LANG==='ko'?'🔧 정비하기':LANG==='ja'?'🔧 整備する':LANG==='zh'?'🔧 维护':'🔧 TEND')+'</button>';
        }
        html+='</div>';
      }
      var ppMin=d.production&&d.production.ppMin||0;
      var ppMax=d.production&&d.production.ppMax||0;
      if(ppMin>0||ppMax>0){
        html+='<div style="display:flex;justify-content:space-between">';
        html+='<span style="color:var(--tx3)">'+(LANG==='ko'?'예상 PP 수확':LANG==='ja'?'予想PP収穫':LANG==='zh'?'预期PP收获':'Est. PP Harvest')+'</span>';
        html+='<span style="color:#ffab40;font-weight:700">'+ppMin.toFixed(4)+'~'+ppMax.toFixed(4)+'</span>';
        html+='</div>';
      }
      if(d.sector&&d.sector.type){
        var sLabel=LANG==='ko'?{core:'코어',mid:'미드',frontier:'프론티어'}:LANG==='ja'?{core:'コア',mid:'ミッド',frontier:'フロンティア'}:LANG==='zh'?{core:'核心',mid:'中域',frontier:'边疆'}:{core:'Core',mid:'Mid',frontier:'Frontier'};
        var sectorMult=d.production&&d.production.sectorMult?parseFloat(d.production.sectorMult):0;
        html+='<div style="display:flex;justify-content:space-between">';
        html+='<span style="color:var(--tx3)">'+(LANG==='ko'?'섹터':LANG==='ja'?'セクター':LANG==='zh'?'扇区':'Sector')+'</span>';
        html+='<span style="color:var(--tx2)">'+(sLabel[d.sector.type]||d.sector.type)+(sectorMult?(' ×'+sectorMult.toFixed(2)):'')+'</span>';
        html+='</div>';
      }
      if(d.lastHarvest&&d.lastHarvest.at){
        var ago=_timeAgo(new Date(d.lastHarvest.at));
        html+='<div style="display:flex;justify-content:space-between">';
        html+='<span style="color:var(--tx3)">'+(LANG==='ko'?'최근 수확':LANG==='ja'?'最終採掘':LANG==='zh'?'最近采掘':'Last Harvest')+'</span>';
        html+='<span style="color:var(--tx2)">'+d.lastHarvest.pp.toFixed(4)+' PP · '+ago+'</span>';
        html+='</div>';
      } else {
        html+='<div style="color:var(--tx3)">'+(LANG==='ko'?'아직 수확 없음':LANG==='ja'?'採掘記録なし':LANG==='zh'?'暂无采掘记录':'No harvest yet')+'</div>';
      }
      if(d.materials&&d.materials.length){
        html+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">';
        d.materials.forEach(function(m){
          var rarityColor={'common':'var(--tx2)','rare':'#64b5f6','special':'#ffb74d','legendary':'#ce93d8'}[m.rarity]||'var(--tx2)';
          var name=m.nameKo||m.nameEn;
          html+='<span style="font-size:8px;padding:1px 5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:'+rarityColor+'">'+m.icon+' '+name+'</span>';
        });
        html+='</div>';
      }
      prodEl.innerHTML=html||'<span style="color:var(--tx3)">'+(LANG==='ko'?'생산 정보 없음':LANG==='ja'?'生産情報なし':LANG==='zh'?'无生产信息':'No production data')+'</span>';
    })
    .catch(function(){if(document.getElementById('bterrProd'+idx)) document.getElementById('bterrProd'+idx).textContent=LANG==='ko'?'오류':LANG==='ja'?'エラー':LANG==='zh'?'错误':'Error';});
}

// 내 영토 목록에서 빠른 액션
async function _baseTerritoryHarvest(idx){
  var grpList=window._baseTerritoryGroups||[];
  var g=grpList[idx];
  if(!g||!g.claims||!g.claims.length) return;
  var wallet=(walletState&&walletState.address)||'';
  if(!wallet){showToast(LANG==='ko'?'로그인이 필요합니다':LANG==='ja'?'ログインが必要です':LANG==='zh'?'请先登录':'Login required','warn');return;}
  // 버튼 비활성화
  var btns=document.querySelectorAll('#bterrBody'+idx+' button');
  btns.forEach(function(b){b.disabled=true;});
  try{_sfx&&_sfx.click&&_sfx.click();}catch(_){}
  var prodEl=document.getElementById('bterrProd'+idx);
  if(prodEl) prodEl.textContent=LANG==='ko'?'수확 중…':LANG==='ja'?'収穫中…':LANG==='zh'?'收获中…':'Harvesting…';
  // [v7.320] 그룹(병합 영토)의 모든 claim을 순회 수확 (이전엔 claims[0] 하나만 수확 → "안 누른 영토 수확 안됨"). 보상은 GP.
  var harvested=0, cooldown=0, totalGP=0, allDrops={}, nextTimeStr='';
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth&&emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    for(var ci=0; ci<g.claims.length; ci++){
      try{
        var resp=await fetch('/api/territory/'+g.claims[ci].id+'/harvest',{method:'POST',headers:headers,body:JSON.stringify({wallet:wallet})});
        var d=await resp.json();
        if(resp.ok&&d.success){
          harvested++; totalGP+=(d.harvestedGP!=null?d.harvestedGP:0);
          if(d.resources){ d.resources.forEach(function(x){ allDrops[x.code]=(allDrops[x.code]||0)+x.quantity; }); }
        } else if(resp.status===429){
          cooldown++;
          if(d.nextHarvestAt&&!nextTimeStr){ var nxt=new Date(d.nextHarvestAt),diffMs=nxt-Date.now(),hrs=Math.floor(diffMs/3600000),mins=Math.floor((diffMs%3600000)/60000); nextTimeStr=(hrs>0?hrs+'h ':'')+mins+'m'; }
        }
      }catch(e){}
    }
    if(harvested===0){
      if(cooldown>0){
        showToast((LANG==='ko'?('쿨다운 중'+(nextTimeStr?' — '+nextTimeStr+' 후 가능':'')):LANG==='ja'?'クールダウン中':LANG==='zh'?'冷却中':('On cooldown'+(nextTimeStr?' — '+nextTimeStr:''))),'warn');
        if(prodEl) prodEl.innerHTML='<span style="color:var(--tx3)">'+(LANG==='ko'?'다음 수확: ':LANG==='ja'?'次の収穫: ':LANG==='zh'?'下次收获: ':'Next harvest: ')+nextTimeStr+'</span>';
      } else {
        showToast((LANG==='ko'?'수확 실패':LANG==='ja'?'収穫失敗':LANG==='zh'?'收获失败':'Harvest failed'),'error');
        if(prodEl) prodEl.textContent=LANG==='ko'?'수확 실패':LANG==='ja'?'収穫失敗':LANG==='zh'?'收获失败':'Harvest failed';
      }
      btns.forEach(function(b){b.disabled=false;});
      return;
    }
    try{_sfx&&_sfx.success&&_sfx.success();}catch(_){}
    totalGP=Math.round(totalGP*10000)/10000;
    var resStr='';
    var dk=Object.keys(allDrops);
    if(dk.length){
      var _RICONS={iron_dust:'🟤',red_sand:'🔴',basalt_chip:'⬛',ice_crystal:'🔵',regolith_ore:'🟠',volcanic_shard:'🌋',ancient_metal:'⭐',carbon_fiber:'🧵',iron_ore:'🪨',silicon_chip:'💠',xenomatter:'💠',nano_polymer:'🧬',plasma_crystal:'🔮',titanium_alloy:'⚙️',meteorite_fragment:'☄️',plasma_dust:'💜',dark_matter:'🌑',exotic_alloy:'✨',quantum_core:'⚡',alloy_frame:'⬢',hull_plate:'▣',plasma_coil:'⚡'};
      resStr=' + '+dk.map(function(c){return (_RICONS[c]||'💠')+allDrops[c];}).join(' ');
    }
    showToast('⛏ +'+totalGP+' GP'+(cooldown>0?' · '+cooldown+(LANG==='ko'?' 쿨다운':' cd'):'')+resStr,'success');
    // 수확 후 생산 정보 새로고침
    _bterrLoadProd(idx,g);
    // PP 잔액 갱신
    try{if(typeof refreshPP==='function') refreshPP();}catch(_){}
  } catch(e){
    showToast(LANG==='ko'?'네트워크 오류':LANG==='ja'?'ネットワークエラー':LANG==='zh'?'网络错误':'Network error','error');
    if(prodEl) _bterrLoadProd(idx,g);
  } finally {
    btns.forEach(function(b){b.disabled=false;});
  }
}
function _baseTerritoryShield(idx){
  var grpList=window._baseTerritoryGroups||[];
  var g=grpList[idx];
  if(!g||!g.claims||!g.claims.length) return;
  selectedPlot=g.claims[0];
  closeBaseModal();
  showTerritoryInfo(g.claims[0]);
  setTimeout(function(){ openShieldModal(); },350);
}
function _baseTerritoryUpgrade(idx){
  var grpList=window._baseTerritoryGroups||[];
  var g=grpList[idx];
  if(!g||!g.claims||!g.claims.length) return;
  var claim=g.claims[0];
  selectedPlot=claim;
  // [v7.205] BASE 모달 → 사이드바 열기 폐기 → 영토 업그레이드 전용 모달.
  //   BASE 모달은 유지 (닫으면 사용자가 다시 열어야 해서 번거로움). 위에 업그레이드 모달이 z-index 10500 으로 덮음.
  if (typeof openTerritoryUpgradeModal === 'function') {
    openTerritoryUpgradeModal(claim.id || claim.claimId, claim);
  }
}
function _baseTerritoryGlobe(idx){
  var grpList=window._baseTerritoryGroups||[];
  var g=grpList[idx];
  if(!g||!g.claims||!g.claims.length) return;
  var ec=g.claims;
  var b=_ownerGroups[(walletState&&walletState.address)||'']?_ownerGroups[(walletState&&walletState.address)||''].find(function(og){return og.claimIndices.some(function(ci){return claims[ci]&&claims[ci].id===ec[0].id;});}):{bounds:null};
  var zoomW=b&&b.bounds?(b.bounds.maxLng-b.bounds.minLng):((ec[0].w||10)*0.22);
  var zoomH=b&&b.bounds?(b.bounds.maxLat-b.bounds.minLat):((ec[0].h||10)*0.22);
  closeBaseModal();
  if(globe) globe.pointOfView({lat:g.centerLat,lng:g.centerLng,altitude:Math.max(0.4,Math.max(zoomW,zoomH)*0.03)},600);
  selectedPlot=ec[0];
  showTerritoryInfo(ec[0]);
}

function _baseTerritoryTap(idx){
  _baseTerritoryAccordion(idx);
}

function loadNasa8k(){
  cacheImage(NASA_MARS_8K,function(img){
    if(!img) return;
    nasa8kLoaded=true;
    console.log('[Mars] 8K NASA texture loaded');
    if(currentTexMode==='nasa'&&globe){
      // Re-composite claims on top of 8K instead of raw replacement
      marsCanvasTexture=null; claimsSnapshot=null;
      compositeClaimsOnTexture();
    }
  });
}

// Start async pipeline
_initStep1();

/* ── Performance Utilities ─────────────────────────── */
function _debounce(fn,ms){var t;return function(){var a=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,a);},ms);};}
function _raf(fn){var p=false;return function(){if(!p){p=true;requestAnimationFrame(function(){p=false;fn();});}};}

/* ── Territory Data ──────────────────────────────── */
var PIXEL_PRICE=0.1;       // $0.1 per pixel (fallback)
var HIJACK_MULT=1.2;
var SECTOR_PRICES={core:0.15, mid:0.05, frontier:0.02}; // updated from server config
var GRID_SIZE=0.22;        // 0.22° per pixel-cell (must match server)
// lat ±70° = 140° / 0.22 ≈ 636 rows
// lng ±180° = 360° / 0.22 ≈ 1636 cols
// Total ≈ 1,040,000 PIXELS
// Price: $0.1/px → 1×1=$0.1, 10×10=$10, 100×100=$1000

var claims=[];

// ── 내 영토 그룹 목록 (BASE 내 영토 탭과 동일 로직) ─────────────────────────
// 반환: [{claims:[...], centerLat, centerLng, totalPx, label, primaryId, hasImg}]
function _myTerritoryGroups(wallet){
  wallet=(wallet||'').toLowerCase();
  var myGroups=_ownerGroups[wallet]||[];
  var result=[];
  if(myGroups.length>0){
    myGroups.forEach(function(grp,i){
      var ec=grp.claimIndices.map(function(ci){return claims[ci];}).filter(Boolean);
      if(!ec.length) return;
      var b=grp.bounds;
      var centerLat=b&&b.minLat!==Infinity?(b.minLat+b.maxLat)/2:ec[0].lat;
      var centerLng=b&&b.minLng!==Infinity?(b.minLng+b.maxLng)/2:ec[0].lng;
      var totalPx=(b&&b.count>0)?b.count:ec.reduce(function(s,c){return s+((c.w||c.width||1)*(c.h||c.height||1));},0);
      var mergedSuffix=ec.length>1?' ('+ec.length+(LANG==='ko'?'개':LANG==='ja'?'個':LANG==='zh'?'个':'')+')':'';
      var name=ec.map(function(c){return c.customName||c.custom_name;}).filter(Boolean)[0]||null;
      var label=(name||(centerLat.toFixed(1)+'°, '+centerLng.toFixed(1)+'°'))+mergedSuffix+' · '+totalPx+'px';
      var hasImg=ec.some(function(c){return c.imgUrl||c.image_url;});
      result.push({claims:ec,centerLat:centerLat,centerLng:centerLng,totalPx:totalPx,label:label,primaryId:ec[0].id,hasImg:hasImg});
    });
  } else {
    var myClaims=(window.claims||[]).filter(function(c){return (c.owner||'').toLowerCase()===wallet;});
    myClaims.forEach(function(c){
      var px=(c.w||c.width||1)*(c.h||c.height||1);
      var label=(c.customName||c.custom_name||(c.lat.toFixed(1)+'°, '+c.lng.toFixed(1)+'°'))+' · '+px+'px';
      result.push({claims:[c],centerLat:c.lat,centerLng:c.lng,totalPx:px,label:label,primaryId:c.id,hasImg:!!(c.imgUrl||c.image_url)});
    });
  }
  return result;
}

// Image cache for instant recomposite
var imgCache={};
var _imgRetry={};
var _imgFailed={};
function _shouldUseCrossOrigin(url){
  try{
    var u=new URL(url, window.location.href);
    return /^https?:$/.test(u.protocol) && u.origin!==window.location.origin;
  }catch(_e){
    return false;
  }
}
function _setImageCrossOriginIfNeeded(img,url){
  if(_shouldUseCrossOrigin(url)){
    try{ img.crossOrigin='anonymous'; }catch(_ce){}
  }
}
function cacheImage(url,cb){
  if(!url){cb&&cb(null);return}
  if(imgCache[url]){cb&&cb(imgCache[url]);return}
  var img=new Image();
  _setImageCrossOriginIfNeeded(img,url);
  img.onload=function(){
    // Sanity check: ensure image has dimensions
    if(!img.width || !img.height){
      console.warn('[cacheImage] Image loaded with zero dimensions:', url);
      cb&&cb(null);
      return;
    }
    imgCache[url]=img;delete _imgRetry[url];delete _imgFailed[url];cb&&cb(img);
  };
  img.onerror=function(){
    console.warn('[cacheImage] Image load failed:', url);
    _imgFailed[url]=true;
    // Retry up to 3 times with delay
    var rc=(_imgRetry[url]||0)+1;
    _imgRetry[url]=rc;
    if(rc<=3){
      function retryImage(){
        var r=new Image();
        _setImageCrossOriginIfNeeded(r,url);
        r.onload=function(){
          if(!r.width||!r.height){return;}
          imgCache[url]=r;delete _imgRetry[url];delete _imgFailed[url];claimsSnapshot=null;compositeClaimsOnTexture();
        };
        r.onerror=function(){
          var next=(_imgRetry[url]||0)+1;
          _imgRetry[url]=next;
          if(next<=3) _setActiveTimeout(retryImage,next*2000);
        };
        r.src=url+'?retry='+rc;
      }
      _setActiveTimeout(retryImage,rc*1500);
    }
    cb&&cb(null);
  };
  img.src=url;
}

/* ── Pixel Grid: per-pixel price/owner tracking ── */
// Key = "lat,lng" (grid-snapped) → {owner, price, claimIdx}
var pixelGrid={};

function pxKey(lat,lng){ return (Math.round(lat*100)/100)+','+(Math.round(lng*100)/100); }

// Get all pixel coords covered by a claim (center lat/lng, w cells, h cells)
function getClaimPixels(lat,lng,w,h){
  var pixels=[];
  var gs=GRID_SIZE;
  var gsI=Math.round(gs*100); // integer grid step (22 for 0.22)
  var halfW=(w*gs)/2, halfH=(h*gs)/2;
  var minLat=lat-halfH, maxLat=lat+halfH;
  var minLng=lng-halfW, maxLng=lng+halfW;
  // Use integer math to avoid floating-point accumulation errors
  var startLatI=Math.ceil(Math.round(minLat*100)/gsI)*gsI;
  var startLngI=Math.ceil(Math.round(minLng*100)/gsI)*gsI;
  var maxLatI=Math.round(maxLat*100);
  var maxLngI=Math.round(maxLng*100);
  for(var iLat=startLatI;iLat<maxLatI;iLat+=gsI){
    for(var iLng=startLngI;iLng<maxLngI;iLng+=gsI){
      var sLat=iLat/100, sLng=iLng/100;
      if(sLat>=-70&&sLat<=70) pixels.push({lat:sLat,lng:sLng});
    }
  }
  return pixels;
}

// Register a claim's pixels into the grid
function registerClaimPixels(claim,idx){
  var cw=claim.w||claim.size||10, ch=claim.h||claim.size||10;
  var pixels=getClaimPixels(claim.lat,claim.lng,cw,ch);
  var pricePerPx=claim.price/(cw*ch);
  pixels.forEach(function(p){
    var k=pxKey(p.lat,p.lng);
    pixelGrid[k]={owner:claim.owner,price:pricePerPx,claimIdx:idx};
  });
}

// Calculate cost for placing stamp at position, with overlap detection
// Find pixel price based on sector tier
// 현재 유저 레벨로 진입 불가한 섹터를 반환 (없으면 null)
function _getBlockedSector(lat,lng){
  var myLevel=parseInt((document.getElementById('profileLevel')||{}).textContent||'1')||1;
  for(var i=0;i<_sectorsData.length;i++){
    var s=_sectorsData[i];
    var b=s.bounds;
    if(!b) continue;
    if(lat<b.latMin||lat>b.latMax||lng<b.lngMin||lng>b.lngMax) continue;
    var poly=s.polygon;
    var inside=false;
    if(poly&&poly.length>=3){
      for(var pi=0,pj=poly.length-1;pi<poly.length;pj=pi++){
        var xi=poly[pi][0],yi=poly[pi][1],xj=poly[pj][0],yj=poly[pj][1];
        if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
      }
    }else{ inside=true; }
    if(inside){
      var entryActive=(s.entryCheckActive!==false);
      var entryMin=s.entryMinLevel||0;
      if(entryActive&&entryMin>0&&myLevel<entryMin) return s;
      return null; // 해당 섹터 안에 있지만 차단 안됨
    }
  }
  return null; // 어떤 섹터도 해당 없음
}

function _getSectorPixelPrice(lat,lng){
  for(var i=0;i<_sectorsData.length;i++){
    var s=_sectorsData[i];
    var b=s.bounds;
    if(!b) continue;
    if(lat<b.latMin||lat>b.latMax||lng<b.lngMin||lng>b.lngMax) continue;
    var poly=s.polygon;
    if(poly&&poly.length>=3){
      // Point-in-polygon (ray casting)
      var inside=false;
      for(var pi=0,pj=poly.length-1;pi<poly.length;pj=pi++){
        var xi=poly[pi][0],yi=poly[pi][1],xj=poly[pj][0],yj=poly[pj][1];
        if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
      }
      if(inside) return SECTOR_PRICES[s.tier]||PIXEL_PRICE;
    }else{
      return SECTOR_PRICES[s.tier]||PIXEL_PRICE;
    }
  }
  return PIXEL_PRICE;
}

function calcStampCost(lat,lng,w,h){
  var pixels=getClaimPixels(lat,lng,w,h);
  var baseCost=0, hijackCost=0, overlapCount=0, newCount=0, ownSkipCount=0;
  var affectedOwners={}; // owner → {refund, bonus}
  var myAddr=(walletState.address||'').toLowerCase();
  pixels.forEach(function(p){
    var k=pxKey(p.lat,p.lng);
    var existing=pixelGrid[k];
    if(existing&&existing.owner){
      if(myAddr&&existing.owner.toLowerCase()===myAddr){
        // Own pixel — skip (no cost, no battle)
        ownSkipCount++;
      }else{
        // Enemy pixel: 1.2× max(existing price, sector base price)
        // NPC/free claims have existing.price=0 → would make hijack free, which is wrong.
        // Floor to sector base price so hijack always costs at least the new-claim rate × HIJACK_MULT.
        var basePxPrice = _getSectorPixelPrice(p.lat, p.lng);
        var refPrice = Math.max(parseFloat(existing.price)||0, basePxPrice);
        var pxCost = refPrice * HIJACK_MULT;
        hijackCost+=pxCost;
        overlapCount++;
        if(!affectedOwners[existing.owner]) affectedOwners[existing.owner]={refund:0,bonus:0};
        affectedOwners[existing.owner].refund+=parseFloat(existing.price)||0;
        affectedOwners[existing.owner].bonus+=(pxCost-(parseFloat(existing.price)||0))*0.5;
      }
    }else{
      baseCost+=_getSectorPixelPrice(p.lat,p.lng);
      newCount++;
    }
  });
  return {
    total:Math.round((baseCost+hijackCost)*100)/100,
    baseCost:Math.round(baseCost*100)/100,
    hijackCost:Math.round(hijackCost*100)/100,
    overlapCount:overlapCount,
    newCount:newCount,
    ownSkipCount:ownSkipCount,
    totalPixels:pixels.length,
    affectedOwners:affectedOwners
  };
}

// Initialize pixelGrid from existing claims (fallback)
function initPixelGrid(){
  pixelGrid={};
  claims.forEach(function(c,i){registerClaimPixels(c,i)});
  // Re-overlay server pixels if available (they have authoritative ownership)
  for(var k in _serverPixels){ pixelGrid[k]=_serverPixels[k]; }
  _rebuildOwnerData();
}
// Build pixelGrid from authoritative server pixel data
function initPixelGridFromServer(byOwner){
  // Start from claims-based grid (fills all claim rectangles) — used for click detection
  pixelGrid={};
  claims.forEach(function(c,i){registerClaimPixels(c,i)});
  // Overlay authoritative server pixel data (overrides where battles changed ownership)
  var claimIdMap={};
  claims.forEach(function(c,i){ if(c.id) claimIdMap[c.id]=i; });
  // Build server-only pixel set for strip rendering (avoids GRID_SIZE=0.1 noise)
  _serverPixels={};
  for(var owner in byOwner){
    var pxArr=byOwner[owner];
    for(var i=0;i<pxArr.length;i++){
      var p=pxArr[i]; // [lat, lng, claimId, price]
      var k=pxKey(p[0],p[1]);
      var entry={owner:owner, price:p[3], claimIdx:claimIdMap[p[2]]!==undefined?claimIdMap[p[2]]:-1, claimId:p[2]};
      pixelGrid[k]=entry;
      _serverPixels[k]=entry;
    }
  }
  _rebuildOwnerData();
}
var _pixelsLoaded=false;
// Global owner territory data (rebuilt when pixelGrid changes)
var _globalOwnerStrips={};
var _globalOwnerStripsByLat={};
var _ownerTerritoryCache={};
var _actualGridStep=GRID_SIZE; // detected from actual pixel data
var _serverPixels={}; // server-authoritative pixels only (0.22 spacing)

// Connected component grouping for same-owner claims
var _ownerGroups={}; // owner → [{claimIndices, bounds, count, strips, stripsByLat}]
function _rebuildOwnerData(){
  _ownerTerritoryCache={};
  _globalOwnerStrips={};
  _globalOwnerStripsByLat={};
  _ownerGroups={};

  // Step 1: Build strips per owner — use server pixels only (correct spacing)
  var pixelSource=Object.keys(_serverPixels).length>0?_serverPixels:pixelGrid;
  var byOL={}; // owner → latS → [lng, ...]
  for(var k in pixelSource){
    var pv=pixelSource[k];
    if(!pv||!pv.owner) continue;
    var sep=k.indexOf(',');
    var latS=k.substring(0,sep), lng=parseFloat(k.substring(sep+1));
    var lat=parseFloat(latS);
    var o=pv.owner;
    if(!_ownerTerritoryCache[o]) _ownerTerritoryCache[o]={minLat:Infinity,maxLat:-Infinity,minLng:Infinity,maxLng:-Infinity,count:0};
    var t=_ownerTerritoryCache[o];
    if(lat<t.minLat) t.minLat=lat;
    if(lat>t.maxLat) t.maxLat=lat;
    if(lng<t.minLng) t.minLng=lng;
    if(lng>t.maxLng) t.maxLng=lng;
    t.count++;
    if(!byOL[o]) byOL[o]={};
    if(!byOL[o][latS]) byOL[o][latS]=[];
    byOL[o][latS].push(lng);
  }
  // Use constant grid step — dynamic detection was fragile and caused image position jumps
  _actualGridStep=GRID_SIZE;

  var gs=_actualGridStep;
  for(var owner in byOL){
    var strips=[],byLat={};
    for(var latS in byOL[owner]){
      var lat=parseFloat(latS);
      var lngs=byOL[owner][latS].sort(function(a,b){return a-b});
      var lk=Math.round(lat*100);
      if(!byLat[lk]) byLat[lk]=[];
      var i=0;
      while(i<lngs.length){
        var s0=lngs[i],e0=s0,j=i+1;
        while(j<lngs.length&&lngs[j]-e0<gs*2.5){e0=lngs[j];j++;}
        var st={lat:lat,lng1:s0,lng2:e0};
        strips.push(st);byLat[lk].push(st);
        i=j;
      }
    }
    _globalOwnerStrips[owner]=strips;
    _globalOwnerStripsByLat[owner]=byLat;
    // Detect actual lat step for this owner (for border adjacency lookup)
    var latKeys=Object.keys(byLat).map(Number).sort(function(a,b){return a-b});
    var _latStep=Math.round(gs*100); // default
    if(latKeys.length>=2){
      var gaps={};
      for(var li=1;li<Math.min(latKeys.length,20);li++){
        var g=latKeys[li]-latKeys[li-1];
        gaps[g]=(gaps[g]||0)+1;
      }
      var bestG=0,bestC=0;
      for(var gk in gaps){if(gaps[gk]>bestC){bestC=gaps[gk];bestG=parseInt(gk);}}
      if(bestG>0) _latStep=bestG;
    }
    byLat._latStep=_latStep;
  }

  // Step 2: Connected component grouping per owner (claim-level adjacency)
  for(var owner in _globalOwnerStrips){
    var ownerClaims=[];
    for(var ci=0;ci<claims.length;ci++){
      if(claims[ci].owner===owner) ownerClaims.push(ci);
    }
    if(ownerClaims.length<=1){
      // Single claim = single group — compute bounds from actual strips
      if(ownerClaims.length===1){
        var sStrips=_globalOwnerStrips[owner]||[];
        var sb={minLat:Infinity,maxLat:-Infinity,minLng:Infinity,maxLng:-Infinity,count:0};
        for(var ssi=0;ssi<sStrips.length;ssi++){
          var ss=sStrips[ssi];
          if(ss.lat<sb.minLat) sb.minLat=ss.lat;
          if(ss.lat>sb.maxLat) sb.maxLat=ss.lat;
          if(ss.lng1<sb.minLng) sb.minLng=ss.lng1;
          if(ss.lng2>sb.maxLng) sb.maxLng=ss.lng2;
          sb.count+=Math.round((ss.lng2-ss.lng1)/gs)+1;
        }
        if(sb.minLat===Infinity){
          // No actual pixels — skip group (all pixels hijacked)
          continue;
        }
        _ownerGroups[owner]=[{claimIndices:ownerClaims,bounds:sb}];
      }
      continue;
    }
    // Union-Find
    var parent={};
    ownerClaims.forEach(function(ci){parent[ci]=ci});
    function find(x){while(parent[x]!==x)x=parent[x]=parent[parent[x]];return x}
    function union(a,b){var ra=find(a),rb=find(b);if(ra!==rb)parent[ra]=rb}
    // Check adjacency: two claims are adjacent if their bounding boxes overlap or touch (within 1 grid cell)
    for(var i=0;i<ownerClaims.length;i++){
      var ci=claims[ownerClaims[i]];
      var cw1=(ci.w||ci.size||20)*gs/2, ch1=(ci.h||ci.size||20)*gs/2;
      for(var j=i+1;j<ownerClaims.length;j++){
        var cj=claims[ownerClaims[j]];
        var cw2=(cj.w||cj.size||20)*gs/2, ch2=(cj.h||cj.size||20)*gs/2;
        // Expand by 1 grid cell for adjacency
        var margin=gs*1.1;
        if(Math.abs(ci.lat-cj.lat)<ch1+ch2+margin && Math.abs(ci.lng-cj.lng)<cw1+cw2+margin){
          union(ownerClaims[i],ownerClaims[j]);
        }
      }
    }
    // Group by root
    var groups={};
    ownerClaims.forEach(function(ci){
      var r=find(ci);
      if(!groups[r]) groups[r]=[];
      groups[r].push(ci);
    });
    var groupArr=[];
    for(var r in groups){
      var gClaims=groups[r];
      // Compute bounds from actual pixel data (not claim rect math)
      // First: rough bounds from claim rects to filter strips
      var rough={minLat:Infinity,maxLat:-Infinity,minLng:Infinity,maxLng:-Infinity};
      gClaims.forEach(function(ci){
        var c=claims[ci];
        var cw=(c.w||c.size||20)*gs/2+gs, ch=(c.h||c.size||20)*gs/2+gs;
        if(c.lat-ch<rough.minLat) rough.minLat=c.lat-ch;
        if(c.lat+ch>rough.maxLat) rough.maxLat=c.lat+ch;
        if(c.lng-cw<rough.minLng) rough.minLng=c.lng-cw;
        if(c.lng+cw>rough.maxLng) rough.maxLng=c.lng+cw;
      });
      // Tight bounds from actual strips
      var b={minLat:Infinity,maxLat:-Infinity,minLng:Infinity,maxLng:-Infinity,count:0};
      var allStrips=_globalOwnerStrips[owner]||[];
      for(var si=0;si<allStrips.length;si++){
        var s=allStrips[si];
        if(s.lat>=rough.minLat&&s.lat<=rough.maxLat&&
           s.lng1>=rough.minLng&&s.lng2<=rough.maxLng){
          if(s.lat<b.minLat) b.minLat=s.lat;
          if(s.lat>b.maxLat) b.maxLat=s.lat;
          if(s.lng1<b.minLng) b.minLng=s.lng1;
          if(s.lng2>b.maxLng) b.maxLng=s.lng2;
          b.count+=Math.round((s.lng2-s.lng1)/gs)+1;
        }
      }
      // Skip groups with no actual pixels (all hijacked)
      if(b.minLat!==Infinity) groupArr.push({claimIndices:gClaims,bounds:b});
    }
    if(groupArr.length>0) _ownerGroups[owner]=groupArr;
  }
}
initPixelGrid();

// Pre-cache all demo images + base texture
function preCacheAndComposite(){
  var pending=0,total=0;
  claims.forEach(function(c){
    if(c.imgUrl){
      total++;pending++;
      cacheImage(c.imgUrl,function(){
        pending--;
        if(pending<=0) compositeClaimsOnTexture();
      });
    }
  });
  cacheImage(marsBaseData,function(){
    if(total===0) compositeClaimsOnTexture();
  });
}
preCacheAndComposite();

// Load server claims + authoritative pixel ownership
var _serverClaimsBootRetryId = null;
var _claimsSince=Date.now();
var CLAIMS_CURSOR_FUTURE_SKEW_MS = 60000;
function _normalizeClaimsCursor(ts){
  var n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  var max = Date.now() + CLAIMS_CURSOR_FUTURE_SKEW_MS;
  return Math.min(n, max);
}
function _rememberClaimsCursor(claim){
  if (!claim || claim.ts == null) return;
  var ts = _normalizeClaimsCursor(claim.ts);
  if (ts != null && ts > _claimsSince) _claimsSince = ts;
}
function _scheduleServerClaimsBootRetry(){
  if(_serverClaimsBootRetryId) return;
  var quietMs = (typeof _publicHudQuietRemainingMs === 'function') ? _publicHudQuietRemainingMs() : 0;
  var retryMs = quietMs > 0 ? Math.min(quietMs + 1000, 30000) : 3000;
  _serverClaimsBootRetryId = _setActiveTimeout(function(){
    _serverClaimsBootRetryId = null;
    loadServerClaims();
  }, retryMs);
}
function loadServerClaims(){
  Promise.all([
    _guardedJsonFetch('claims-initial', '/api/claims', {minGap:15000, backoffMs:120000, fetchOptions:{headers:marsAuthHeaders()}}),
    _guardedJsonFetch('pixels-initial', '/api/pixels', {minGap:30000, backoffMs:120000, fetchOptions:{headers:marsAuthHeaders()}})
  ]).then(function(results){
    var serverClaims=results[0], serverPixels=results[1];
    if(serverClaims===null&&serverPixels===null){
      _scheduleServerClaimsBootRetry();
      return;
    }
    if(serverClaims&&serverClaims.length){
      serverClaims.forEach(function(sc){ claims.push(sc); });
    }
    // Use authoritative pixel data if available
    if(serverPixels&&typeof serverPixels==='object'&&Object.keys(serverPixels).length>0){
      initPixelGridFromServer(serverPixels);
      _pixelsLoaded=true;
    }else{
      initPixelGrid();
    }
    // Cache images and re-composite
    var pending=0;
    claims.forEach(function(sc){
      if(sc.imgUrl&&!imgCache[sc.imgUrl]){
        pending++;
        cacheImage(sc.imgUrl,function(){
          pending--;
          if(pending<=0){claimsSnapshot=null;compositeClaimsOnTexture()}
        });
      }
    });
    if(pending===0){claimsSnapshot=null;compositeClaimsOnTexture()}
    if(serverClaims) serverClaims.forEach(_rememberClaimsCursor);
  }).catch(function(e){console.warn('[Claims] Failed to load:',e)});
}
loadServerClaims();

// Delta claims polling (10s desktop / 20s mobile for claims, 30s/60s for full pixel refresh)
var _pixelPollCount=0;
var _claimsPollMs=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?20000:10000;
_setActiveInterval(function(){
  _pixelPollCount++;
  var fetchPixels=(_pixelPollCount%3===0); // every 30s desktop / 60s mobile
  var fetchFullClaims=(_pixelPollCount%9===0); // reconcile hidden/expired cloak state without adding a new loop
  var claimsUrl=fetchFullClaims?'/api/claims':('/api/claims?since='+_claimsSince);
  var fetches=[_guardedJsonFetch(fetchFullClaims?'claims-full':'claims-delta', claimsUrl, {minGap:Math.max(5000,_claimsPollMs-500), backoffMs:60000, fetchOptions:{headers:marsAuthHeaders()}})];
  if(fetchPixels) fetches.push(_guardedJsonFetch('pixels-full', '/api/pixels', {minGap:Math.max(15000,_claimsPollMs*3-500), backoffMs:90000, fetchOptions:{headers:marsAuthHeaders()}}));
  Promise.all(fetches).then(function(results){
    var newClaims=results[0], serverPixels=results[1];
    var added=0;
    if(fetchFullClaims&&Array.isArray(newClaims)){
      claims.length=0;
      newClaims.forEach(function(sc){
        _rememberClaimsCursor(sc);
        claims.push(sc);
      });
      added=newClaims.length;
    }else if(newClaims&&newClaims.length){
      var existingIds={};
      claims.forEach(function(c){if(c.id) existingIds[c.id]=true;});
      newClaims.forEach(function(sc){
        _rememberClaimsCursor(sc);
        if(existingIds[sc.id]) return;
        claims.push(sc);
        added++;
      });
    }
    if(fetchPixels&&serverPixels&&typeof serverPixels==='object'&&Object.keys(serverPixels).length>0){
      initPixelGridFromServer(serverPixels);
      _pixelsLoaded=true;
    }else if(added){
      initPixelGrid();
    }
    if(!added&&!fetchPixels) return;
    var pending=0;
    if(newClaims) newClaims.forEach(function(sc){
      if(sc.imgUrl&&!imgCache[sc.imgUrl]){
        pending++;
        cacheImage(sc.imgUrl,function(){
          pending--;
          if(pending<=0){claimsSnapshot=null;compositeClaimsOnTexture()}
        });
      }
    });
    if(pending===0){claimsSnapshot=null;compositeClaimsOnTexture()}
  }).catch(function(){});
},_claimsPollMs);

// ── Sectors auto-refresh ──
// admin 이 sector tier/price/entry-level 을 변경한 뒤 즉시 반영되도록
// 1) boot 시 1회 로드  2) 60초마다 polling refresh  3) 페이지 가시화 시 즉시 refresh
window.refreshSectors = function(){
  return _guardedJsonFetch('sectors-refresh', '/api/sectors', {minGap:10000, backoffMs:120000, fetchOptions:{headers:marsAuthHeaders()}}).then(function(data){
    if (!data) return null;
    // Diff check — sector overlay 데이터가 변경됐는지 비교 (변경 있을 때만 텍스처 재렌더)
    var prev = _sectorsData || [];
    var changed = prev.length !== data.length;
    if (!changed) {
      for (var i = 0; i < data.length && !changed; i++) {
        var a = prev[i] || {}, b = data[i] || {};
        var ag = a.governor, bg = b.governor;
        if ((ag && ag.fullWallet) !== (bg && bg.fullWallet)) { changed = true; break; }
        if (a.tier !== b.tier) { changed = true; break; }
        if ((a.entryMinLevel||0) !== (b.entryMinLevel||0)) { changed = true; break; }
        if ((a.entryCheckActive!==false) !== (b.entryCheckActive!==false)) { changed = true; break; }
        if ((a.announcement||'') !== (b.announcement||'')) { changed = true; break; }
      }
    }
    _sectorsData = data;
    if (typeof updateGovRoles === 'function') updateGovRoles();
    if (typeof updateSectorAnnounces === 'function') updateSectorAnnounces();
    if (typeof renderSectorList === 'function') { try { renderSectorList(data); } catch(_) {} }
    // Globe overlay (governor names, locks, tier labels)는 marsCanvasTexture 에 그려져 캐시됨.
    // 데이터 변경 시 텍스처를 재합성해야 옛 governor 이름이 사라짐.
    if (changed) {
      try {
        marsCanvasTexture = null;
        claimsSnapshot = null;
        if (typeof compositeClaimsOnTexture === 'function') compositeClaimsOnTexture();
      } catch(_) {}
    }
    return data;
  }).catch(function(e){ console.warn('[Sectors] refresh failed:', e); return null; });
};
(function loadSectorsOnBoot(){
  refreshSectors().then(function(){
    _setActiveTimeout(function(){claimsSnapshot=null;compositeClaimsOnTexture()},1000);
  });
  // Periodic refresh — admin 변경이 최대 60초 안에 자동 반영 (서버 캐시 TTL 과 동일)
  _setActiveInterval(refreshSectors, 60000);
  // Tab focus / visibility — 사용자가 다른 탭/창에서 돌아올 때 즉시 fresh 데이터로
  _onPageVisible(refreshSectors);
  _onPageFocus(refreshSectors);
})();

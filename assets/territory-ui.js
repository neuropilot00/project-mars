/* ── Globe Click → Select Territory ──────────────── */
var selectedPlot=null;
var selectedChain='base';
var selectedSize=1;
// ── Rotation: manual back button only ──
function stopRotation(){if(globe&&globe.controls)globe.controls().autoRotate=false}
document.getElementById('globe-wrap').addEventListener('mousedown',stopRotation);
document.getElementById('globe-wrap').addEventListener('touchstart',stopRotation);

function _territoryReadJson(key, url, minGap) {
  var walletKey = (walletState && walletState.address) ? String(walletState.address).toLowerCase() : 'public';
  if (typeof _guardedJsonFetch === 'function') {
    return _guardedJsonFetch('territory:' + key + ':' + walletKey, url, {
      minGap: minGap || 10000,
      backoffMs: 120000,
      fetchOptions: { headers: getAuthHeaders() }
    });
  }
  return fetch(url, { headers: getAuthHeaders() }).then(function(r){return r.ok ? r.json() : null;}).catch(function(){return null;});
}

function goBack(){
  selectedPlot=null;isZoomedIn=false;
  document.getElementById('territoryInfo').style.display='none';
  hideMobInfoBtn();
  // Cancel land selection mode if active (drag pin)
  try{ if(typeof landSelectMode!=='undefined' && landSelectMode) cancelLandSelect(); }catch(_le){}
  // Close any open POI popup
  try{ var _po=document.getElementById('poiPopupOverlay'); if(_po) _po.remove(); }catch(_pe){}
  // Reset to initial planet view: lat 0, lng 0, altitude 3.2 (matches onGlobeReady)
  globe.pointOfView({lat:0,lng:0,altitude:3.2},1000);
  try{ globe.controls().autoRotate=true; }catch(_ae){}
  compositeClaimsOnTexture();
}

// ── Find claim at coordinates ──
function findClaimAt(lat,lng){
  for(var i=0;i<claims.length;i++){
    var c=claims[i];
    var hw=GRID_SIZE*(c.w||c.size||10)/2;
    var hh=GRID_SIZE*(c.h||c.size||10)/2;
    if(Math.abs(c.lat-lat)<hh&&Math.abs(c.lng-lng)<hw) return c;
  }
  return null;
}

// Find which connected group a click falls in
function _findGroupAt(owner,lat,lng){
  var groups=_ownerGroups[owner];
  if(!groups) return null;
  var gs=GRID_SIZE;
  for(var i=0;i<groups.length;i++){
    var b=groups[i].bounds;
    if(lat>=b.minLat-gs*0.5&&lat<=b.maxLat+gs*0.5&&lng>=b.minLng-gs*0.5&&lng<=b.maxLng+gs*0.5){
      return groups[i];
    }
  }
  return groups[0]; // fallback
}

// Find merged territory at coords (pixel-accurate, returns merged plot for connected group)
function findTerritoryAt(lat,lng){
  // Check pixelGrid first for pixel-accurate hit
  var gs=_actualGridStep||GRID_SIZE;
  var snapLat=Math.round(lat/gs)*gs;
  snapLat=Math.round(snapLat*100)/100;
  var snapLng=Math.round(lng/gs)*gs;
  snapLng=Math.round(snapLng*100)/100;
  var px=pixelGrid[pxKey(snapLat,snapLng)];
  if(px&&px.owner) return _buildMergedPlot(px.owner,lat,lng);
  // Fallback: rect-based
  var claim=findClaimAt(lat,lng);
  if(claim&&claim.owner) return _buildMergedPlot(claim.owner,lat,lng);
  return null;
}

function _buildMergedPlot(owner,lat,lng){
  var group=_findGroupAt(owner,lat,lng);
  if(!group) return null;
  var groupClaims=group.claimIndices.map(function(ci){return claims[ci]});
  var t=group.bounds;
  var centerLat=(t.minLat+t.maxLat)/2;
  var centerLng=(t.minLng+t.maxLng)/2;
  var _gs2=_actualGridStep||GRID_SIZE;
  var wPx=Math.round((t.maxLng-t.minLng)/_gs2)+1;
  var hPx=Math.round((t.maxLat-t.minLat)/_gs2)+1;
  // Find representative claim (first with image)
  var imgClaim=null;
  for(var i=0;i<groupClaims.length;i++){
    if(groupClaims[i].imgUrl){imgClaim=groupClaims[i];break}
  }
  if(!imgClaim) imgClaim=groupClaims[0];
  return {
    lat:centerLat,lng:centerLng,w:wPx,h:hPx,
    owner:owner, id:imgClaim.id,
    claims:groupClaims,
    imgUrl:imgClaim.imgUrl, originalImgUrl:imgClaim.originalImgUrl,
    imgScale:imgClaim.imgScale, imgRotate:imgClaim.imgRotate,
    imgOffsetX:imgClaim.imgOffsetX, imgOffsetY:imgClaim.imgOffsetY,
    price:groupClaims.reduce(function(s,c){return s+(c.price||0)},0),
    nickname:imgClaim.nickname, label:imgClaim.label||imgClaim.nickname,
    link:imgClaim.link, shield:imgClaim.shield,
    isMerged:groupClaims.length>1,
    _pixelCount:t.count, _bounds:t
  };
}

// ── Stamp Mode State ──
var stampMode=false, stampImgUrl=null, stampImgW=0, stampImgH=0;
var _isMob=typeof isMobile!=='undefined'?isMobile:/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
var stampW=_isMob?10:20, stampH=_isMob?10:20, stampScale=100; // w,h in pixel-cells, scale in %
var stampPreviewLat=null, stampPreviewLng=null;
var isZoomedIn=false, lastClickTime=0;

// ── Land Select Mode: buy land without image ──
var landSelectMode=false;
var landDragStart=null; // {lat, lng}
var landDragEnd=null;   // {lat, lng}
var landDragRect=null;  // {lat, lng, w, h} — computed rect

function activateLandSelect(){
  if(!walletState.connected){
    showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));
    openAuthModal();
    return;
  }
  landSelectMode=true; stampMode=false;
  landDragStart=null; landDragEnd=null; landDragRect=null;
  document.getElementById('landSelectBtn').textContent=isMobile?'TAP MARS TO PLACE':'CLICK MARS TO START';
  document.getElementById('landSelectBtn').style.color='var(--gn)';
  document.getElementById('landSelectPreview').style.display='none';
  // Cancel stamp mode if active
  if(stampImgUrl) cancelStamp();
  // Disable globe rotation/panning so drag selects land, not spins globe
  if(globe&&globe.controls){
    // Keep controls enabled so globe.gl still receives pointer events
    // (disabling controls entirely prevents onGlobeClick from firing).
    // Just disable rotate/pan so user drags select land instead of spinning globe.
    globe.controls().enableRotate=false;
    globe.controls().enablePan=false;
    globe.controls().autoRotate=false;
  }
  // Mobile: show size controls and default size
  if(isMobile){
    _mobLandW=10; _mobLandH=10;
    _showMobSizeControls(true);
    showToast(tl('Tap to place center → drag to move → pinch zoom','탭해서 중심 배치 → 드래그로 이동 → 핀치로 확대/축소','タップで中心配置 → ドラッグで移動 → ピンチで拡大縮小','点击放置中心 → 拖动移动 → 双指缩放'));
  }else{
    showToast(tl('Click start point → click end point','시작 지점 클릭 → 종료 지점 클릭','開始地点をクリック → 終了地点をクリック','点击起点 → 点击终点'));
  }
}
// Mobile land size state
var _mobLandW=10, _mobLandH=10;
function _showMobSizeControls(show){
  var el=document.getElementById('mobSizeControls');
  if(!el) return;
  el.style.display=show?'flex':'none';
  if(show) _updateMobLabels();
}
function _mobConfirmLand(){
  if(!landDragRect){showToast(tl('Tap Mars to set location first','먼저 화성을 탭해 위치를 정하세요','まず火星をタップして位置を決めてください','请先点击火星设置位置'),'error');return;}
  _showMobSizeControls(false);
  landSelectMode=false;
  _restoreGlobeControls();
  confirmLandSelect();
}
function _restoreGlobeControls(){
  if(!globe||!globe.controls) return;
  globe.controls().enabled=true;
  globe.controls().enableRotate=true;
  globe.controls().enablePan=true;
}
function _updateMobLabels(){
  var el=document.getElementById('mobSizeLabel');
  if(el) el.textContent=_mobLandW+' × '+_mobLandH;
  var cl=document.getElementById('mobCostLabel');
  if(!landDragRect){if(cl) cl.textContent=(_mobLandW*_mobLandH).toLocaleString()+'px';return;}
  var ci=calcStampCost(landDragRect.lat,landDragRect.lng,landDragRect.w,landDragRect.h);
  if(cl) cl.textContent=(_mobLandW*_mobLandH).toLocaleString()+'px · ≈'+ci.total.toFixed(1)+' PP'+(ci.overlapCount>0?' ('+ci.overlapCount+'⚔)':'');
}
// Virtual joystick for territory size control
(function(){
  var wrap=document.getElementById('mobJoystickWrap');
  if(!wrap) return;
  var knob=document.getElementById('mobJoystickKnob');
  var active=false, cx=0, cy=0, moveInterval=null;
  var dx=0, dy=0;
  function onStart(e){
    e.preventDefault();
    active=true;
    var rect=wrap.getBoundingClientRect();
    cx=rect.left+rect.width/2;
    cy=rect.top+rect.height/2;
    if(moveInterval) _clearActiveInterval(moveInterval);
    moveInterval=_setActiveInterval(function(){
      if(!active) return;
      // Joystick controls territory size: right=W+, left=W-, up=H+, down=H-
      var dw=0, dh=0;
      if(Math.abs(dx)>0.3) dw=dx>0?1:-1;
      if(Math.abs(dy)>0.3) dh=dy<0?1:-1; // up = H+
      if(dw===0&&dh===0) return;
      _mobLandW=Math.max(5,Math.min(200,_mobLandW+dw));
      _mobLandH=Math.max(5,Math.min(200,_mobLandH+dh));
      if(landDragStart){
        landDragRect={lat:landDragStart.lat,lng:landDragStart.lng,w:_mobLandW,h:_mobLandH};
        updateLandSelectUI();
        _setDragPreviewPolygon(landDragRect);
      }
      _updateMobLabels();
    },100);
  }
  function onMove(e){
    if(!active) return;
    e.preventDefault();
    var t=e.touches?e.touches[0]:e;
    var rawDx=t.clientX-cx, rawDy=t.clientY-cy;
    var maxR=32;
    var dist=Math.sqrt(rawDx*rawDx+rawDy*rawDy);
    if(dist>maxR){rawDx=rawDx/dist*maxR;rawDy=rawDy/dist*maxR;}
    dx=rawDx/maxR; dy=rawDy/maxR;
    if(knob){
      knob.style.left='calc(50% + '+rawDx+'px)';
      knob.style.top='calc(50% + '+rawDy+'px)';
    }
  }
  function onEnd(){
    active=false; dx=0; dy=0;
    if(moveInterval){_clearActiveInterval(moveInterval);moveInterval=null;}
    if(knob){knob.style.left='50%';knob.style.top='50%';}
  }
  _onPageHidden(onEnd);
  wrap.addEventListener('touchstart',onStart,{passive:false});
  wrap.addEventListener('touchmove',onMove,{passive:false});
  wrap.addEventListener('touchend',onEnd);
  wrap.addEventListener('touchcancel',onEnd);
  wrap.addEventListener('mousedown',onStart);
  document.addEventListener('mousemove',function(e){if(active)onMove(e);});
  document.addEventListener('mouseup',function(){if(active)onEnd();});
})();

// Mobile: single-finger drag to move territory position after pin placed
(function(){
  var globeWrap=document.getElementById('globe-wrap');
  if(!globeWrap) return;
  var dragActive=false, lastTouch=null;
  globeWrap.addEventListener('touchstart',function(e){
    // Only single-finger, only in landSelectMode with pin placed
    if(e.touches.length!==1||!landSelectMode||!landDragStart) return;
    // Don't intercept if touching joystick/controls area
    var t=e.target;
    while(t&&t!==globeWrap){
      if(t.id==='mobSizeControls') return;
      t=t.parentElement;
    }
    dragActive=true;
    lastTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  globeWrap.addEventListener('touchmove',function(e){
    if(!dragActive||e.touches.length!==1) return;
    var tx=e.touches[0].clientX, ty=e.touches[0].clientY;
    if(!lastTouch){lastTouch={x:tx,y:ty};return;}
    // Convert screen delta to globe coordinates
    var pov=globe.pointOfView();
    var alt=pov.altitude||1;
    // Rough: at altitude a, 1px screen ≈ k degrees
    var degPerPx=alt*0.07;
    var dlng=(tx-lastTouch.x)*degPerPx;
    var dlat=-(ty-lastTouch.y)*degPerPx;
    lastTouch={x:tx,y:ty};
    // Move the territory
    var newLat=Math.round(Math.max(-70,Math.min(70,landDragStart.lat+dlat))/GRID_SIZE)*GRID_SIZE;
    var newLng=Math.round((landDragStart.lng+dlng)/GRID_SIZE)*GRID_SIZE;
    if(newLng>180) newLng-=360;
    if(newLng<-180) newLng+=360;
    landDragStart={lat:newLat,lng:newLng};
    landDragRect={lat:newLat,lng:newLng,w:_mobLandW,h:_mobLandH};
    if(!_hoverDirty){
      _hoverDirty=true;
      requestAnimationFrame(function(){
        _hoverDirty=false;
        // Fast path: update the WebGL polygon overlay instead of re-encoding
        // the whole texture. No toDataURL cost = buttery drag on mobile.
        _setDragPreviewPolygon(landDragRect);
        updateLandSelectUI();
        _updateMobLabels();
      });
    }
    e.preventDefault();
  },{passive:false});
  globeWrap.addEventListener('touchend',function(){dragActive=false;lastTouch=null;});
  globeWrap.addEventListener('touchcancel',function(){dragActive=false;lastTouch=null;});
})();

function cancelLandSelect(){
  landSelectMode=false; landDragStart=null; landDragEnd=null; landDragRect=null;
  document.getElementById('landSelectBtn').textContent='DRAG TO SELECT LAND';
  document.getElementById('landSelectBtn').style.color='var(--mars)';
  document.getElementById('landSelectPreview').style.display='none';
  if(isMobile) _showMobSizeControls(false);
  _restoreGlobeControls();
  _clearDragPreviewPolygon();
  compositeClaimsOnTexture();
}

function confirmLandSelect(){
  if(!landDragRect) return;
  _restoreGlobeControls();
  _clearDragPreviewPolygon();
  selectedPlot={lat:landDragRect.lat, lng:landDragRect.lng, owner:null, price:0, label:'UNCLAIMED',
    w:landDragRect.w, h:landDragRect.h};
  openClaimModal();
}

function updateLandSelectUI(){
  if(!landDragRect) return;
  var r=landDragRect;
  document.getElementById('landSizeLabel').textContent=r.w+'×'+r.h;
  document.getElementById('landPixelLabel').textContent=(r.w*r.h).toLocaleString()+'px';
  var costInfo=calcStampCost(r.lat,r.lng,r.w,r.h);
  var costStr=costInfo.total.toFixed(2)+' PP';
  if(costInfo.overlapCount>0) costStr+=' ('+costInfo.overlapCount+' hijack)';
  // 섹터 레벨 제한 체크
  var _lsBlocked=_getBlockedSector(r.lat,r.lng);
  if(_lsBlocked){
    costStr=LANG==='ko'?('🔒 Lv '+_lsBlocked.entryMinLevel+' 이상 필요'):LANG==='ja'?('🔒 Lv '+_lsBlocked.entryMinLevel+' 以上必要'):LANG==='zh'?('🔒 需要 Lv '+_lsBlocked.entryMinLevel+' 以上'):('🔒 Requires Lv '+_lsBlocked.entryMinLevel+'+');
    var costEl=document.getElementById('landCostLabel');
    if(costEl) costEl.style.color='var(--red)';
  }else{
    var costEl2=document.getElementById('landCostLabel');
    if(costEl2) costEl2.style.color='';
  }
  document.getElementById('landCostLabel').textContent=costStr;
  document.getElementById('landSelectPreview').style.display='';
}

// ── Drag-pin polygon overlay helpers (no texture re-encoding) ──
function _setDragPreviewPolygon(lr){
  if(!globe || !lr) return;
  try{
    var hw = (lr.w * GRID_SIZE) / 2;
    var hh = (lr.h * GRID_SIZE) / 2;
    var n = Math.max(-89.9, Math.min(89.9, lr.lat + hh));
    var s = Math.max(-89.9, Math.min(89.9, lr.lat - hh));
    var e = lr.lng + hw;
    var wl = lr.lng - hw;
    // Subdivide long edges so the polygon hugs the curvature instead of
    // cutting straight across. ~2° per segment is plenty.
    var steps = Math.max(2, Math.ceil((e - wl) / 2));
    var top = [], bot = [];
    for(var i=0;i<=steps;i++){
      var lng = wl + (e - wl) * (i/steps);
      top.push([lng, n]);
      bot.push([lng, s]);
    }
    var ring = top.concat(bot.reverse());
    ring.push([wl, n]); // close
    globe.polygonsData([{ geometry:{ type:'Polygon', coordinates:[ring] }, properties:{} }]);
  }catch(_pe){}
}
function _clearDragPreviewPolygon(){
  if(!globe) return;
  try{ globe.polygonsData([]); }catch(_ce){}
}

function computeLandRect(startLat,startLng,endLat,endLng){
  // Snap to grid
  var lat1=Math.round(startLat/GRID_SIZE)*GRID_SIZE;
  var lng1=Math.round(startLng/GRID_SIZE)*GRID_SIZE;
  var lat2=Math.round(endLat/GRID_SIZE)*GRID_SIZE;
  var lng2=Math.round(endLng/GRID_SIZE)*GRID_SIZE;
  // Handle longitude wrap-around (e.g. -179 to +179 = 2° apart, not 358°)
  var dLng=lng2-lng1;
  if(dLng>180) lng2-=360;
  else if(dLng<-180) lng2+=360;
  // Ensure ordering
  var minLat=Math.min(lat1,lat2), maxLat=Math.max(lat1,lat2);
  var minLng=Math.min(lng1,lng2), maxLng=Math.max(lng1,lng2);
  // Calculate dimensions in grid cells
  var w=Math.max(1,Math.round((maxLng-minLng)/GRID_SIZE));
  var h=Math.max(1,Math.round((maxLat-minLat)/GRID_SIZE));
  // Clamp size
  w=Math.min(w,500); h=Math.min(h,500);
  // Center point
  var cLat=(minLat+maxLat)/2;
  var cLng=(minLng+maxLng)/2;
  // Normalize longitude to [-180, 180]
  if(cLng>180) cLng-=360;
  else if(cLng<-180) cLng+=360;
  // Clamp latitude
  cLat=Math.max(-70+h*GRID_SIZE/2, Math.min(70-h*GRID_SIZE/2, cLat));
  return {lat:cLat, lng:cLng, w:w, h:h};
}

// ── Globe Click Handler (attached after globe init) ──
function _attachGlobeClick(){
  if(!globe){setTimeout(_attachGlobeClick,100);return}
  // Track last tap/click position for mobile info button
  var _lastTapX=0, _lastTapY=0;
  var globeEl=globe.renderer().domElement;
  globeEl.addEventListener('pointerdown',function(e){ _lastTapX=e.clientX; _lastTapY=e.clientY; });

  // Fast-path click handler for LAND SELECT mode (desktop).
  // Uses 'click' event (fires on pointerup) to avoid clashing with globe.gl's
  // internal pointer capture logic. Much faster than onGlobeClick because it
  // bypasses the raycaster chain entirely — we use toGlobeCoords directly.
  var _fastClickGuard=0;
  globeEl.addEventListener('click',function(e){
    if(isMobile) return;
    if(!landSelectMode) return;
    if(e.button!==0) return;
    var nowG=Date.now();
    if(nowG-_fastClickGuard<250) return;
    _fastClickGuard=nowG;
    var rect=globeEl.getBoundingClientRect();
    var coords=globe.toGlobeCoords(e.clientX-rect.left, e.clientY-rect.top);
    if(!coords) return;
    var lat=Math.max(-70,Math.min(70,coords.lat));
    var lng=coords.lng;
    lat=Math.round(lat/GRID_SIZE)*GRID_SIZE;
    lng=Math.round(lng/GRID_SIZE)*GRID_SIZE;
    if(!landDragStart){
      landDragStart={lat:lat,lng:lng};
      landDragEnd={lat:lat,lng:lng};
      landDragRect=computeLandRect(lat,lng,lat,lng);
      var _btn=document.getElementById('landSelectBtn');
      if(_btn) _btn.textContent='CLICK AGAIN TO SET END';
      showToast(tl('Start point set — click to set end point','시작 지점 설정 완료 — 종료 지점을 클릭하세요','開始地点を設定しました — 終了地点をクリックしてください','起点已设置 — 点击终点'));
      _setDragPreviewPolygon(landDragRect);
    }else{
      landDragEnd={lat:lat,lng:lng};
      landDragRect=computeLandRect(landDragStart.lat,landDragStart.lng,lat,lng);
      updateLandSelectUI();
      var _btn2=document.getElementById('landSelectBtn');
      if(_btn2){
        _btn2.textContent='DRAG TO SELECT LAND';
        _btn2.style.color='var(--mars)';
      }
      landSelectMode=false;
      // Defer modal open so globe.gl's internal pointer handling finishes
      setTimeout(function(){ try{ confirmLandSelect(); }catch(_ce){} }, 0);
    }
  });

  globe.onGlobeClick(function(coords){
    stopRotation();
    var now=Date.now();
    var isDouble=(now-lastClickTime<400);
    lastClickTime=now;

    var lat=Math.max(-70,Math.min(70,coords.lat)), lng=coords.lng;
    var existing=findTerritoryAt(lat,lng);

    // Double-click: toggle zoom
    if(isDouble){
      if(isZoomedIn){goBack();isZoomedIn=false}
      else{
        if(existing){
          var maxDim=Math.max(existing.w||existing.size||10,existing.h||existing.size||10);
          var alt=Math.max(0.06,maxDim*GRID_SIZE/60);
          globe.pointOfView({lat:existing.lat,lng:existing.lng,altitude:alt},800);
          selectedPlot=existing;
          // Unified: both desktop and mobile use the floating INFO button → modal
          showMobInfoBtn(existing,{clientX:_lastTapX,clientY:_lastTapY});
        }else{
          globe.pointOfView({lat:lat,lng:lng,altitude:0.15},800);
        }
        isZoomedIn=true;
      }
      return;
    }

    // POI proximity check — discover nearby POI on click
    if(_poiData.length > 0 && !landSelectMode && !stampMode) {
      var nearestPOI = null, nearestDist = Infinity;
      var undiscoveredCount = 0;
      for(var pi=0;pi<_poiData.length;pi++){
        var p=_poiData[pi];
        if(p.discovered) continue;
        undiscoveredCount++;
        var dlat=lat-p.lat;
        var dlng=lng-p.lng;
        // Wrap longitude difference for ±180 boundary
        if(dlng > 180) dlng -= 360;
        if(dlng < -180) dlng += 360;
        var dist=Math.sqrt(dlat*dlat+dlng*dlng);
        if(dist<nearestDist){nearestDist=dist;nearestPOI=p;}
      }
      // Dynamic threshold based on zoom level — tight hit-box so users
      // can click near POIs to claim land without accidentally triggering discover.
      var alt = globe.pointOfView().altitude || 2;
      var threshold = Math.max(1.5, Math.min(6, alt * 2.2));
      if(nearestPOI && nearestDist < threshold) {
        console.log('[POI] Click! type:', nearestPOI.poiType, 'dist:', nearestDist.toFixed(1)+'°', 'threshold:', threshold.toFixed(1), 'id:', nearestPOI.id);
        _showPOIPopup(nearestPOI);
        return;
      }
      if(undiscoveredCount > 0 && nearestDist < 40) console.log('[POI] Nearest POI too far:', nearestDist.toFixed(1)+'° (need <'+threshold.toFixed(0)+'°)');
    }

    // Rocket proximity check — open loot popup
    if(_rocketData.events && _rocketData.events.length > 0 && !landSelectMode) {
      for(var ri=0;ri<_rocketData.events.length;ri++){
        var rev=_rocketData.events[ri];
        if(rev.status !== 'looting') continue;
        var rdlat=lat-rev.lat, rdlng=lng-rev.lng;
        var rdist=Math.sqrt(rdlat*rdlat+rdlng*rdlng);
        if(rdist < 8) { _showRocketLootPopup(rev); return; }
      }
    }

    // Land Select mode
    if(landSelectMode){
      // Desktop path is handled by the fast pointerdown handler above.
      // This onGlobeClick fires AFTER pointerup and would cause a double-action.
      if(!isMobile) return;
      lat=Math.round(lat/GRID_SIZE)*GRID_SIZE;
      lng=Math.round(lng/GRID_SIZE)*GRID_SIZE;
      // Mobile: single tap sets center, joystick to fine-tune, size buttons to resize
      landDragStart={lat:lat,lng:lng};
      landDragRect={lat:lat,lng:lng,w:_mobLandW,h:_mobLandH};
      updateLandSelectUI();
      _updateMobLabels();
      showToast(tl('📍 Pin placed! Drag to move · pinch to zoom','📍 핀이 배치되었습니다! 드래그로 이동 · 핀치로 확대/축소','📍 ピンを配置しました！ドラッグで移動・ピンチで拡大縮小','📍 已放置标记！拖动移动 · 双指缩放'));
      _setDragPreviewPolygon(landDragRect);
      return;
    }

    // Stamp mode: place image on click
    if(stampMode&&stampImgUrl){
      // 모바일: OK 버튼으로만 확정 (클릭 무시, 드래그로 위치 조정)
      if(isMobile) return;
      lat=Math.round(lat/GRID_SIZE)*GRID_SIZE;
      lng=Math.round(lng/GRID_SIZE)*GRID_SIZE;
      // 극지방 체크
      var _halfH=stampH*0.1/2;
      if(lat+_halfH>70||lat-_halfH<-70){
        showToast(tl('Polar zone — cannot place here (beyond ±70°)','극지대에서는 배치할 수 없습니다 (±70° 초과)','極地帯には配置できません（±70°超過）','极地区域无法放置（超出 ±70°）'));
        return;
      }
      selectedPlot={lat:lat,lng:lng,owner:null,price:0,label:'UNCLAIMED',w:stampW,h:stampH};
      uploadedUrl=stampImgUrl;
      openClaimModal();
      return;
    }

    // Normal click on existing claim — unified desktop+mobile UX:
    // both show the floating INFO button which opens the territory modal
    if(existing){
      selectedPlot=existing;
      showMobInfoBtn(existing, {clientX:_lastTapX,clientY:_lastTapY});
      compositeClaimsOnTexture();
    }else{
      if(window._showSectorBounds && typeof findSectorAtLatLng==='function'){
        var focusedSector=findSectorAtLatLng(lat,lng);
        if(focusedSector && typeof focusSector==='function'){
          focusSector(focusedSector.id,{openPanel:true,fromGlobe:true});
          return;
        }
      }
      selectedPlot=null;
      hideMobInfoBtn();
      var _deskInfo=document.getElementById('territoryInfo');
      if(_deskInfo) _deskInfo.style.display='none';
      compositeClaimsOnTexture();
    }
  });
}

// ── Stamp Mode: image-first workflow ──
var _stampOrigFile=null; // keep original File for GIF detection
document.getElementById('stampFileInput').addEventListener('change',function(e){
  var file=e.target.files[0]; if(!file) return;
  if(file.size>4.5*1024*1024){ showToast(tl('⚠️ File too large (max 5MB). Choose a smaller image.','⚠️ 파일이 너무 큽니다 (최대 5MB). 더 작은 이미지를 선택하세요.','⚠️ ファイルが大きすぎます（最大5MB）。より小さい画像を選択してください。','⚠️ 文件过大（最大 5MB）。请选择更小的图片。')); e.target.value=''; return; }
  _stampOrigFile=file;
  var url=URL.createObjectURL(file);
  activateStamp(url);
});
function activateStamp(url){
  if(!walletState.connected){
    showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));
    openAuthModal();
    return;
  }
  var img=new Image();
  img.onload=function(){
    stampImgUrl=url; stampImgW=img.width; stampImgH=img.height;
    stampMode=true;
    cacheImage(url);
    // Default 100% = original image pixel dimensions as cell count
    stampScale=100;
    stampW=stampImgW; stampH=stampImgH;
    // Min scale: 1×1 pixel on longest side
    var maxDim=Math.max(stampImgW,stampImgH);
    var minPct=Math.max(1,Math.ceil(100/maxDim));
    // Update UI
    document.getElementById('stampThumb').src=url;
    document.getElementById('stampImgInfo').textContent=img.width+'×'+img.height+'px';
    document.getElementById('stampMinLabel').textContent='Min 1×1 px';
    var slider=document.getElementById('stampSizeSlider');
    slider.min=-100; slider.max=100; slider.value=0;
    updateStampScale(100);
    var _sp2=document.getElementById('stampPreview');if(_sp2)_sp2.style.display='';
    showToast(tl('Image ready — click Mars to stamp!','이미지 준비 완료 — 화성을 클릭해 스탬프하세요!','画像の準備完了 — 火星をクリックしてスタンプ！','图片已就绪 — 点击火星进行盖章！'));
  };
  img.onerror=function(){showToast(tl('Image load failed — try selecting from Files app for GIF','이미지 불러오기 실패 — GIF는 파일 앱에서 선택해 보세요','画像の読み込みに失敗しました — GIF はファイルアプリから選択してみてください','图片加载失败 — GIF 请尝试从文件应用中选择'))};
  img.crossOrigin='anonymous';
  img.src=url;
}
function updateStampScale(pct){
  stampScale=pct;
  stampW=Math.max(1,Math.round(stampImgW*pct/100));
  stampH=Math.max(1,Math.round(stampImgH*pct/100));
  updateStampCostDisplay();
  if(stampPreviewLat!==null) compositeClaimsOnTexture(true);
}
function updateStampCostDisplay(){
  var pixels=stampW*stampH;
  document.getElementById('stampSizeLabel').textContent=stampW+'×'+stampH+' px ('+stampScale+'%)';
  if(stampPreviewLat!==null){
    var cost=calcStampCost(stampPreviewLat,stampPreviewLng,stampW,stampH);
    var label='$'+cost.total.toLocaleString();
    if(cost.overlapCount>0) label+=' ('+cost.overlapCount+' overlap)';
    document.getElementById('stampCostLabel').textContent=label;
  }else{
    var baseCost=Math.round(pixels*PIXEL_PRICE*100)/100;
    document.getElementById('stampCostLabel').textContent='~'+baseCost.toLocaleString()+' PP';
  }
}
// Shared slider→pct mapping: -100 → 1×1px, 0 → 100%, +100 → 300%
function _sliderToPct(v){
  var maxDim=Math.max(stampImgW||1,stampImgH||1);
  var minPct=Math.max(1,Math.ceil(100/maxDim)); // pct that gives ~1px on longest side
  if(v<=0) return minPct+(100-minPct)*((v+100)/100);
  return 100+200*(v/100);
}
function _dSliderToPct(v){
  return _sliderToPct(v);
}
function updateDesktopStampSlider(v){
  var pct=Math.round(_dSliderToPct(v));
  updateStampScale(pct);
}
function setDesktopStampSlider(v){
  document.getElementById('stampSizeSlider').value=v;
  updateDesktopStampSlider(v);
}
function setStampPct(pct){
  document.getElementById('stampSizeSlider').value=0;
  updateStampScale(pct);
}
function cancelStamp(){
  stampMode=false; stampImgUrl=null; _stampOrigFile=null;
  stampPreviewLat=null; stampPreviewLng=null;
  var _sp=document.getElementById('stampPreview');if(_sp)_sp.style.display='none';
  document.getElementById('stampFileInput').value='';
  document.getElementById('stampLinkInput').value='';
  document.getElementById('stampSizeSlider').value=0;
  compositeClaimsOnTexture();
}

// ── Mobile Stamp (bottom sheet) ──
var isMobile=window.innerWidth<=768;
window.addEventListener('resize',_debounce(function(){isMobile=window.innerWidth<=768},150));

var mobileStampPlacing=false; // true when user is picking location on Mars

function openMobileStamp(){
  // Reset previous image state
  stampImgUrl=null;stampMode=false;
  stampPreviewLat=null;stampPreviewLng=null;
  document.getElementById('mStampPreview').style.display='none';
  document.getElementById('mStampFileInput').value='';
  document.getElementById('mStampFileBtn').textContent=t('choose_file');
  document.getElementById('mobileStampModal').classList.add('open');
  document.getElementById('stampFab').style.display='none';
}
function closeMobileStamp(){
  document.getElementById('mobileStampModal').classList.remove('open');
  if(isMobile) document.getElementById('stampFab').style.display='';
}
function closeMobileStampFull(){
  closeMobileStamp();
  cancelStamp();
  exitMobilePlacing();
}
document.getElementById('mStampFileInput').addEventListener('change',function(e){
  var file=e.target.files[0]; if(!file) return;
  if(file.size>4.5*1024*1024){ showToast('⚠️ File too large (max 5MB). Choose a smaller image.'); e.target.value=''; return; }
  _stampOrigFile=file;
  activateStamp(URL.createObjectURL(file));
  syncMobileStampUI();
});
function loadMobileStampUrl(){
  var v=document.getElementById('mStampUrlInput').value.trim(); if(!v) return;
  activateStamp(v);
  syncMobileStampUI();
}
function syncMobileStampUI(){
  setTimeout(function(){
    if(!stampImgUrl) return;
    document.getElementById('mStampThumb').src=stampImgUrl;
    document.getElementById('mStampImgInfo').textContent=stampImgW+'×'+stampImgH+'px';
    document.getElementById('mStampSizeSlider').value=0;
    updateMobileStampLabels();
    document.getElementById('mStampPreview').style.display='';
    // Update button text to indicate change
    document.getElementById('mStampFileBtn').textContent=t('choose_file')+' ('+t('cancel')+')';
  },200);
}
// Mobile slider: -100..+100 → actual pct: -100→minPct, 0→100%, +100→300%
function _mSliderToPct(v){
  return _sliderToPct(v);
}
function updateMobileStampSlider(v){
  var pct=Math.round(_mSliderToPct(v));
  updateStampScale(pct);
  updateMobileStampLabels();
}
function updateMobileStampScale(pct){
  updateStampScale(pct);
  updateMobileStampLabels();
}
function updateMobileStampLabels(){
  var sign=stampScale>=100?'+':'';
  document.getElementById('mStampSizeLabel').textContent=stampW+'×'+stampH+' px ('+stampScale+'%)';
  var baseCost=Math.round(stampW*stampH*PIXEL_PRICE*100)/100;
  document.getElementById('mStampCostLabel').textContent='~'+baseCost.toLocaleString()+' PP';
}
function setMobileStampSlider(v){
  document.getElementById('mStampSizeSlider').value=v;
  updateMobileStampSlider(v);
}
// "PREVIEW ON MARS" → 바텀시트 닫고 반투명 이미지 중앙에 표시, 화성 드래그로 위치 선택
var _mobPreviewRAF=null;
function startMobilePreview(){
  if(!stampImgUrl||!stampMode){showToast('SELECT AN IMAGE FIRST');return}
  closeMobileStamp();
  mobileStampPlacing=true;
  document.getElementById('mobStampCenterImg').src=stampImgUrl;
  document.getElementById('mobStampCenterSize').textContent=stampW+'×'+stampH+'px';
  document.getElementById('mobStampOverlay').style.display='';
  document.getElementById('stampFab').style.display='none';
  // Sync preview scale slider with current scale
  var slider=document.getElementById('mobPreviewScaleSlider');
  slider._minPct=document.getElementById('mStampSizeSlider')._minPct||1;
  slider.value=document.getElementById('mStampSizeSlider').value||0;
  _updateMobPreviewScaleLabels();
  // 스탬프 크기에 맞게 자동 줌인 (이미지가 화면의 20~30% 차지하도록)
  var maxDeg=Math.max(stampW,stampH)*GRID_SIZE;
  var targetAlt=Math.max(0.15,maxDeg/12);
  var pov=globe.pointOfView();
  if(pov.altitude>targetAlt*1.5){
    globe.pointOfView({altitude:targetAlt},600);
  }
  globe.controls().autoRotate=false;
  // 텍스처에 스탬프 미리보기 바로 표시 (첫 프레임 보장)
  var pov2=globe.pointOfView();
  stampPreviewLat=Math.round(Math.max(-70,Math.min(70,pov2.lat))/GRID_SIZE)*GRID_SIZE;
  stampPreviewLng=Math.round(pov2.lng/GRID_SIZE)*GRID_SIZE;
  compositeClaimsOnTexture(false); // full rebuild first
  compositeClaimsOnTexture(true);  // then overlay preview
  // RAF 루프로 드래그 시 실시간 업데이트
  updateMobPreviewSize();
}
function updateMobPreviewSize(){
  if(!mobileStampPlacing){_mobPreviewRAF=null;return}
  if(!_pageIsActive()){_mobPreviewRAF=null;return}
  var pov=globe.pointOfView();
  // 화면 중앙 좌표를 스탬프 미리보기 위치로 설정 (데스크톱 mousemove처럼)
  var lat=Math.round(Math.max(-70,Math.min(70,pov.lat))/GRID_SIZE)*GRID_SIZE;
  var lng=Math.round(pov.lng/GRID_SIZE)*GRID_SIZE;
  if(lat!==stampPreviewLat||lng!==stampPreviewLng){
    stampPreviewLat=lat; stampPreviewLng=lng;
    compositeClaimsOnTexture(true);
  }
  // 사이즈 라벨 업데이트
  document.getElementById('mobStampCenterSize').textContent=stampW+'×'+stampH+'px';
  _mobPreviewRAF=requestAnimationFrame(updateMobPreviewSize);
}
_onPageVisible(function(){
  if(mobileStampPlacing&&!_mobPreviewRAF) updateMobPreviewSize();
});
_onPageHidden(function(){
  if(_mobPreviewRAF){cancelAnimationFrame(_mobPreviewRAF);_mobPreviewRAF=null}
});
function updateMobPreviewScale(v){
  var pct=Math.round(_sliderToPct(v));
  updateStampScale(pct);
  // Sync mobile stamp sheet slider too
  document.getElementById('mStampSizeSlider').value=v;
  _updateMobPreviewScaleLabels();
  // Redraw preview immediately
  if(mobileStampPlacing) compositeClaimsOnTexture(true);
}
function _updateMobPreviewScaleLabels(){
  document.getElementById('mobPreviewScaleLabel').textContent=stampScale+'%';
  document.getElementById('mobPreviewSizeLabel').textContent=stampW+'×'+stampH+'px';
  document.getElementById('mobStampCenterSize').textContent=stampW+'×'+stampH+'px';
}
function exitMobilePlacing(){
  mobileStampPlacing=false;
  if(_mobPreviewRAF){cancelAnimationFrame(_mobPreviewRAF);_mobPreviewRAF=null}
  document.getElementById('mobStampOverlay').style.display='none';
  if(isMobile) document.getElementById('stampFab').style.display='';
  // 텍스처 프리뷰 클리어
  stampPreviewLat=null; stampPreviewLng=null;
  compositeClaimsOnTexture(true);
}
// OK 버튼 → 현재 화면 중앙 좌표로 이미지 배치 확정
function confirmMobilePlacement(){
  if(!stampImgUrl||!stampMode) return;
  var pov=globe.pointOfView();
  var lat=Math.max(-70,Math.min(70,pov.lat));
  var lng=pov.lng;
  lat=Math.round(lat/GRID_SIZE)*GRID_SIZE;
  lng=Math.round(lng/GRID_SIZE)*GRID_SIZE;
  // 극지방 체크
  var _halfH=stampH*0.1/2;
  if(lat+_halfH>70||lat-_halfH<-70){
    showToast('POLAR ZONE — Cannot place here (beyond ±70°)');
    return;
  }
  selectedPlot={lat:lat,lng:lng,owner:null,price:0,label:'UNCLAIMED',w:stampW,h:stampH};
  uploadedUrl=stampImgUrl;
  document.getElementById('stampLinkInput').value = document.getElementById('mStampLinkInput').value || '';
  exitMobilePlacing();
  openClaimModal();
}
function cancelMobileStamp(){
  document.getElementById('mStampLinkInput').value = '';
  cancelStamp();
  closeMobileStamp();
  exitMobilePlacing();
}

// ── Territory Info (for existing claims) ──
function _normalizeExternalLink(raw){
  var s=(raw||'').trim();
  if(!s) return '';
  if(/^https?:\/\//i.test(s)) return s;
  if(/^\/\//.test(s)) return 'https:'+s;
  if(/^[a-z]+:/i.test(s)) return '';
  return 'https://'+s.replace(/^\/+/,'');
}
function _applyExternalLinkDisplay(elId, raw){
  var linkEl=document.getElementById(elId);
  if(!linkEl) return;
  var normalized=_normalizeExternalLink(raw);
  linkEl.href=normalized||'#';
  linkEl.textContent=(raw||'').replace(/^https?:\/\//i,'').replace(/^\/\//,'').substring(0,30) || '--';
}
function showTerritoryInfo(plot){
  if(!plot||!plot.owner) return;
  // ⚠️ claimId 정규화: 서버 /api/claims 와 _buildMergedPlot 은 claim 에 .id 만 넣고 .claimId 는 안 넣는데,
  // 아래 모든 부가기능(업그레이드/HIJACK/PRODUCTION/IDENTITY/설명/스폰서/공물/그래피티/하이라이트/평점/배너/
  // 프레스티지/묘비)이 plot.claimId 게이트라 전부 dead 였음. id 로 채워 동시 복구. [v7.122]
  if(!plot.claimId && plot.id) plot.claimId = plot.id;
  var info=document.getElementById('territoryInfo');
  info.style.display='';
  var myW=walletState.address||'';
  var myW2=(walletState&&walletState.address||'').toLowerCase();
  var _isMyPlot=!!(myW2&&(plot.owner||'').toLowerCase()===myW2);
  // 내 영토 배지 — 상단 border + 배지 표시
  info.style.borderTop=_isMyPlot?'3px solid var(--mars)':'3px solid transparent';
  var _myBadgeEl=document.getElementById('_infoMyBadge');
  if(!_myBadgeEl){
    _myBadgeEl=document.createElement('div');
    _myBadgeEl.id='_infoMyBadge';
    _myBadgeEl.style.cssText='display:none;text-align:center;font-size:9px;font-weight:800;letter-spacing:2px;color:var(--mars);padding:4px 0 6px;font-family:var(--fn)';
    info.insertBefore(_myBadgeEl,info.firstChild);
  }
  _myBadgeEl.textContent=LANG==='ko'?'✦ 내 영토 ✦':LANG==='ja'?'✦ 自分の領土 ✦':LANG==='zh'?'✦ 我的领地 ✦':'✦ MY TERRITORY ✦';
  _myBadgeEl.style.display=_isMyPlot?'':'none';
  document.getElementById('infoCoords').textContent=plot.lat.toFixed(1)+'°, '+plot.lng.toFixed(1)+'°';
  var _ownerName=plot.nickname||plot.label||shortAddr(plot.owner);
  var _ownerBadge=typeof govBadgeHTML==='function'?govBadgeHTML(plot.owner):'';
  document.getElementById('infoOwner').innerHTML=escapeHtmlSafe(_ownerName)+(_ownerBadge?' '+_ownerBadge:'');
  // Guild tag + emblem (custom pixel-art or emoji) — respects display toggles
  var guildRow=document.getElementById('infoGuildRow');
  var _showGEm=(typeof getDisplaySetting==='function')?getDisplaySetting('guildEmblem'):true;
  var _showGTag=(typeof getDisplaySetting==='function')?getDisplaySetting('guildTag'):true;
  if(plot.guildTag && (_showGEm || _showGTag)){
    guildRow.style.display='';
    var _gCell=document.getElementById('infoGuild');
    var _gEmblem='';
    if(_showGEm){
      var _gImg=String(plot.guildEmblemImage||'').trim();
      var _gImgSafe=/^(https?:|data:image\/|blob:)/i.test(_gImg)?_gImg:'';
      _gEmblem=_gImgSafe
        ? '<img src="'+escapeHtmlSafe(_gImgSafe)+'" style="width:14px;height:14px;image-rendering:pixelated;image-rendering:crisp-edges;vertical-align:middle;margin-right:4px;border-radius:2px">'
        : '<span style="margin-right:4px">'+escapeHtmlSafe(plot.guildEmblem||'')+'</span>';
    }
    var _gTagHtml=_showGTag
      ? ('<span style="color:var(--mars)">['+escapeHtmlSafe(plot.guildTag)+']</span>'+(plot.guildName?' <span style="color:var(--tx3);font-size:9px">'+escapeHtmlSafe(plot.guildName)+'</span>':''))
      : '';
    _gCell.innerHTML=_gEmblem+_gTagHtml;
  }else{ guildRow.style.display='none'; }
  var pw=plot.w||plot.size||10, ph=plot.h||plot.size||10;
  var pxCount=plot._pixelCount||(pw*ph);
  document.getElementById('infoSize').textContent=pw+'×'+ph+' px ('+pxCount.toLocaleString()+' pixels)';
  document.getElementById('infoPrice').textContent=parseFloat(plot.price||0).toFixed(2)+' PP';
  if(plot.link){
    document.getElementById('linkRow').style.display='';
    _applyExternalLinkDisplay('infoLink', plot.link);
  }else{
    document.getElementById('linkRow').style.display='none';
  }
  // Show claim image (original GIF if available, otherwise static)
  var imgWrap=document.getElementById('infoImgWrap');
  var imgPreview=document.getElementById('infoImgPreview');
  var showUrl=plot.originalImgUrl||plot.imgUrl;
  if(showUrl){
    imgPreview.src=showUrl;
    imgWrap.style.display='';
    imgPreview._fullUrl=showUrl;
  }else{
    imgWrap.style.display='none';
  }
  // Show custom name if present
  var nameRow=document.getElementById('infoNameRow');
  if(plot.customName){
    nameRow.style.display='';
    document.getElementById('infoCustomName').textContent=plot.customName;
  }else{
    nameRow.style.display='none';
  }
  // Load territory description
  var descRow=document.getElementById('infoDescRow');
  if(descRow) descRow.style.display='none';
  if(plot.claimId) loadClaimDescriptionForInfo(plot.claimId);
  // Load sponsors
  var sponsorRow=document.getElementById('infoSponsorRow');
  if(sponsorRow) sponsorRow.style.display='none';
  if(plot.claimId) loadSponsorsForInfo(plot.claimId);
  // Show sponsor button only for others' territories
  var sponsorBtn=document.getElementById('infoSponsorBtn');
  if(sponsorBtn) sponsorBtn.style.display=(myW && plot.owner!==myW)?'':'none';
  // Show hijack button only for others' territories with claimId — cache prefill on element
  var hijackBtn=document.getElementById('infoHijackBtn');
  if(hijackBtn){
    var canHijack = !!(myW && plot.owner && plot.owner !== myW && plot.claimId);
    hijackBtn.style.display = canHijack ? '' : 'none';
    if (canHijack){
      hijackBtn.dataset.claimId = String(plot.claimId);
      hijackBtn.dataset.defWallet = String(plot.owner || '');
      var ownerLabel = plot.nickname || plot.label || (plot.owner ? plot.owner.slice(0,8)+'…' : '');
      hijackBtn.title = '⚔ HIJACK ' + ownerLabel + ' · #' + plot.claimId;
    }
  }
  // Load tributes
  var tributeRow=document.getElementById('infoTributeRow');
  if(tributeRow) tributeRow.style.display='none';
  if(plot.claimId) try{loadTributesForInfo(plot.claimId);}catch(_){}
  // Show tribute button only for others' territories
  var tributeBtn=document.getElementById('infoTributeBtn');
  if(tributeBtn) tributeBtn.style.display=(myW && plot.owner!==myW)?'':'none';
  // Load graffiti (shown for all territories)
  var graffitiRow=document.getElementById('infoGraffitiRow');
  if(graffitiRow) graffitiRow.style.display='none';
  if(plot.claimId) try{loadGraffitiForInfo(plot.claimId);}catch(_){}
  // Graffiti button shown when wallet connected
  var graffitiBtn=document.getElementById('infoGraffitiBtn');
  if(graffitiBtn) graffitiBtn.style.display=myW?'':'none';
  // Highlight (own territory only)
  var highlightRow=document.getElementById('infoHighlightRow');
  var highlightBtn=document.getElementById('infoHighlightBtn');
  if(highlightRow) highlightRow.style.display='none';
  if(highlightBtn) highlightBtn.style.display=(myW&&plot.owner===myW)?'':'none';
  if(plot.claimId) try{loadHighlightForInfo(plot.claimId);}catch(_){}
  // Rating (load for all, rate for others' territories)
  var ratingRow=document.getElementById('infoRatingRow');
  var rateWidget=document.getElementById('infoRateWidget');
  if(ratingRow) ratingRow.style.display='none';
  if(rateWidget) rateWidget.style.display=(myW&&plot.owner!==myW&&plot.claimId)?'':'none';
  if(plot.claimId) try{loadRatingForInfo(plot.claimId);}catch(_){}
  // Banners (show for all; plant for own)
  var bannerRow=document.getElementById('infoBannerRow');
  var bannerBtn=document.getElementById('infoBannerBtn');
  if(bannerRow) bannerRow.style.display='none';
  if(bannerBtn) bannerBtn.style.display=(myW&&plot.owner===myW&&plot.claimId)?'':'none';
  if(plot.claimId) try{loadBannersForInfo(plot.claimId);}catch(_){}
  // Prestige frame
  var prestigeBtn=document.getElementById('infoPrestigeBtn');
  if(prestigeBtn) prestigeBtn.style.display=(myW&&plot.owner===myW&&plot.claimId)?'':'none';
  if(plot.claimId) try{loadPrestigeForInfo(plot.claimId);}catch(_){}
  // Tombstones
  _tombstoneClaimId = plot.claimId || null;
  var tombstoneBtn=document.getElementById('infoTombstoneBtn');
  // Always show button if wallet connected and not current owner (server will validate prev ownership)
  if(tombstoneBtn) tombstoneBtn.style.display=(myW&&plot.owner!==myW&&plot.claimId)?'':'none';
  if(plot.claimId) try{loadTombstonesForInfo(plot.claimId);}catch(_){}
  // Show EDIT IMAGE + PROMO LINK + RENAME only for own territories
  var editBtn=document.getElementById('infoEditImgBtn');
  var linkEdit=document.getElementById('infoLinkEdit');
  var cosBtn=document.getElementById('infoCosmeticBtn');
  var cosPanel=document.getElementById('cosmeticPanel');
  if(myW&&plot.owner===myW){
    editBtn.style.display='';
    editBtn.textContent=plot.imgUrl?'EDIT IMAGE':'ADD IMAGE';
    linkEdit.style.display='';
    document.getElementById('infoLinkInput').value=plot.link||'';
    cosBtn.style.display='';
  }else{
    editBtn.style.display='none';
    linkEdit.style.display='none';
    cosBtn.style.display='none';
  }
  cosPanel.style.display='none';
  // Production summary (own territory only)
  var prodRow=document.getElementById('infoProdRow');
  if(prodRow){
    prodRow.style.display='none';
    if(_isMyPlot&&plot.claimId){
      loadTerritoryProduction(plot.claimId,myW2);
    }
  }
  // Upgrade panel (own territory only) — always expanded, auto-load
  _territoryUpgradeState.open = true;
  _territoryUpgradeState.data = null;
  var upgradeRow=document.getElementById('infoUpgradeRow');
  if(upgradeRow){
    if(_isMyPlot&&plot.claimId){
      upgradeRow.style.display='';
      loadTerritoryUpgrades(plot.claimId);
    } else {
      upgradeRow.style.display='none';
      var upgradeBody=document.getElementById('infoUpgradeBody');
      if(upgradeBody) upgradeBody.innerHTML='';
    }
  }
  // Identity panel (own territory only)
  var identityRow=document.getElementById('infoIdentityRow');
  if(identityRow){
    if(_isMyPlot&&plot.claimId){
      identityRow.style.display='';
      loadTerritoryIdentity(plot.claimId);
    } else {
      identityRow.style.display='none';
      var identityBody=document.getElementById('infoIdentityBody');
      if(identityBody) identityBody.innerHTML='';
    }
  }
}

// ── Territory Merge ──────────────────────────────────────────────────────────
async function openTerritoryMergePanel() {
  var w = (walletState && walletState.address) || '';
  if (!w) { gameAlert(t('connect_wallet_first') || 'Connect wallet first'); return; }
  var lang = (typeof LANG !== 'undefined' ? LANG : 'ko');

  // Get all my territories
  var myClaims = (window.claims || []).filter(function(c) {
    return (c.owner || '').toLowerCase() === w.toLowerCase();
  });

  if (!myClaims || myClaims.length < 2) {
    // Try fetching from API
    try {
      var data = await _territoryReadJson('my-territories', '/api/user/my-territories', 15000);
      myClaims = (data && data.territories) ? data.territories : (Array.isArray(data) ? data : []);
    } catch(_) {}
  }

  if (!myClaims || myClaims.length < 2) {
    gameAlert(lang === 'ko' ? '병합하려면 영토가 2개 이상 필요합니다' : lang === 'ja' ? '統合には2つ以上の領土が必要です' : lang === 'zh' ? '合并需要至少2个领地' : 'You need at least 2 territories to merge');
    return;
  }

  // Build territory list for selection
  var selectedIds = new Set();
  var currentClaimId = selectedPlot && selectedPlot.claimId;
  if (currentClaimId) selectedIds.add(String(currentClaimId));

  var renderList = function() {
    var html = '<div style="font-size:9px;color:var(--tx3);margin-bottom:8px;line-height:1.5">'
      + (lang === 'ko'
        ? '병합할 영토를 선택하세요. 선택한 영토들이 하나로 합쳐집니다.<br><span style="color:var(--mars)">⚠ 병합 후 원복 불가</span>'
        : lang === 'ja' ? '統合する領土を選択してください。選択した領土が一つになります。<br><span style="color:var(--mars)">⚠ 統合後は元に戻せません</span>'
        : lang === 'zh' ? '选择要合并的领地，选中的领地将合并为一个。<br><span style="color:var(--mars)">⚠ 合并后无法撤销</span>'
        : 'Select territories to merge into one. <span style="color:var(--mars)">⚠ Cannot be undone</span>')
      + '</div>';
    html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:10px">';
    myClaims.forEach(function(c) {
      var cid = String(c.claimId || c.id);
      var checked = selectedIds.has(cid);
      var name = c.customName || c.custom_name || ('Territory #' + cid);
      var px = c._pixelCount || c.pixel_count || ((c.w || c.width || 1) * (c.h || c.height || 1));
      html += '<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:4px;cursor:pointer;'
        + (checked ? 'background:rgba(129,212,250,.08);border:1px solid rgba(129,212,250,.25)' : 'background:transparent;border:1px solid transparent')
        + '">'
        + '<input type="checkbox" data-id="' + cid + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#81d4fa;width:14px;height:14px">'
        + '<span style="flex:1;font-size:9px;color:var(--tx)">' + name + '</span>'
        + '<span style="font-size:8px;color:var(--tx3)">' + px + ' px</span>'
        + '</label>';
    });
    html += '</div>';
    var sel = Array.from(selectedIds);
    var totalPx = myClaims.filter(function(c){ return selectedIds.has(String(c.claimId || c.id)); })
                          .reduce(function(s,c){ return s + (c._pixelCount || c.pixel_count || ((c.w||c.width||1)*(c.h||c.height||1))); }, 0);
    html += '<div style="font-size:9px;color:#81d4fa;margin-bottom:6px">'
      + (lang === 'ko' ? '선택: ' : lang === 'ja' ? '選択: ' : lang === 'zh' ? '已选: ' : 'Selected: ') + sel.length
      + (lang === 'ko' ? '개 / 총 ' : lang === 'ja' ? '個 / 計 ' : lang === 'zh' ? '个 / 共 ' : ' / ') + totalPx + ' px</div>';
    return html;
  };

  // Open modal
  var modal = document.createElement('div');
  modal.id = 'mergeTerritoryModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = '<div style="background:var(--bg2);border:1px solid rgba(129,212,250,.25);border-radius:12px;padding:16px;width:100%;max-width:360px;max-height:90vh;overflow-y:auto">'
    + '<div style="font-size:11px;font-weight:800;color:#81d4fa;font-family:var(--fn);letter-spacing:1px;margin-bottom:10px">🔗 '
    + (lang === 'ko' ? '영토 병합' : lang === 'ja' ? '領土統合' : lang === 'zh' ? '领地合并' : 'MERGE TERRITORIES') + '</div>'
    + '<div id="mergeTerritoryBody">' + renderList() + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:8px">'
    + '<button type="button" onclick="document.getElementById(\'mergeTerritoryModal\').remove()" style="flex:1;padding:8px;font-size:9px;font-family:var(--fn);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--tx3);border-radius:6px;cursor:pointer">'
    + (lang === 'ko' ? '취소' : lang === 'ja' ? 'キャンセル' : lang === 'zh' ? '取消' : 'CANCEL') + '</button>'
    + '<button type="button" id="mergeTerritoryConfirmBtn" onclick="doTerritoryMerge()" style="flex:2;padding:8px;font-size:9px;font-family:var(--fn);font-weight:800;background:rgba(129,212,250,.15);border:1px solid rgba(129,212,250,.35);color:#81d4fa;border-radius:6px;cursor:pointer">'
    + (lang === 'ko' ? '🔗 병합 실행' : lang === 'ja' ? '🔗 統合実行' : lang === 'zh' ? '🔗 执行合并' : '🔗 MERGE') + '</button>'
    + '</div></div>';
  document.body.appendChild(modal);

  // Listen for checkbox changes
  modal.addEventListener('change', function(e) {
    if (e.target.type === 'checkbox') {
      var cid = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(cid);
      else selectedIds.delete(cid);
      document.getElementById('mergeTerritoryBody').innerHTML = renderList();
      // Re-attach listeners after re-render
    }
  });

  // Store selected for confirm
  window._mergeSelectedIds = selectedIds;
}

async function doTerritoryMerge() {
  var w = (walletState && walletState.address) || '';
  var lang = (typeof LANG !== 'undefined' ? LANG : 'ko');
  var selectedIds = window._mergeSelectedIds;
  if (!selectedIds || selectedIds.size < 2) {
    showToast(lang === 'ko' ? '영토를 2개 이상 선택하세요' : lang === 'ja' ? '領土を2つ以上選択してください' : lang === 'zh' ? '请至少选择2个领地' : 'Select at least 2 territories', 'error');
    return;
  }
  var ids = Array.from(selectedIds).map(Number);
  var ok = await gameConfirm({
    icon: '🔗',
    title: lang === 'ko' ? '영토 병합 확인' : lang === 'ja' ? '領土統合の確認' : lang === 'zh' ? '确认领地合并' : 'CONFIRM MERGE',
    body: (lang === 'ko'
      ? ids.length + '개 영토를 하나로 병합합니다.<br><span style="color:var(--mars)">병합 후 되돌릴 수 없습니다.</span>'
      : lang === 'ja' ? ids.length + '個の領土を一つに統合します。<br><span style="color:var(--mars)">統合後は元に戻せません。</span>'
      : lang === 'zh' ? '将' + ids.length + '个领地合并为一个。<br><span style="color:var(--mars)">合并后无法撤销。</span>'
      : 'Merge ' + ids.length + ' territories into one.<br><span style="color:var(--mars)">This cannot be undone.</span>'),
    confirmText: lang === 'ko' ? '병합' : lang === 'ja' ? '統合' : lang === 'zh' ? '合并' : 'MERGE'
  });
  if (!ok) return;

  var btn = document.getElementById('mergeTerritoryConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = ({ko:'병합 중…',ja:'結合中…',zh:'合并中…'})[lang]||'Merging…'; }

  try {
    var d = await fetch('/api/territory/merge', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ wallet: w, claimIds: ids })
    }).then(function(r){return r.json();});

    if (d.error) {
      showToast(d.message || d.error, 'error');
      if (btn) { btn.disabled = false; btn.textContent = lang === 'ko' ? '🔗 병합 실행' : lang === 'ja' ? '🔗 統合実行' : lang === 'zh' ? '🔗 执行合并' : '🔗 MERGE'; }
      return;
    }

    // Success — close modal, reload claims
    var modal = document.getElementById('mergeTerritoryModal');
    if (modal) modal.remove();
    showToast((lang === 'ko'
      ? '✅ ' + ids.length + '개 영토가 병합됐습니다! (클레임 #' + d.mergedClaimId + ', ' + d.pixelCount + ' px)'
      : lang === 'ja' ? '✅ ' + ids.length + '個の領土を統合しました! (クレーム #' + d.mergedClaimId + ', ' + d.pixelCount + ' px)'
      : lang === 'zh' ? '✅ ' + ids.length + '个领地已合并! (领地 #' + d.mergedClaimId + ', ' + d.pixelCount + ' px)'
      : '✅ Merged into Claim #' + d.mergedClaimId + ' (' + d.pixelCount + ' px)'), 'success');

    // Reload territory data
    if (typeof loadClaims === 'function') loadClaims();
    else if (typeof refreshClaims === 'function') refreshClaims();
    window._mergeSelectedIds = null;
  } catch(e) {
    showToast(e.message || 'Error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = lang === 'ko' ? '🔗 병합 실행' : lang === 'ja' ? '🔗 統合実行' : lang === 'zh' ? '🔗 执行合并' : '🔗 MERGE'; }
  }
}

// ── Territory Bulk Harvest [v7.313] ──
async function harvestAllTerritories(){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  if(!(typeof emailAuth!=='undefined'&&emailAuth&&emailAuth.token)){ showToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  var wallet=((typeof getMyWallet==='function'?getMyWallet():'')||(walletState&&walletState.address)||'').toLowerCase();
  var mine=(window.claims||[]).filter(function(c){ return (c.owner||'').toLowerCase()===wallet; });
  if(!mine.length){ showToast(tl('No territory','보유 영토가 없습니다','領土がありません','无领地'),'error'); return; }
  var btn=(typeof event!=='undefined'&&event&&event.target)?event.target:null;
  var _prev=btn?btn.textContent:'';
  if(btn){ if(btn.disabled) return; btn.disabled=true; btn.textContent='...'; }
  try{
    var bulk=await fetch('/api/territory/harvest-all',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token}});
    var bd=await bulk.json().catch(function(){return{};});
    if(bulk.ok&&bd&&bd.success){
      if(btn){ btn.disabled=false; btn.textContent=_prev; }
      var bDrops={}; (bd.resources||[]).forEach(function(x){ bDrops[x.code]=(bDrops[x.code]||0)+x.quantity; });
      var bKeys=Object.keys(bDrops);
      var bDropTxt=bKeys.length?(' · '+bKeys.map(function(c){return c+'×'+bDrops[c];}).join(', ')):'';
      var bInfLabel=(bd.guildInfluenceHits||0)>0
        ? (lang==='ko'?'길드 영향력':lang==='ja'?'ギルド影響':lang==='zh'?'公会影响力':'guild influence')
        : (lang==='ko'?'섹터 영향력':lang==='ja'?'セクター影響':lang==='zh'?'区域影响力':'sector influence');
      var bInfTxt=(bd.influenceHits||0)>0?(' · '+bInfLabel+' ×'+(parseFloat(bd.bestInfluenceMult)||1).toFixed(2)+' ('+bd.influenceHits+')'):'';
      var bTotal=Math.round((parseFloat(bd.totalGP||bd.harvestedGP)||0)*10000)/10000;
      showToast((lang==='ko'?'⛏ 일괄 수확 ':lang==='ja'?'⛏ 一括収穫 ':lang==='zh'?'⛏ 批量收获 ':'⛏ Harvested ')+(bd.harvested||0)+(lang==='ko'?'건 (+'+bTotal+' GP)':lang==='ja'?'件 (+'+bTotal+' GP)':lang==='zh'?'个 (+'+bTotal+' GP)':' (+'+bTotal+' GP)')+bInfTxt+((bd.cooldown||0)>0?' · '+bd.cooldown+(lang==='ko'?' 쿨다운':' cd'):'')+bDropTxt,'success');
      try{ if(typeof loadGPBalance==='function') loadGPBalance(); }catch(_){}
      try{ if(typeof refreshGP==='function') refreshGP(); }catch(_){}
      try{ if(typeof _updateBaseTerritoryGroupList==='function') _updateBaseTerritoryGroupList(); }catch(_){}
      return;
    }
    if(bulk.status!==404&&bulk.status!==405&&bd&&bd.error==='harvest_on_cooldown'){
      if(btn){ btn.disabled=false; btn.textContent=_prev; }
      showToast((lang==='ko'?'수확할 영토 없음 (전부 쿨다운 중)':lang==='ja'?'収穫対象なし(クールダウン中)':lang==='zh'?'无可收获领地(冷却中)':'Nothing to harvest (all on cooldown)'),'error');
      return;
    }
  }catch(_bulkErr){}
  var harvested=0, cooldown=0, totalGP=0, drops={}, influenceHits=0, guildInfluenceHits=0, bestInfluenceMult=1;
  for(var i=0;i<mine.length;i++){
    try{
      var r=await fetch('/api/territory/'+mine[i].id+'/harvest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token}});
      var d=await r.json();
      if(r.ok&&d.success){
        harvested++;
        totalGP+=(d.harvestedGP||0);
        if(d.sectorInfluenceBonus&&d.sectorInfluenceBonus.multiplier>1){
          influenceHits++;
          if(d.sectorInfluenceBonus.source==='guild') guildInfluenceHits++;
          bestInfluenceMult=Math.max(bestInfluenceMult,d.sectorInfluenceBonus.multiplier);
        }
        if(d.resources){ d.resources.forEach(function(x){ drops[x.code]=(drops[x.code]||0)+x.quantity; }); }
      }
      else if(d.error==='harvest_on_cooldown'||r.status===429){ cooldown++; }
    }catch(e){}
  }
  if(btn){ btn.disabled=false; btn.textContent=_prev; }
  if(harvested>0){
    totalGP=Math.round(totalGP*10000)/10000;
    var dk=Object.keys(drops); var dropTxt=dk.length?(' · '+dk.map(function(c){return c+'×'+drops[c];}).join(', ')):'';
    var infLabel=guildInfluenceHits>0
      ? (lang==='ko'?'길드 영향력':lang==='ja'?'ギルド影響':lang==='zh'?'公会影响力':'guild influence')
      : (lang==='ko'?'섹터 영향력':lang==='ja'?'セクター影響':lang==='zh'?'区域影响力':'sector influence');
    var infTxt=influenceHits>0?(' · '+infLabel+' ×'+bestInfluenceMult.toFixed(2)+' ('+influenceHits+')'):'';
    showToast((lang==='ko'?'⛏ 일괄 수확 ':lang==='ja'?'⛏ 一括収穫 ':lang==='zh'?'⛏ 批量收获 ':'⛏ Harvested ')+harvested+(lang==='ko'?'건 (+'+totalGP+' GP)':lang==='ja'?'件 (+'+totalGP+' GP)':lang==='zh'?'个 (+'+totalGP+' GP)':' (+'+totalGP+' GP)')+infTxt+(cooldown>0?' · '+cooldown+(lang==='ko'?' 쿨다운':' cd'):'')+dropTxt,'success');
    try{ if(typeof loadGPBalance==='function') loadGPBalance(); }catch(_){}
    try{ if(typeof refreshGP==='function') refreshGP(); }catch(_){}
    try{ if(typeof _updateBaseTerritoryGroupList==='function') _updateBaseTerritoryGroupList(); }catch(_){}
  } else if(cooldown>0){
    showToast((lang==='ko'?'수확할 영토 없음 (전부 쿨다운 중)':lang==='ja'?'収穫対象なし(クールダウン中)':lang==='zh'?'无可收获领地(冷却中)':'Nothing to harvest (all on cooldown)'),'error');
  } else { showToast(tl('Harvest failed','수확 실패','収穫失敗','收获失败'),'error'); }
}

// ── Territory Production Summary ──
function tendAllTerritories(){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  if(!(typeof emailAuth!=='undefined'&&emailAuth&&emailAuth.token)){ showToast(tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'),'error'); return; }
  fetch('/api/territory/tend-all',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+emailAuth.token}})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){
        showToast((lang==='ko'?'🔧 일괄 정비 ':lang==='ja'?'🔧 一括整備 ':lang==='zh'?'🔧 批量维护 ':'🔧 Tended ')+d.tended+(lang==='ko'?'건 (-'+d.gpSpent+' GP)':lang==='ja'?'件 (-'+d.gpSpent+' GP)':lang==='zh'?'个 (-'+d.gpSpent+' GP)':' (-'+d.gpSpent+' GP)')+(d.remaining>0?' · '+d.remaining+(lang==='ko'?' 남음(GP/한도)':' left'):''),'success');
        try{ if(typeof loadGPBalance==='function') loadGPBalance(); }catch(_){}
        try{ if(typeof _updateBaseTerritoryGroupList==='function') _updateBaseTerritoryGroupList(); }catch(_){}
      } else {
        var msg=d.error==='nothing_to_tend'?(lang==='ko'?'정비할 영토 없음(모두 양호/쿨다운)':lang==='ja'?'整備対象なし':lang==='zh'?'无需维护':'Nothing to tend (all good/cooldown)')
          :d.error==='insufficient_gp'?(lang==='ko'?'GP 부족':'Insufficient GP')
          :d.error==='disabled'?(lang==='ko'?'영토 컨디션 시스템 비활성':'Condition system off')
          :(d.message||d.error||'failed');
        showToast(msg,'error');
      }
    })
    .catch(function(e){ showToast('Error: '+e.message,'error'); });
}
async function tendTerritory(claimId,wallet){
  var lang=(typeof LANG!=='undefined'?LANG:'ko');
  // [v7.278] 비용 사전표시 + 확인 — GP가 무고지 즉시 차감되던 문제 수정.
  var cost=(typeof window._tendCostGp==='number')?window._tendCostGp:50;
  if(typeof gameConfirm==='function'){
    var ok=await gameConfirm({
      icon:'🔧',
      title:(lang==='ko'?'영토 정비':lang==='ja'?'領土整備':lang==='zh'?'领地维护':'Tend Territory'),
      body:(lang==='ko'?'영토 컨디션을 회복하고 등급을 올립니다.':lang==='ja'?'領土コンディションを回復し等級を上げます。':lang==='zh'?'恢复领地状态并提升等级。':'Restore territory condition and raise its grade.'),
      info:[{k:(lang==='ko'?'비용':lang==='ja'?'費用':lang==='zh'?'费用':'Cost'), v:cost+' GP'}],
      confirmText:(lang==='ko'?'정비하기':lang==='ja'?'整備する':lang==='zh'?'维护':'TEND')
    });
    if(!ok) return;
  }
  var headers={'Content-Type':'application/json'};
  if(typeof emailAuth!=='undefined'&&emailAuth&&emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
  fetch('/api/territory/'+claimId+'/tend',{method:'POST',headers:headers})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.success){
        if(typeof showToast==='function') showToast((lang==='ko'?'🔧 정비 완료 — 등급 ':lang==='ja'?'🔧 整備完了 — 等級 ':lang==='zh'?'🔧 维护完成 — 等级 ':'🔧 Tended — Grade ')+d.grade+' ('+Math.round(d.condition)+'/100, -'+d.gpSpent+' GP)','success');
        try{ if(typeof loadGPBalance==='function') loadGPBalance(); else if(typeof refreshGP==='function') refreshGP(); }catch(_){}
        loadTerritoryProduction(claimId,wallet);
      } else {
        var msg=d.error==='insufficient_gp'?(lang==='ko'?'GP 부족 (필요 '+d.costGp+')':'Insufficient GP (need '+d.costGp+')')
          :d.error==='cooldown'?(lang==='ko'?'정비 쿨다운 중':'Tend on cooldown')
          :d.error==='already_full'?(lang==='ko'?'이미 최상 상태':'Already at full condition')
          :d.error==='not_owner'?(lang==='ko'?'소유자가 아닙니다':'Not the owner')
          :(d.error||'failed');
        if(typeof showToast==='function') showToast(msg,'error');
      }
    })
    .catch(function(e){ if(typeof showToast==='function') showToast('Error: '+e.message,'error'); });
}
function loadTerritoryProduction(claimId,wallet){
  if(!wallet) return;
  var prodRow=document.getElementById('infoProdRow');
  var prodBody=document.getElementById('infoProdBody');
  if(!prodRow||!prodBody) return;
  prodBody.textContent='Loading…';
  prodRow.style.display='';
  _territoryReadJson('production:'+claimId, '/api/territory/'+claimId+'/production', 8000)
    .then(function(d){
      if(!d){prodRow.style.display='none';return;}
      if(d.error){prodBody.textContent='—';return;}
      if(d.tendCostGp!=null) window._tendCostGp=d.tendCostGp; // [v7.278] TEND 비용 사전표시용 캐시
      var lang=(typeof LANG!=='undefined'?LANG:'ko');
      var html='';
      // PP estimate
      var ppMin=d.production&&d.production.ppMin||0;
      var ppMax=d.production&&d.production.ppMax||0;
      if(ppMin>0||ppMax>0){
        html+='<div style="display:flex;justify-content:space-between;padding:2px 0">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'예상 PP 수확':lang==='ja'?'予想PP収穫':lang==='zh'?'预估PP收获':'PP Estimate')+'</span>';
        html+='<span style="color:#ffab40;font-weight:700">'+ppMin.toFixed(4)+'~'+ppMax.toFixed(4)+' PP</span>';
        html+='</div>';
      }
      // 영토 컨디션(HP) + 등급 + 정비(TEND) [v7.135]
      // [v7.198] condition/grade 를 전역 캐시에 저장 — 업그레이드 패널 헤더 HP 미니 표시에서 재사용.
      if(typeof d.condition!=='undefined'){
        try { window._lastTerritoryCondition = Math.max(0,Math.min(100,parseFloat(d.condition)||0)); window._lastTerritoryGrade = d.grade || 'B'; } catch(_){}
      }
      if(typeof d.condition!=='undefined'&&d.owned){
        var cond=Math.max(0,Math.min(100,parseFloat(d.condition)||0));
        var grade=d.grade||'B';
        var gColor=({S:'#69f0ae',A:'#7cf0ff',B:'#ffd700',C:'#ffab40',D:'#ff8a65',F:'#ff5252'})[grade]||'#ffd700';
        var barColor=cond>=60?'#69f0ae':cond>=30?'#ffab40':'#ff5252';
        html+='<div style="padding:5px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:4px">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'영토 상태 (HP)':lang==='ja'?'領土状態(HP)':lang==='zh'?'领土状态(HP)':'Condition (HP)')+'</span>';
        html+='<span style="display:flex;align-items:center;gap:5px"><span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;color:'+gColor+';border:1px solid '+gColor+'66;background:'+gColor+'1a">'+grade+'</span><span style="color:'+barColor+';font-weight:700;font-size:9px">'+cond.toFixed(0)+'/100</span></span>';
        html+='</div>';
        html+='<div style="height:6px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+cond+'%;background:'+barColor+';transition:width .3s"></div></div>';
        html+='<button onclick="tendTerritory('+claimId+',\''+(wallet||'')+'\')" style="margin-top:5px;width:100%;font-size:8px;padding:5px;background:rgba(105,240,174,.1);border:1px solid rgba(105,240,174,.3);border-radius:6px;color:#69f0ae;cursor:pointer;font-family:var(--fn)">'+(lang==='ko'?'🔧 정비하기 (TEND)':lang==='ja'?'🔧 整備する (TEND)':lang==='zh'?'🔧 维护 (TEND)':'🔧 TEND')+'</button>';
        html+='</div>';
      }
      // Hold bonus
      var holdBonusPct = d.production && d.production.holdBonusPct || 0;
      var holdDays = d.production && d.production.holdDays || 0;
      if(holdBonusPct>0){
        var holdBadge = holdDays>=90
          ? (lang==='ko' ? '⛏ 개척자' : lang==='ja' ? '⛏ 開拓者' : lang==='zh' ? '⛏ 开拓者' : '⛏ Pioneer')
          : holdDays>=30
            ? (lang==='ko' ? '🏠 토지주' : lang==='ja' ? '🏠 地主' : lang==='zh' ? '🏠 地主' : '🏠 Landholder')
            : (lang==='ko' ? '🌱 정착민' : lang==='ja' ? '🌱 入植者' : lang==='zh' ? '🌱 定居者' : '🌱 Settler');
        html+='<div style="display:flex;justify-content:space-between;padding:2px 0;align-items:center">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'장기 보유 보너스':lang==='ja'?'長期保有ボーナス':lang==='zh'?'长期持有加成':'Hold Bonus')+'</span>';
        html+='<span style="display:flex;align-items:center;gap:4px"><span style="font-size:8px;padding:1px 5px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:10px;color:#ffd700">'+holdBadge+'</span><span style="color:#69f0ae;font-weight:700">+'+holdBonusPct+'%</span></span>';
        html+='</div>';
      }
      // Sector
      if(d.sector&&d.sector.type){
        var sectorLabel=lang==='ko'?{'core':'코어 섹터','mid':'미드 섹터','frontier':'프론티어 섹터'}:lang==='ja'?{'core':'コアセクター','mid':'ミッドセクター','frontier':'フロンティアセクター'}:lang==='zh'?{'core':'核心区域','mid':'中部区域','frontier':'边疆区域'}:{'core':'Core Sector','mid':'Mid Sector','frontier':'Frontier Sector'};
        html+='<div style="display:flex;justify-content:space-between;padding:2px 0">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'섹터':lang==='ja'?'セクター':lang==='zh'?'区域':'Sector')+'</span>';
        html+='<span style="color:var(--tx2)">'+((sectorLabel[d.sector.type]||d.sector.type.charAt(0).toUpperCase()+d.sector.type.slice(1)))+'</span>';
        html+='</div>';
      }
      // Modifiers + [v7.222 upgrade #4] 총 생산 배수 ×N.NN — 각 +% 를 곱연산해 "왜 이만큼 나오는지" 투명화.
      if(d.production&&d.production.modifiers&&d.production.modifiers.length){
        var _tm = _calcTotalMult(d.production.modifiers);
        html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px">';
        html+='<span style="font-size:8px;color:var(--tx3)">'+(lang==='ko'?'생산 배수':lang==='ja'?'生産倍率':lang==='zh'?'生产倍率':'Yield Mult')+'</span>';
        html+='<span style="font-size:10px;font-weight:800;color:#ffd166;text-shadow:0 0 8px rgba(255,209,102,.4)">×'+_tm.toFixed(2)+'</span>';
        html+='</div>';
        html+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">';
        d.production.modifiers.forEach(function(m){
          var lbl=lang==='ko'?(m.labelKo||m.label):lang==='ja'?(m.labelJa||m.labelEn||m.label):lang==='zh'?(m.labelZh||m.labelEn||m.label):(m.labelEn||m.label);
          html+='<span style="font-size:8px;padding:1px 5px;background:rgba(255,171,64,.1);border:1px solid rgba(255,171,64,.2);border-radius:10px;color:#ffab40">'+lbl+' '+m.value+'</span>';
        });
        html+='</div>';
      }
      // Materials
      if(d.materials&&d.materials.length){
        html+='<div style="margin-top:5px;font-size:8px;color:var(--tx3)">'+(lang==='ko'?'드롭 광물:':lang==='ja'?'ドロップ鉱物:':lang==='zh'?'掉落矿物:':'Drop materials:')+'</div>';
        html+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">';
        d.materials.forEach(function(m){
          var pct=Math.round(m.chance*100);
          var rarityColor={'common':'var(--tx2)','rare':'#64b5f6','special':'#ffb74d','legendary':'#ce93d8'}[m.rarity]||'var(--tx2)';
          var name=lang==='ko'?(m.nameKo||m.nameEn):lang==='ja'?(m.nameJa||m.nameEn):lang==='zh'?(m.nameZh||m.nameEn):m.nameEn;
          html+='<span title="'+pct+'% chance" style="font-size:8px;padding:1px 5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:'+rarityColor+'">';
          html+=m.icon+' '+name+' <span style="opacity:.6">'+pct+'%</span></span>';
        });
        html+='</div>';
      }
      // Last harvest
      if(d.lastHarvest&&d.lastHarvest.at){
        var ago=_timeAgo(new Date(d.lastHarvest.at));
        html+='<div style="margin-top:5px;display:flex;justify-content:space-between;padding:2px 0">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'최근 수확':lang==='ja'?'最近の採掘':lang==='zh'?'最近收获':'Last harvest')+'</span>';
        html+='<span style="color:var(--tx2)">'+d.lastHarvest.pp.toFixed(4)+' PP · '+ago+'</span>';
        html+='</div>';
        if(d.lastHarvest.materials&&d.lastHarvest.materials.length){
          var _RICONS2={iron_dust:'🟤',red_sand:'🔴',basalt_chip:'⬛',ice_crystal:'🔵',regolith_ore:'🟠',volcanic_shard:'🌋',ancient_metal:'⭐',carbon_fiber:'🧵',iron_ore:'🪨',silicon_chip:'💠',xenomatter:'💠',nano_polymer:'🧬',plasma_crystal:'🔮',titanium_alloy:'⚙️',meteorite_fragment:'☄️',plasma_dust:'💜',dark_matter:'🌑',exotic_alloy:'✨',quantum_core:'⚡',alloy_frame:'⬢',hull_plate:'▣',plasma_coil:'⚡'};
          html+='<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px">';
          d.lastHarvest.materials.forEach(function(m){
            html+='<span style="font-size:8px;padding:1px 4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:var(--tx2)">'+(_RICONS2[m.code]||'💠')+' +'+m.quantity+'</span>';
          });
          html+='</div>';
        }
      }
      // Next harvest
      if(d.production&&d.production.nextHarvestAt){
        var nxt=new Date(d.production.nextHarvestAt);
        var nowMs=Date.now();
        var diffMs=nxt-nowMs;
        var nextLabel='';
        if(diffMs>0){
          var hrs=Math.floor(diffMs/3600000);
          var mins=Math.floor((diffMs%3600000)/60000);
          nextLabel=(hrs>0?hrs+'h ':'')+mins+'m';
        }else{
          nextLabel=lang==='ko'?'지금 가능':lang==='ja'?'現在可能':lang==='zh'?'现在可用':'Available now';
        }
        html+='<div style="display:flex;justify-content:space-between;padding:2px 0">';
        html+='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'다음 수확':lang==='ja'?'次の採掘':lang==='zh'?'下次收获':'Next harvest')+'</span>';
        html+='<span style="color:'+(diffMs>0?'var(--tx3)':'#69f0ae')+'">';
        html+=nextLabel+'</span></div>';
      }
      if(!html) html='<span style="color:var(--tx3);font-size:8px">'+(lang==='ko'?'데이터 없음':lang==='ja'?'データなし':lang==='zh'?'无数据':'No production data')+'</span>';
      prodBody.innerHTML=html;
      // Append sector control info if sector is known
      if(d.sector&&d.sector.id&&wallet){
        _appendSectorControl(prodBody, d.sector.id, wallet, lang);
      }
    })
    .catch(function(){prodRow.style.display='none';});
}

function _appendSectorControl(container, sectorId, wallet, lang) {
  _territoryReadJson('sector-control:'+sectorId, '/api/sectors/'+sectorId+'/control', 15000)
    .then(function(d){
      if(!d) return;
      if(d.error||!d.sector) return;
      var TIER_LABELS = lang==='ko'?{ governor:'총독', dominant:'지배', stakeholder:'이해관계자', presence:'존재감' }:lang==='ja'?{ governor:'総督', dominant:'支配', stakeholder:'利害関係者', presence:'プレゼンス' }:lang==='zh'?{ governor:'总督', dominant:'主导', stakeholder:'利益相关者', presence:'存在感' }:{ governor:'Governor', dominant:'Dominant', stakeholder:'Stakeholder', presence:'Presence' };
      var TIER_COLORS = { governor:'#ffd700', dominant:'#ff6b6b', stakeholder:'#ffc140', presence:'#64dc82' };
      var html='<div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.07)">';
      html+='<div style="font-size:8px;color:#bb86fc;font-weight:700;letter-spacing:.8px;margin-bottom:4px">🏛 ' + (lang==='ko'?'섹터 컨트롤':lang==='ja'?'セクター支配':lang==='zh'?'区域控制':'SECTOR CONTROL') + '</div>';
      // Top owners
      if(d.owners&&d.owners.length){
        html+='<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:4px">';
        d.owners.slice(0,3).forEach(function(o,i){
          var tierColor = o.influenceTier ? (TIER_COLORS[o.influenceTier]||'var(--tx2)') : 'var(--tx3)';
          var tierLabel = o.influenceTier ? (TIER_LABELS[o.influenceTier]||o.influenceTier) : '';
          var isMe = o.wallet===wallet.toLowerCase();
          var wShort = o.wallet.slice(0,6)+'…'+o.wallet.slice(-4);
          html+='<div style="display:flex;justify-content:space-between;align-items:center">';
          html+='<span style="font-size:8px;color:'+(isMe?'#69f0ae':'var(--tx2)')+(isMe?';font-weight:700':'')+'">'+['🥇','🥈','🥉'][i]+' '+(isMe?'('+(lang==='ko'?'나':lang==='ja'?'自分':lang==='zh'?'我':'me')+') ':'')+wShort+'</span>';
          html+='<span style="font-size:8px">';
          if(o.battleScore>0) html+='<span style="color:#ff7043;margin-right:4px">⚔+'+o.battleScore+'</span>';
          if(tierLabel) html+='<span style="color:'+tierColor+';margin-right:3px">'+tierLabel+'</span>';
          html+='<span style="color:var(--tx3)">'+o.controlPct+'%</span></span>';
          html+='</div>';
        });
        html+='</div>';
      }
      // My position if not in top 3
      if(d.myEntry&&d.myEntry.totalScore>0){
        var myInTop3 = d.owners&&d.owners.slice(0,3).some(function(o){return o.wallet===wallet.toLowerCase();});
        if(!myInTop3){
          var myTierColor = d.myEntry.influenceTier ? (TIER_COLORS[d.myEntry.influenceTier]||'var(--tx2)') : 'var(--tx3)';
          var myTierLabel = d.myEntry.influenceTier ? (TIER_LABELS[d.myEntry.influenceTier]||d.myEntry.influenceTier) : (lang==='ko'?'영향력 없음':lang==='ja'?'影響力なし':lang==='zh'?'无影响力':'No influence');
          html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:rgba(105,240,174,.06);border:1px solid rgba(105,240,174,.15);border-radius:4px">';
          html+='<span style="font-size:8px;color:#69f0ae;font-weight:700">'+(lang==='ko'?'내 위치':lang==='ja'?'自分の位置':lang==='zh'?'我的位置':'My position')+'</span>';
          html+='<span style="font-size:8px;color:'+myTierColor+'">'+(d.myEntry.battleScore>0?('⚔+'+d.myEntry.battleScore+' · '):'')+myTierLabel+' · '+d.myEntry.controlPct+'%</span>';
          html+='</div>';
        }
      }
      // No owners
      if(!d.owners||!d.owners.length){
        html+='<div style="font-size:8px;color:var(--tx3)">'+(lang==='ko'?'이 섹터는 아직 미개척입니다':lang==='ja'?'このセクターは未開拓です':lang==='zh'?'该区域尚未被开拓':'This sector is unclaimed')+'</div>';
      }
      html+='</div>';
      container.innerHTML += html;
    })
    .catch(function(){}); // sector control is non-critical
}
function _timeAgo(date){
  var diff=Math.floor((Date.now()-date.getTime())/1000);
  var lang=(typeof LANG!=='undefined'&&LANG)||'en';
  if(diff<60){
    if(lang==='ko') return diff+'초 전';
    if(lang==='ja') return diff+'秒前';
    if(lang==='zh') return diff+'秒前';
    return diff+'s ago';
  }
  if(diff<3600){
    var mins=Math.floor(diff/60);
    if(lang==='ko') return mins+'분 전';
    if(lang==='ja') return mins+'分前';
    if(lang==='zh') return mins+'分钟前';
    return mins+'m ago';
  }
  if(diff<86400){
    var hrs=Math.floor(diff/3600);
    if(lang==='ko') return hrs+'시간 전';
    if(lang==='ja') return hrs+'時間前';
    if(lang==='zh') return hrs+'小时前';
    return hrs+'h ago';
  }
  var days=Math.floor(diff/86400);
  if(lang==='ko') return days+'일 전';
  if(lang==='ja') return days+'日前';
  if(lang==='zh') return days+'天前';
  return days+'d ago';
}

// 모바일 업그레이드 버튼 → 현재 선택 영토 업그레이드 패널로 직접 이동
// [v7.205] 사이드바 슬라이드 인 폐기 → 영토 업그레이드 전용 모달 사용.
//   모바일/데스크탑 일관된 UX. 모달 안에 HP/등급 + 업그레이드 트랙 + 비용 정보 모두 표시.
function scrollToTerritoryUpgrade() {
  var claim = selectedPlot;
  if (claim && (claim.claimId || claim.id)) {
    openTerritoryUpgradeModal(claim.claimId || claim.id, claim);
  } else {
    var tab = document.getElementById('baseTabTerritory');
    if (tab) { openBaseModal(); switchBaseTab('territory', tab); }
  }
}

// [v7.205] 영토 업그레이드 전용 모달 — 데스크탑/모바일 공용.
window.openTerritoryUpgradeModal = function(claimId, plotMeta) {
  var modal = document.getElementById('territoryUpgradeModal');
  if (!modal) return;
  // 메타 — 좌표 / 크기 표시
  var meta = document.getElementById('territoryUpgradeModalMeta');
  if (meta && plotMeta) {
    var coord = (plotMeta.lat!=null && plotMeta.lng!=null) ? (plotMeta.lat.toFixed(1)+'°, '+plotMeta.lng.toFixed(1)+'°') : '';
    var size  = (plotMeta.w && plotMeta.h) ? (' · '+(plotMeta.w*plotMeta.h)+' px') : '';
    meta.textContent = coord + size;
  } else if (meta) {
    meta.textContent = '#' + claimId;
  }
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // 배경 스크롤 차단
  // [v7.215 iOS phantom-click 가드] 모달 open 직후 350ms 동안 backdrop close 차단.
  //   iOS Safari touchend→click 합성 이벤트로 backdrop 즉시 닫힘 방지.
  modal.dataset.openedAt = String(Date.now());
  // body 가 만들어진 후 loadTerritoryUpgrades 호출 (모달용 targetBodyId).
  setTimeout(function(){
    loadTerritoryUpgrades(claimId, 'territoryUpgradeModalBody');
  }, 50);
};
window.closeTerritoryUpgradeModal = function() {
  var modal = document.getElementById('territoryUpgradeModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
};
// ESC 로 닫기
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') {
    var m = document.getElementById('territoryUpgradeModal');
    if (m && m.style.display !== 'none') closeTerritoryUpgradeModal();
  }
});

// ── Territory Upgrade Panel (P5-4) ──────────────────────────────────
var _territoryUpgradeState = { open: true, data: null, loading: false };

function toggleTerritoryUpgradePanel() {
  var body = document.getElementById('infoUpgradeBody');
  var icon = document.getElementById('infoUpgradeToggleIcon');
  if (!body) return;
  _territoryUpgradeState.open = !_territoryUpgradeState.open;
  body.style.display = _territoryUpgradeState.open ? '' : 'none';
  if (icon) icon.textContent = _territoryUpgradeState.open ? '▼' : '▶';
  if (_territoryUpgradeState.open && !_territoryUpgradeState.data && selectedPlot && selectedPlot.claimId) {
    loadTerritoryUpgrades(selectedPlot.claimId);
  }
}

// [v7.205] targetBodyId 인자 추가 — 'infoUpgradeBody'(사이드 패널) 또는 'territoryUpgradeModalBody'(모달).
//   기본값 'infoUpgradeBody' 로 기존 호출자 호환성 유지.
function loadTerritoryUpgrades(claimId, targetBodyId) {
  targetBodyId = targetBodyId || 'infoUpgradeBody';
  var body = document.getElementById(targetBodyId);
  if (!body) return;
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  // [v7.198 fix] HP 캐시 없으면 같이 로드 — 업그레이드 패널 헤더 HP 미니 표시용.
  if (wallet && typeof window._lastTerritoryCondition !== 'number' && typeof loadTerritoryProduction === 'function') {
    try { loadTerritoryProduction(claimId, wallet); } catch(_){}
  }
  body.innerHTML = '<div style="font-size:9px;color:var(--tx3);padding:4px 0">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
  _territoryUpgradeState.loading = true;
  _territoryReadJson('upgrades:' + claimId, '/api/territory/' + claimId + '/upgrades', 10000)
    .then(function(d){
      _territoryUpgradeState.loading = false;
      if (!d) {
        body.innerHTML = '<div style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'잠시 후 다시 시도하세요':LANG==='ja'?'少し待って再試行してください':LANG==='zh'?'请稍后重试':'Please wait a moment and retry')+'</div>';
        return;
      }
      _territoryUpgradeState.data = d;
      renderTerritoryUpgradeBody(d, claimId, wallet, targetBodyId);
    })
    .catch(function(){
      _territoryUpgradeState.loading = false;
      body.innerHTML = '<div style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'업그레이드 데이터를 불러올 수 없습니다':LANG==='ja'?'アップグレードデータを読み込めません':LANG==='zh'?'无法加载升级数据':'Failed to load upgrade data')+'</div>';
    });
}

function renderTerritoryUpgradeBody(d, claimId, wallet, targetBodyId) {
  // [v7.205] targetBodyId 추가 — 모달/사이드 패널 공용.
  targetBodyId = targetBodyId || 'infoUpgradeBody';
  var body = document.getElementById(targetBodyId);
  if (!body) return;
  var lang = (typeof LANG !== 'undefined' ? LANG : 'ko');
  var catalog = d.catalog || [];
  var current = d.current || {};
  if (!catalog.length) {
    body.innerHTML = '<div style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'업그레이드 트랙 없음':LANG==='ja'?'アップグレードトラックなし':LANG==='zh'?'无升级轨道':'No upgrade tracks')+'</div>';
    return;
  }
  // [v7.198 fix] HP/등급 미니 표시 — 업그레이드 패널 상단에 condition + grade 같이.
  //   이전엔 HP가 PRODUCTION 패널 안에만 있었고 업그레이드만 보는 유저는 영토 상태 모름.
  //   /api/territory/:id/upgrades 응답에 condition/grade 가 없어서 prod 데이터 캐시 활용.
  var hpHtml = '';
  try {
    var cond = (typeof window._lastTerritoryCondition === 'number') ? window._lastTerritoryCondition : null;
    var grade = window._lastTerritoryGrade || null;
    if (cond !== null) {
      var gColor=({S:'#69f0ae',A:'#7cf0ff',B:'#ffd700',C:'#ffab40',D:'#ff8a65',F:'#ff5252'})[grade]||'#ffd700';
      var barColor=cond>=60?'#69f0ae':cond>=30?'#ffab40':'#ff5252';
      hpHtml = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:6px;background:rgba(255,255,255,.03);border:1px solid '+gColor+'33;border-radius:6px">'
        + '<span style="font-size:8px;color:var(--tx3)">'+(lang==='ko'?'영토 상태':lang==='ja'?'領土状態':lang==='zh'?'领土状态':'Condition')+'</span>'
        + '<span style="display:flex;align-items:center;gap:5px"><span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;color:'+gColor+';border:1px solid '+gColor+'66;background:'+gColor+'1a">'+(grade||'B')+'</span>'
        + '<span style="color:'+barColor+';font-weight:700;font-size:9px">'+cond.toFixed(0)+'/100</span></span>'
        + '</div>';
    }
  } catch(_){}
  var html = hpHtml + '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">';
  catalog.forEach(function(track) {
    var cur = current[track.key];
    var curLevel = cur ? cur.level : 0;
    var maxLevel = track.levels ? track.levels.length : 5;
    var nextLevel = track.levels && track.levels[curLevel];
    var nextCost = nextLevel ? nextLevel.cost : null;
    var nextBonus = nextLevel ? nextLevel.bonus : null;
    var atMax = curLevel >= maxLevel;
    // Level bar
    var barHtml = '';
    for (var i = 1; i <= maxLevel; i++) {
      barHtml += '<span style="display:inline-block;width:8px;height:4px;border-radius:2px;margin-right:1px;background:' + (i <= curLevel ? track.color : 'rgba(255,255,255,.1)') + '"></span>';
    }
    html += '<div style="padding:6px 8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
    html += '<span style="font-size:9px;color:' + track.color + ';font-weight:700">' + track.icon + ' ' + (lang === 'ko' ? (track.name || track.nameEn) : (track.nameEn || track.name)) + '</span>';
    html += '<span style="font-size:8px;color:var(--tx3)">Lv ' + curLevel + '/' + maxLevel + '</span>';
    html += '</div>';
    html += '<div style="margin-bottom:4px">' + barHtml + '</div>';
    html += '<div style="font-size:8px;color:var(--tx3);margin-bottom:4px">' + fcEsc(track.desc) + '</div>';
    if (!atMax && nextCost !== null) {
      // [v7.214 fix] 레드팀 🟡 #7 — GP 부족 시 버튼 자체 disabled. 이전엔 클릭해야 confirm 모달 disabled 보고 무반응 인식.
      var _myGp214 = Number((walletState && walletState.gameGP)||0);
      var _insufficient214 = _myGp214 < (nextCost||0);
      var _btnDis = _insufficient214 ? ' disabled style="padding:2px 8px;border-radius:4px;border:1px solid '+track.color+'55;background:rgba(255,255,255,.02);color:'+track.color+'66;font-size:8px;font-family:var(--fn);font-weight:700;cursor:not-allowed;opacity:.55" title="GP 부족"' : ' style="padding:2px 8px;border-radius:4px;border:1px solid '+track.color+';background:rgba(255,255,255,.04);color:'+track.color+';font-size:8px;font-family:var(--fn);font-weight:700;cursor:pointer"';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="font-size:8px;color:var(--tx2)">Lv' + (curLevel + 1) + ': +' + nextBonus + ' ' + track.bonusUnit + '</span>';
      html += '<button type="button" data-territory-upgrade-claim="' + fcEsc(claimId) + '" data-territory-upgrade-type="' + fcEsc(track.key) + '"' + _btnDis + '>⬆ ' + nextCost + ' GP</button>';
      html += '</div>';
    } else if (atMax) {
      html += '<div style="font-size:8px;color:#69f0ae;font-weight:700">✅ MAX</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  body.innerHTML = html;
  body.onclick = function(event) {
    var btn = event.target && event.target.closest ? event.target.closest('button[data-territory-upgrade-type]') : null;
    if (!btn || !body.contains(btn)) return;
    event.stopPropagation();
    // [v7.213 fix] 레드팀 🔴 #5 — in-flight 가드. await gameConfirm 동안 중복 클릭 시 confirm 모달 두 번 쌓이고
    //   GP 두 번 차감 가능. 처리 중인 버튼은 disabled + 시각 표시.
    if (btn.disabled || btn.dataset.busy === '1') return;
    btn.dataset.busy = '1'; btn.disabled = true;
    var prevText = btn.textContent;
    btn.textContent = '...';
    var btnClaimId = parseInt(btn.getAttribute('data-territory-upgrade-claim'), 10);
    var upgradeType = btn.getAttribute('data-territory-upgrade-type');
    console.log('[BTN] upgrade click ' + btnClaimId + '/' + upgradeType);
    if (typeof doTerritoryUpgrade !== 'function') {
      btn.disabled = false; btn.dataset.busy = '0'; btn.textContent = prevText;
      alert('doTerritoryUpgrade NOT DEFINED — 캐시 미갱신');
      return;
    }
    Promise.resolve(doTerritoryUpgrade(btnClaimId, upgradeType)).finally(function(){
      // 응답 후 버튼 복구 — render redraw 가 이 버튼 자체를 교체하기 전에 finally 가 먼저 돌 수도 있어 safe.
      try { if (btn && body.contains(btn)) { btn.disabled = false; btn.dataset.busy = '0'; btn.textContent = prevText; } } catch(_){}
    });
  };
}

async function doTerritoryUpgrade(claimId, upgradeType) {
  // [v7.200 fix] 사용자 보고 "어디서든 튕긴다" — 모달 안 뜨고 튕긴다는 의미.
  //   진단: 함수 진입 즉시 console 로그 + try 전체 wrap. 첫 줄에서 throw 나도 silent 아님.
  console.log('[territoryUpgrade] click', { claimId, upgradeType });
  try {
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  if (!wallet) return showFactionToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'), 'error');
  // [v7.198 fix] 이전엔 confirm body 가 "EXTRACTOR 업그레이드 하시겠습니까?" 한 줄뿐이라
  //   유저가 뭐가 좋아지는지·얼마 드는지 모르고 튕긴다고 느낌. 캐시된 _territoryUpgradeState.data 에서
  //   track 정보를 꺼내 현재 레벨/다음 레벨/보너스/비용을 info 테이블로 표시.
  var _data = _territoryUpgradeState && _territoryUpgradeState.data;
  var track = null;
  if (_data && Array.isArray(_data.catalog)) {
    track = _data.catalog.find(function(t){ return t && t.key === upgradeType; });
  }
  var curLevel = 0, nextBonus = '', nextCost = 0, trackName = upgradeType.replace(/_/g,' ').toUpperCase(), trackIcon = '🔧';
  if (track) {
    var cur = (_data.current||{})[upgradeType];
    curLevel = cur ? cur.level : 0;
    var nextLv = track.levels && track.levels[curLevel];
    if (nextLv) { nextCost = nextLv.cost || 0; nextBonus = nextLv.bonus || ''; }
    trackName = (LANG==='ko' && track.name) ? track.name : (track.nameEn || track.name || trackName);
    trackIcon = track.icon || '🔧';
  }
  var myGp = Number((walletState && walletState.gameGP)||0);
  var insufficient = myGp < nextCost;
  var _upgrTitle = trackIcon + ' ' + trackName + ' ' + (LANG==='ko'?'업그레이드':LANG==='ja'?'アップグレード':LANG==='zh'?'升级':'Upgrade');
  var _upgrConfirm = LANG==='ko'?'업그레이드':LANG==='ja'?'アップグレード':LANG==='zh'?'升级':'Upgrade';
  var _upgrBody = '<div style="font-size:10px;color:var(--tx2);line-height:1.5">'
    + (track && track.desc ? '<div style="color:var(--tx3);margin-bottom:6px">'+_esc(track.desc)+'</div>' : '')
    + '<div>'+(LANG==='ko'?'레벨':LANG==='ja'?'レベル':LANG==='zh'?'等级':'Level')+': <b style="color:#fff">Lv ' + curLevel + ' → Lv ' + (curLevel+1) + '</b></div>'
    + (nextBonus ? '<div>'+(LANG==='ko'?'다음 효과':LANG==='ja'?'次の効果':LANG==='zh'?'下个效果':'Next bonus')+': <b style="color:#69f0ae">+' + nextBonus + ' ' + (track.bonusUnit||'') + '</b></div>' : '')
    + '</div>';
  var ok = await gameConfirm({
    icon: trackIcon,
    title: _upgrTitle,
    body: _upgrBody,
    info: [
      { k: (LANG==='ko'?'비용':LANG==='ja'?'費用':LANG==='zh'?'费用':'Cost'), v: (nextCost||0).toLocaleString()+' GP' },
      { k: (LANG==='ko'?'보유 GP':LANG==='ja'?'所持GP':LANG==='zh'?'拥有GP':'Balance'), v: Math.floor(myGp).toLocaleString()+' GP', insufficient: insufficient }
    ],
    confirmText: _upgrConfirm,
    disabled: insufficient
  });
  if (!ok) return;
  try {
    var res = await fetch('/api/territory/' + claimId + '/upgrade', {
      method: 'POST',
      headers: Object.assign({'Content-Type':'application/json'}, getAuthHeaders()),
      body: JSON.stringify({ wallet, upgradeType })
    });
    var data = await res.json();
    if (!res.ok) {
      // [v7.198] srvErr 헬퍼로 4언어 매핑.
      var em = (typeof srvErr === 'function') ? srvErr(data.error||'UPGRADE_FAILED')
             : (data.error||(LANG==='ko'?'알 수 없는 오류':'Unknown error'));
      showFactionToast((LANG==='ko'?'업그레이드 실패: ':LANG==='ja'?'アップグレード失敗: ':LANG==='zh'?'升级失败: ':'Upgrade failed: ')+em, 'error');
      return;
    }
    showToast('🔧 ' + trackName + ' Lv' + data.level + ' '+(LANG==='ko'?'완료! (-':LANG==='ja'?'完了! (-':LANG==='zh'?'完成! (-':'done! (-')+(data.cost||0).toLocaleString()+' GP)', 'success');
    // Reload GP balance and upgrade panel
    if (typeof loadGPBalance === 'function') loadGPBalance();
    if (typeof refreshGP === 'function') refreshGP();
    _territoryUpgradeState.data = null;
    if (_territoryUpgradeState.open && selectedPlot && selectedPlot.claimId === claimId) {
      loadTerritoryUpgrades(claimId);
    }
    // Also reload production to show updated modifiers + HP
    if (wallet && selectedPlot && selectedPlot.claimId === claimId) {
      loadTerritoryProduction(claimId, wallet);
    }
  } catch (e) {
    // [v7.198] 이전엔 catch 가 silent → 콘솔에 에러 흔적 안 남아 디버깅 불가.
    console.error('[territoryUpgrade] request error:', e);
    showFactionToast((LANG==='ko'?'업그레이드 요청 실패: ':LANG==='ja'?'要求失敗: ':LANG==='zh'?'请求失败: ':'Request failed: ')+(e.message||'network'), 'error');
  }
  } catch (outerErr) {
    // [v7.200 fix] doTerritoryUpgrade 전체를 외부 try 로 감싸 — 함수 어디서든 throw 해도 silent 가 아닌
    //   명시적 toast + console.error. 사용자에게 "튕긴다" 인상이 사라지고, 콘솔 보면 정확한 위치 알 수 있음.
    console.error('[territoryUpgrade] OUTER catch:', outerErr);
    try { showFactionToast('Upgrade UI error: ' + (outerErr.message || outerErr), 'error'); } catch(_){}
    try { alert('Territory upgrade error (please report): ' + (outerErr.message || outerErr)); } catch(_){}
  }
}

// ══ TERRITORY IDENTITY ════════════════════════════════════════

var _frTierIcons = { newcomer:'🌱', pioneer:'⛏', settler:'🏠', fortress:'🛡', legend:'🌟' };

function loadTerritoryIdentity(claimId) {
  var nameEl = document.getElementById('infoIdentityName');
  var metaEl = document.getElementById('infoIdentityMeta');
  var body   = document.getElementById('infoIdentityBody');
  if (!body) return;
  body.innerHTML = '<div style="font-size:9px;color:var(--tx3)">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';

  fetch('/api/territory/' + claimId + '/identity')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (!d.success || !d.identity) { body.innerHTML = ''; return; }
      var id = d.identity;

      // 이름
      var displayName = id.nickname ? _esc(id.nickname) : (id.owner ? id.owner.slice(0,6)+'…'+id.owner.slice(-4) : '—');
      var tierIcon = (_frTierIcons && _frTierIcons[id.fr_tier && id.fr_tier.tier]) || '🏔️';
      if (nameEl) nameEl.innerHTML = tierIcon + ' ' + displayName;

      // 소유자 / 섹터
      var ownerShort = id.owner ? id.owner.slice(0,6)+'…'+id.owner.slice(-4) : '—';
      var sectorStr  = id.sector_code || '—';
      if (metaEl) metaEl.innerHTML =
        (LANG==='ko'?'소유자: ':LANG==='ja'?'オーナー: ':LANG==='zh'?'所有者: ':'Owner: ') + ownerShort + '<br>' + (LANG==='ko'?'섹터: ':LANG==='ja'?'セクター: ':LANG==='zh'?'区域: ':'Sector: ') + sectorStr
        + (id.bio ? '<br><span style="color:rgba(255,255,255,.45)">' + _esc(id.bio) + '</span>' : '');

      // 🏅 Field Rating 배지
      var frHtml = '';
      if (id.field_rating !== undefined) {
        var fr = id.field_rating || 0;
        var frTierData = id.fr_tier || {};
        var frLabel = LANG==='ko'
          ? (frTierData.label_ko || frTierData.label_en || '신규')
          : LANG==='ja'
            ? (frTierData.label_ja || frTierData.label_en || '新規')
          : LANG==='zh'
              ? (frTierData.label_zh || frTierData.label_en || '新手')
              : (frTierData.label_en || 'New');
        var frIcon  = frTierData.icon || '🌱';
        // 보너스 PP%: tier에 따른 매핑
        var frBonusMap = { newcomer: 0, pioneer: 5, settler: 12, fortress: 20, legend: 25 };
        var frBonus = frBonusMap[frTierData.tier] || 0;
        var frColor = fr >= 100 ? '#ffd700' : fr >= 60 ? '#e1bee7' : fr >= 30 ? '#4fc3f7' : fr >= 10 ? '#66bb6a' : 'rgba(255,255,255,.4)';
        frHtml = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:6px">'
          + '<div style="font-size:18px;line-height:1">' + frIcon + '</div>'
          + '<div style="flex:1">'
          + '<div style="font-size:9px;color:rgba(255,255,255,.35);letter-spacing:.5px;margin-bottom:1px">FIELD RATING</div>'
          + '<div style="display:flex;align-items:baseline;gap:5px">'
          + '<span style="font-size:16px;font-weight:900;font-family:var(--fn);color:' + frColor + '">' + fr + '</span>'
          + '<span style="font-size:9px;color:' + frColor + ';font-weight:700">' + frLabel + '</span>'
          + '</div>'
          + '</div>'
          + (frBonus > 0 ? '<span style="font-size:9px;color:#66bb6a;font-weight:700;background:rgba(76,216,154,.1);border:1px solid rgba(76,216,154,.25);padding:2px 6px;border-radius:4px">+' + frBonus + '% PP</span>' : '')
          + '</div>';
      }

      // 📜 이력
      var history = [];
      if (id.hold_days > 0)             history.push(id.hold_days + (LANG==='ko'?' 일 보유 중':LANG==='ja'?' 日保有中':LANG==='zh'?' 天持有中':' days held'));
      if (id.defense_wins > 0)          history.push(id.defense_wins + (LANG==='ko'?' 회 방어 성공':LANG==='ja'?' 回防衛成功':LANG==='zh'?' 次防御成功':' defense wins'));
      if (id.times_hijacked > 0)        history.push(id.times_hijacked + (LANG==='ko'?' 회 탈환 기록':LANG==='ja'?' 回ハイジャック':LANG==='zh'?' 次被劫持':' hijacks'));
      if (id.longest_hold_days > 0)     history.push((LANG==='ko'?'최대 보유 기록: ':LANG==='ja'?'最長保有: ':LANG==='zh'?'最长持有: ':'Longest hold: ') + id.longest_hold_days + (LANG==='ko'?' 일':LANG==='ja'?' 日':LANG==='zh'?' 天':' days'));

      var historyHtml = '';
      if (history.length > 0) {
        historyHtml = '<div style="margin-bottom:7px">'
          + '<div style="font-size:8px;color:rgba(255,255,255,.35);letter-spacing:1px;margin-bottom:4px">📜 '+(LANG==='ko'?'이력':LANG==='ja'?'履歴':LANG==='zh'?'历史':'History')+'</div>'
          + history.map(function(h){
              return '<div style="display:flex;align-items:center;gap:5px;margin-bottom:1px">'
                + '<span style="color:rgba(225,190,231,.5);font-size:9px">•</span>'
                + '<span style="font-size:9px;color:var(--tx2)">' + h + '</span>'
                + '</div>';
            }).join('')
          + '</div>';
      }

      // 🏆 배지
      var badgesHtml = '';
      if (id.badges && id.badges.length > 0) {
        var chips = id.badges.map(function(b){
          var bkey = 'territory_badge_' + b.id;
          var label = (typeof t === 'function' ? t(bkey) : '') || b.label_en || b.id;
          return '<span style="font-size:8px;background:rgba(225,190,231,.1);border:1px solid rgba(225,190,231,.3);color:#e1bee7;padding:2px 7px;border-radius:8px;margin-right:4px;margin-bottom:3px;display:inline-block">' + label + '</span>';
        }).join('');
        badgesHtml = '<div style="margin-top:4px">'
          + '<div style="font-size:8px;color:rgba(255,255,255,.35);letter-spacing:1px;margin-bottom:4px">🏆 '+(LANG==='ko'?'배지':LANG==='ja'?'バッジ':LANG==='zh'?'徽章':'Badges')+'</div>'
          + '<div>' + chips + '</div>'
          + '</div>';
      }

      body.innerHTML = frHtml + historyHtml + badgesHtml;
    })
    .catch(function() { if (body) body.innerHTML = ''; });
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function openTerritoryIdentityEdit() {
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  var claimId = selectedPlot && selectedPlot.claimId;
  if (!wallet || !claimId) return;

  // Fetch current
  var current = {};
  try {
    var r = await fetch('/api/territory/' + claimId + '/identity');
    var d = await r.json();
    if (d.success) current = d.identity || {};
  } catch(_) {}

  var nickname = await gameInput({
    title: t('territory_identity_title'),
    label: t('territory_nickname'),
    placeholder: 'eg. Red Dust Base',
    defaultValue: current.nickname || '',
    maxLength: 40
  });
  if (nickname === null || nickname === undefined) return;

  var bio = await gameInput({
    title: t('territory_identity_title'),
    label: t('territory_bio'),
    placeholder: 'eg. Our forward base in sector F9',
    defaultValue: current.bio || '',
    maxLength: 200
  });
  if (bio === null || bio === undefined) return;

  try {
    var res = await fetch('/api/territory/' + claimId + '/identity', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
      body: JSON.stringify({ nickname: nickname.trim(), bio: bio.trim() })
    });
    var resp = await res.json();
    if (!resp.success) { showToast(resp.error || 'Update failed', 'error'); return; }
    showToast('✓ ' + t('territory_save_identity'), 'success');
    loadTerritoryIdentity(claimId);
  } catch(e) { showToast('Update failed', 'error'); }
}

// ── Cosmetic Panel ──
var _cosmeticDefs={
  border:{neon_border:{label:'Neon',icon:'💠',color:'#00FFFF'},flame_border:{label:'Flame',icon:'🔥',color:'#FF6600'},ice_border:{label:'Ice',icon:'❄️',color:'#88CCFF'},gold_border:{label:'Gold',icon:'👑',color:'#FFD700'},starship_border:{label:'Starship',icon:'🚀',color:'#FF4400'}},
  glow:{pulse_glow:{label:'Pulse',icon:'💫',color:'#c088e0'},rainbow_glow:{label:'Rainbow',icon:'🌈',color:'#FF88CC'},dark_aura:{label:'Dark',icon:'🌑',color:'#8800CC'}},
  terrain:{volcanic_terrain:{label:'Volcanic',icon:'🌋',color:'#FF5014'},frozen_terrain:{label:'Frozen',icon:'🧊',color:'#64B4FF'},crystal_terrain:{label:'Crystal',icon:'💎',color:'#B464FF'},toxic_terrain:{label:'Toxic',icon:'☣️',color:'#64FF50'}}
};

// Mobile: toggle cosmetic panel inside the mobile territory modal
function toggleMobCosmeticPanel(){
  var panel=document.getElementById('mtCosmeticPanel');
  if(!panel) return;
  if(panel.style.display!=='none'){ panel.style.display='none'; return; }
  panel.style.display='';
  _renderCosmeticSlotsInto('mtCosmeticSlots', selectedPlot);
}
// Shared renderer: fills a slots container with cosmetic rows for a plot.
function _renderCosmeticSlotsInto(slotsId, plot){
  var slots=document.getElementById(slotsId);
  if(!slots) return;
  if(!plot||!plot.id){slots.innerHTML='<div style="font-size:9px;color:var(--tx3)">Select a claim first</div>';return;}
  var cos=plot.cosmetics||{};
  var w=walletState.address;
  slots.innerHTML='<div style="font-size:9px;color:var(--tx3)">Loading…</div>';
  _territoryReadJson('cosmetic-inventory', '/api/shop/inventory', 10000).then(function(inv){
    if (!inv) inv = [];
    var html='';
    ['border','glow','terrain'].forEach(function(type){
      var typeLabel=type.toUpperCase();
      var equipped=cos[type]||null;
      var def=equipped?_cosmeticDefs[type][equipped]:null;
      html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:rgba(0,0,0,.15);border-radius:6px">';
      html+='<div style="display:flex;align-items:center;gap:6px">';
      html+='<span style="font-size:8px;color:var(--tx3);min-width:48px">'+typeLabel+'</span>';
      if(def){
        html+='<span style="font-size:10px">'+def.icon+'</span><span style="font-size:9px;color:'+def.color+';font-family:var(--fn)">'+def.label+'</span>';
      }else{
        html+='<span style="font-size:9px;color:var(--tx3)">None</span>';
      }
      html+='</div><div style="display:flex;gap:4px">';
      var owned=inv.filter(function(i){return i.quantity>0&&_cosmeticDefs[type]&&_cosmeticDefs[type][i.code]});
      if(owned.length>0){
        html+='<select onchange="equipCosmetic('+plot.id+',this.value)" style="font-size:8px;background:var(--surface1);border:1px solid var(--bdr);color:var(--tx);border-radius:4px;padding:2px 4px;font-family:var(--fn)">';
        html+='<option value="">Equip...</option>';
        owned.forEach(function(o){
          var d=_cosmeticDefs[type][o.code];
          html+='<option value="'+o.code+'"'+(equipped===o.code?' selected':'')+'>'+d.icon+' '+d.label+' (×'+o.quantity+')</option>';
        });
        html+='</select>';
      }
      if(equipped){
        html+='<button onclick="unequipCosmetic('+plot.id+',\''+type+'\')" style="font-size:7px;background:none;border:1px solid rgba(232,72,85,.3);color:var(--red);border-radius:4px;padding:2px 6px;cursor:pointer;font-family:var(--fn)">✕</button>';
      }
      html+='</div></div>';
    });
    if(!inv.some(function(i){return i.quantity>0&&(i.category==='cosmetic')})){
      html+='<div style="font-size:8px;color:var(--tx3);text-align:center;padding:4px 0;margin-top:4px">No cosmetics owned. <span style="color:#c088e0;cursor:pointer;text-decoration:underline" onclick="closeMobTerritoryModal();openItemShop();shopFilterCat(\'cosmetic\',document.querySelectorAll(\'.shop-cat-btn\')[5])">Visit Shop</span></div>';
    }
    slots.innerHTML=html;
  }).catch(function(){slots.innerHTML='<div style="font-size:9px;color:var(--red)">'+tl('Failed to load','불러오기 실패','読み込み失敗','加载失败')+'</div>'});
}

function openCosmeticPanel(plot){
  var panel=document.getElementById('cosmeticPanel');
  if(!panel) return;
  if(panel.style.display!=='none'){panel.style.display='none';return;}
  panel.style.display='';
  _renderCosmeticSlotsInto('cosmeticSlots', plot);
}

function equipCosmetic(claimId,itemCode){
  if(!itemCode)return;
  var w=walletState.address;
  fetch('/api/cosmetic/equip',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,claimId:claimId,itemCode:itemCode})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');return;}
    showToast('Cosmetic equipped!');
    // Update local claim data
    var cl=claims.find(function(c){return c.id===claimId});
    if(cl){
      if(!cl.cosmetics) cl.cosmetics={};
      cl.cosmetics[d.cosmeticType]=d.cosmeticCode;
    }
    if(selectedPlot&&selectedPlot.id===claimId){
      if(!selectedPlot.cosmetics) selectedPlot.cosmetics={};
      selectedPlot.cosmetics[d.cosmeticType]=d.cosmeticCode;
    }
    claimsSnapshot=null;compositeClaimsOnTexture();
    _refreshCosmeticPanels();
  }).catch(function(){showToast('Failed to equip','error')});
}

// Refresh whichever cosmetic panel is currently visible (desktop or mobile).
function _refreshCosmeticPanels(){
  var desk=document.getElementById('cosmeticPanel');
  var mob=document.getElementById('mtCosmeticPanel');
  if(desk&&desk.style.display!=='none'){ _renderCosmeticSlotsInto('cosmeticSlots', selectedPlot); }
  if(mob&&mob.style.display!=='none'){ _renderCosmeticSlotsInto('mtCosmeticSlots', selectedPlot); }
}

function unequipCosmetic(claimId,cosmeticType){
  var w=walletState.address;
  fetch('/api/cosmetic/unequip',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),body:JSON.stringify({wallet:w,claimId:claimId,cosmeticType:cosmeticType})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showToast(srvErr(d.error),'error');return;}
    showToast('Cosmetic removed');
    var cl=claims.find(function(c){return c.id===claimId});
    if(cl&&cl.cosmetics) delete cl.cosmetics[cosmeticType];
    if(selectedPlot&&selectedPlot.id===claimId&&selectedPlot.cosmetics) delete selectedPlot.cosmetics[cosmeticType];
    claimsSnapshot=null;compositeClaimsOnTexture();
    _refreshCosmeticPanels();
  }).catch(function(){showToast('Failed to remove','error')});
}

// Save promo link for owned territory
function savePromoLink(){
  if(!selectedPlot||!selectedPlot.claimId) return showToast('No claim selected','error');
  // Check both desktop and mobile inputs
  var desktopInput=document.getElementById('infoLinkInput');
  var mobileInput=document.getElementById('mtLinkInput');
  var link=(desktopInput&&desktopInput.offsetParent?desktopInput:mobileInput||desktopInput).value.trim();
  var normalizedLink=_normalizeExternalLink(link);
  if(link&&!normalizedLink){return showToast('Invalid link. Use a valid domain or https:// URL','error');}
  var w=walletState.address;
  if(!w) return showToast('Not logged in','error');
  fetch('/api/claim/'+selectedPlot.claimId+'/image',{
    method:'PUT',
    headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
    body:JSON.stringify({wallet:w, linkUrl:normalizedLink||''})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error) return showToast(srvErr(d.error),'error');
    selectedPlot.link=normalizedLink||'';
    showToast('Link saved!');
    // Update link display
    if(normalizedLink){
      document.getElementById('linkRow').style.display='';
      var mtRow=document.getElementById('mtLinkRow');
      if(mtRow) mtRow.style.display='';
      _applyExternalLinkDisplay('infoLink', normalizedLink);
      _applyExternalLinkDisplay('mtLink', normalizedLink);
    }else{
      document.getElementById('linkRow').style.display='none';
      var mtHide=document.getElementById('mtLinkRow');
      if(mtHide) mtHide.style.display='none';
    }
  }).catch(function(){showToast('Save failed','error')});
}

// Expand image in full-screen overlay
function expandInfoImg(){
  var src=document.getElementById('infoImgPreview')._fullUrl;
  if(!src) return;
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:pointer';
  ov.onclick=function(){document.body.removeChild(ov)};
  var img=document.createElement('img');
  img.src=src;
  img.style.cssText='max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 0 40px rgba(0,0,0,.6)';
  ov.appendChild(img);
  document.body.appendChild(ov);
}

/* ── Image Editor ──────────────────────────────────── */
var _editor={claim:null,img:null,scale:100,rotate:0,ox:0,oy:0,dragging:false,lastX:0,lastY:0,
  maskW:0,maskH:0,canvasW:480,canvasH:360};

function openImageEditor(plot){
  if(!plot||!plot.id){showToast('Select a territory first','red');return}
  if(!walletState.connected||plot.owner!==walletState.address){showToast('Not your territory','red');return}
  _editor.claim=plot;
  _editor.img=null;_editor.newFileDataUrl=null;
  // Load saved params if image exists, otherwise defaults
  if(plot.imgUrl){
    _editor.scale=plot.imgScale||100;
    _editor.rotate=-(plot.imgRotate||0); // territory rotation = negated image rotation
    _editor.ox=plot.imgOffsetX||0;
    _editor.oy=plot.imgOffsetY||0;
  }else{
    _editor.scale=100;_editor.rotate=0;_editor.ox=0;_editor.oy=0;
  }
  // Territory dimensions — find the EXACT group this claim belongs to
  var tw,th;
  _editor.gs=_actualGridStep||GRID_SIZE;
  var _egs=_editor.gs;
  var owner=plot.owner;
  var groups=_ownerGroups[owner]||[];
  // Find the group that contains THIS specific claim
  var myGroup=null;
  for(var gi=0;gi<groups.length;gi++){
    var gCls=groups[gi].claimIndices;
    for(var gj=0;gj<gCls.length;gj++){
      if(claims[gCls[gj]]===plot||claims[gCls[gj]]&&claims[gCls[gj]].id===plot.id){
        myGroup=groups[gi];break;
      }
    }
    if(myGroup) break;
  }
  var isMergedGroup=myGroup&&myGroup.claimIndices.length>1;
  if(isMergedGroup){
    var b=myGroup.bounds;
    // Expand bounds to include full claim rects (claims may extend beyond strip bounds)
    // Keep original bounds ref for group identity lookup, use expanded for sizing
    var eb={minLat:b.minLat,maxLat:b.maxLat,minLng:b.minLng,maxLng:b.maxLng};
    var cls0=myGroup.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
    cls0.forEach(function(gc){
      var cw0=gc.w||20,ch0=gc.h||20;
      var clMinLng=gc.lng-cw0/2*_egs, clMaxLng=gc.lng+cw0/2*_egs;
      var clMinLat=gc.lat-ch0/2*_egs, clMaxLat=gc.lat+ch0/2*_egs;
      if(clMinLng<eb.minLng) eb.minLng=clMinLng;
      if(clMaxLng>eb.maxLng) eb.maxLng=clMaxLng;
      if(clMinLat<eb.minLat) eb.minLat=clMinLat;
      if(clMaxLat>eb.maxLat) eb.maxLat=clMaxLat;
    });
    b=eb; // use expanded bounds for editor (separate from _ownerGroups)
    _editor.groupIndex=groups.indexOf(myGroup); // store index for lookup instead of === ref
    tw=Math.round((b.maxLng-b.minLng)/_egs);
    th=Math.round((b.maxLat-b.minLat)/_egs);
    _editor.isMerged=true;
    // Filter strips for this group's bounding box
    var allStrips=_globalOwnerStrips[plot.owner]||[];
    var gs=_egs;
    _editor.mergedStrips=allStrips.filter(function(s){
      return s.lat>=b.minLat-gs*0.5&&s.lat<=b.maxLat+gs*0.5&&
             s.lng1>=b.minLng-gs*0.5&&s.lng2<=b.maxLng+gs*0.5;
    });
    _editor.bounds=b;
    // Find anchor claim (first with imgUrl) for consistent positioning with map
    var anchorClaim=null;
    var cls=myGroup.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
    for(var ci2=0;ci2<cls.length;ci2++){
      if(cls[ci2].imgUrl){anchorClaim=cls[ci2];break;}
    }
    if(anchorClaim){
      // lng/lat are already CENTER coordinates — don't add w/2
      _editor.anchorX=(anchorClaim.lng-b.minLng)/_egs;
      _editor.anchorY=(b.maxLat-anchorClaim.lat)/_egs;
      _editor.anchorClaimW=anchorClaim.w||20;
      _editor.anchorClaimH=anchorClaim.h||20;
    }else{
      _editor.anchorX=tw/2;_editor.anchorY=th/2;
      _editor.anchorClaimW=tw;_editor.anchorClaimH=th;
    }
  }else{
    tw=plot.w||plot.size||20; th=plot.h||plot.size||20;
    _editor.isMerged=false;
    _editor.mergedStrips=null;
    _editor.bounds=null;
    _editor.anchorX=tw/2;_editor.anchorY=th/2;
    _editor.anchorClaimW=tw;_editor.anchorClaimH=th;
  }
  _editor.maskW=tw;_editor.maskH=th;
  var pxCount=plot._pixelCount||(tw*th);
  document.getElementById('editorTerritorySize').textContent=tw+'×'+th+' px ('+pxCount.toLocaleString()+')';
  document.getElementById('editorClaimId').textContent='#'+plot.id;
  document.getElementById('editorScaleLabel').textContent=Math.round(10000/_editor.scale)+'%';
  document.getElementById('editorRotLabel').textContent=_editor.rotate+'°';
  // Show modal
  document.getElementById('imgEditorModal').classList.add('open');
  // If claim already has image, load it
  if(plot.imgUrl){
    document.getElementById('editorUploadArea').style.display='none';
    document.getElementById('editorCanvasWrap').style.display='';
    var img=new Image();img.crossOrigin='anonymous';
    img.onload=function(){_editor.img=img;_editorDraw()};
    img.src=plot.originalImgUrl||plot.imgUrl;
  }else{
    document.getElementById('editorUploadArea').style.display='';
    document.getElementById('editorCanvasWrap').style.display='none';
  }
  document.getElementById('editorStatus').style.display='none';
  // Setup canvas size
  _editorResizeCanvas();
}
function closeImageEditor(){
  document.getElementById('imgEditorModal').classList.remove('open');
  _editor.claim=null;_editor.img=null;
}

function _editorResizeCanvas(){
  var canvas=document.getElementById('editorCanvas');
  var viewport=document.getElementById('editorViewport');
  // Fit canvas to modal width while maintaining aspect ratio of territory
  var maxW=viewport.parentElement.clientWidth||480;
  var isMobile=window.innerWidth<=768;
  if(isMobile) maxW=Math.min(maxW, window.innerWidth-24);
  var aspect=_editor.maskH/_editor.maskW;
  // Canvas display: scale territory to fill nicely (with padding for drag room)
  var cw=Math.min(maxW, isMobile?maxW:480);
  var ch=Math.round(cw*Math.min(aspect,1.2));
  var maxH=isMobile?Math.min(window.innerHeight*0.28, 200):320;
  ch=Math.min(Math.max(ch, isMobile?150:200), maxH);
  canvas.width=cw*2;canvas.height=ch*2; // 2x for retina
  canvas.style.width=cw+'px';canvas.style.height=ch+'px';
  _editor.canvasW=cw*2;_editor.canvasH=ch*2;
}

function _editorDraw(){
  var c=document.getElementById('editorCanvas');
  var ctx=c.getContext('2d');
  var W=_editor.canvasW,H=_editor.canvasH;
  ctx.clearRect(0,0,W,H);

  // Dark background
  ctx.fillStyle='rgb(10,10,18)';
  ctx.fillRect(0,0,W,H);

  if(!_editor.img){
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='bold 14px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('Upload an image',W/2,H/2);
    return;
  }

  var img=_editor.img;
  var s=_editor.scale/100;

  // Image fully visible (contain fit — entire image shown, no cropping)
  var imgCS=Math.min(W/img.width, H/img.height);
  var imgW=img.width*imgCS, imgH=img.height*imgCS;
  var imgX=(W-imgW)/2, imgY=(H-imgH)/2;

  // Draw full image dimmed (no rotation — image stays fixed)
  ctx.save();
  ctx.globalAlpha=0.3;
  ctx.drawImage(img,imgX,imgY,imgW,imgH);
  ctx.restore();

  // Territory window: position and size on the image
  var gridPx=imgCS/s;
  var anchorCX=W/2-_editor.ox*imgCS;
  var anchorCY=H/2-_editor.oy*imgCS;
  var terrX=anchorCX-_editor.anchorX*gridPx;
  var terrY=anchorCY-_editor.anchorY*gridPx;
  var terrW=_editor.maskW*gridPx;
  var terrH=_editor.maskH*gridPx;
  // Territory center for rotation pivot
  var terrCX=terrX+terrW/2, terrCY=terrY+terrH/2;
  var rotRad=_editor.rotate*Math.PI/180;

  // Rotation helper: rotate point around territory center
  var cosR=Math.cos(rotRad), sinR=Math.sin(rotRad);
  function rotPt(x,y){
    var dx=x-terrCX, dy=y-terrCY;
    return [terrCX+dx*cosR-dy*sinR, terrCY+dx*sinR+dy*cosR];
  }

  // Build rotated clip path manually (no transform needed)
  function _buildRotatedClip(){
    ctx.beginPath();
    if(_editor.isMerged&&_editor.bounds&&_editor.claim){
      var b=_editor.bounds;
      var owner=_editor.claim.owner;
      var groups=_ownerGroups[owner]||[];
      var grp=null;
      var grpIdx=_editor.groupIndex!=null?_editor.groupIndex:-1;
      var grp=grpIdx>=0&&grpIdx<groups.length?groups[grpIdx]:groups[0];
      if(grp){
        var cls=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
        var gs2=_editor.gs;
        cls.forEach(function(gc){
          var cw2=gc.w||20,ch2=gc.h||20;
          var rx=terrX+((gc.lng-b.minLng)/gs2-cw2/2)*gridPx;
          var ry=terrY+((b.maxLat-gc.lat)/gs2-ch2/2)*gridPx;
          var rw=cw2*gridPx, rh=ch2*gridPx;
          var p1=rotPt(rx,ry),p2=rotPt(rx+rw,ry),p3=rotPt(rx+rw,ry+rh),p4=rotPt(rx,ry+rh);
          ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p3[0],p3[1]);ctx.lineTo(p4[0],p4[1]);ctx.closePath();
        });
      }
    }else{
      var p1=rotPt(terrX,terrY),p2=rotPt(terrX+terrW,terrY);
      var p3=rotPt(terrX+terrW,terrY+terrH),p4=rotPt(terrX,terrY+terrH);
      ctx.moveTo(p1[0],p1[1]);ctx.lineTo(p2[0],p2[1]);ctx.lineTo(p3[0],p3[1]);ctx.lineTo(p4[0],p4[1]);ctx.closePath();
    }
  }

  // Bright image clipped to rotated territory
  ctx.save();
  _buildRotatedClip();
  ctx.clip();
  ctx.drawImage(img,imgX,imgY,imgW,imgH);
  ctx.restore();

  // Territory border — outer contour only (no internal edges between merged claims)
  ctx.strokeStyle='rgba(255,160,60,0.7)';ctx.lineWidth=2;ctx.setLineDash([]);
  if(_editor.isMerged&&_editor.bounds&&_editor.claim){
    // Build cell grid to detect outer edges
    var b2=_editor.bounds;
    var gs3=_editor.gs;
    var gW=Math.round(_editor.maskW),gH=Math.round(_editor.maskH);
    var grd=[];for(var gi2=0;gi2<gH;gi2++) grd[gi2]=new Uint8Array(gW);
    var owner2=_editor.claim.owner;
    var groups2=_ownerGroups[owner2]||[];
    var grp2=null;
    var grpIdx2=_editor.groupIndex!=null?_editor.groupIndex:-1;
    var grp2=grpIdx2>=0&&grpIdx2<groups2.length?groups2[grpIdx2]:groups2[0];
    if(grp2){
      grp2.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean).forEach(function(gc){
        var cw3=gc.w||20,ch3=gc.h||20;
        var gx0=Math.round((gc.lng-b2.minLng)/gs3-cw3/2);
        var gy0=Math.round((b2.maxLat-gc.lat)/gs3-ch3/2);
        for(var dy2=0;dy2<ch3;dy2++) for(var dx2=0;dx2<cw3;dx2++){
          var yy=gy0+dy2,xx=gx0+dx2;
          if(yy>=0&&yy<gH&&xx>=0&&xx<gW) grd[yy][xx]=1;
        }
      });
    }
    // Draw outer edges only
    ctx.beginPath();
    for(var gy2=0;gy2<gH;gy2++) for(var gx2=0;gx2<gW;gx2++){
      if(!grd[gy2][gx2]) continue;
      var px2=terrX+gx2*gridPx,py2=terrY+gy2*gridPx;
      if(gy2===0||!grd[gy2-1][gx2]){var e1=rotPt(px2,py2),e2=rotPt(px2+gridPx,py2);ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);}
      if(gy2===gH-1||!grd[gy2+1][gx2]){var e1=rotPt(px2,py2+gridPx),e2=rotPt(px2+gridPx,py2+gridPx);ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);}
      if(gx2===0||!grd[gy2][gx2-1]){var e1=rotPt(px2,py2),e2=rotPt(px2,py2+gridPx);ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);}
      if(gx2===gW-1||!grd[gy2][gx2+1]){var e1=rotPt(px2+gridPx,py2),e2=rotPt(px2+gridPx,py2+gridPx);ctx.moveTo(e1[0],e1[1]);ctx.lineTo(e2[0],e2[1]);}
    }
    ctx.stroke();
  }else{
    ctx.beginPath();
    var bp1=rotPt(terrX,terrY),bp2=rotPt(terrX+terrW,terrY);
    var bp3=rotPt(terrX+terrW,terrY+terrH),bp4=rotPt(terrX,terrY+terrH);
    ctx.moveTo(bp1[0],bp1[1]);ctx.lineTo(bp2[0],bp2[1]);ctx.lineTo(bp3[0],bp3[1]);ctx.lineTo(bp4[0],bp4[1]);ctx.closePath();
    ctx.stroke();
  }

  // Corner markers (rotated)
  var cm=10;
  ctx.strokeStyle='rgba(255,160,60,0.9)';ctx.lineWidth=2.5;ctx.setLineDash([]);
  var corners=[[terrX,terrY,1,1],[terrX+terrW,terrY,-1,1],[terrX,terrY+terrH,1,-1],[terrX+terrW,terrY+terrH,-1,-1]];
  corners.forEach(function(c){
    var pc=rotPt(c[0],c[1]);
    var pa=rotPt(c[0]+c[2]*cm,c[1]);
    var pb=rotPt(c[0],c[1]+c[3]*cm);
    ctx.beginPath();ctx.moveTo(pb[0],pb[1]);ctx.lineTo(pc[0],pc[1]);ctx.lineTo(pa[0],pa[1]);ctx.stroke();
  });
}

// Build territory clip path at given position/scale
function _editorBuildClip(ctx,terrX,terrY,gridPx){
  ctx.beginPath();
  if(_editor.isMerged&&_editor.bounds&&_editor.claim){
    var b=_editor.bounds;
    var owner=_editor.claim.owner;
    var groups=_ownerGroups[owner]||[];
    var grp=null;
    var grpIdx3=_editor.groupIndex!=null?_editor.groupIndex:-1;
    var grp=grpIdx3>=0&&grpIdx3<groups.length?groups[grpIdx3]:groups[0];
    if(grp){
      var cls=grp.claimIndices.map(function(ci){return claims[ci]}).filter(Boolean);
      var gs=_editor.gs;
      cls.forEach(function(gc){
        var cw=gc.w||20,ch=gc.h||20;
        var colLeft=(gc.lng-b.minLng)/gs-cw/2;
        var rowTop=(b.maxLat-gc.lat)/gs-ch/2;
        ctx.rect(terrX+colLeft*gridPx,terrY+rowTop*gridPx,cw*gridPx,ch*gridPx);
      });
    }
  }else{
    ctx.rect(terrX,terrY,_editor.maskW*gridPx,_editor.maskH*gridPx);
  }
}

// Editor controls
function editorZoom(delta){
  // + makes territory bigger (lower internal scale)
  // Multiplicative step: smooth at all zoom levels
  var factor=delta>0?0.92:1/0.92;
  _editor.scale=Math.max(5,Math.min(500,_editor.scale*factor));
  // Display inverted: show bigger number when territory is bigger
  var displayPct=Math.round(10000/_editor.scale);
  document.getElementById('editorScaleLabel').textContent=displayPct+'%';
  _editorDraw();
}
function editorRotate(delta){
  _editor.rotate=((_editor.rotate+delta)%360+360)%360;
  if(_editor.rotate>180) _editor.rotate-=360;
  document.getElementById('editorRotLabel').textContent=_editor.rotate+'°';
  _editorDraw();
}
function editorReset(){
  _editor.scale=100;_editor.rotate=0;_editor.ox=0;_editor.oy=0;
  document.getElementById('editorScaleLabel').textContent=Math.round(10000/_editor.scale)+'%';
  document.getElementById('editorRotLabel').textContent='0°';
  _editorDraw();
}

// Drag to move image
(function(){
  var canvas;
  function getCanvas(){
    if(!canvas) canvas=document.getElementById('editorCanvas');
    return canvas;
  }
  var _pinchDist=0;
  function onDown(e){
    if(!_editor.img) return;
    e.preventDefault();
    if(e.touches&&e.touches.length===2){
      // Pinch start
      var dx=e.touches[0].clientX-e.touches[1].clientX;
      var dy=e.touches[0].clientY-e.touches[1].clientY;
      _pinchDist=Math.sqrt(dx*dx+dy*dy);
      _editor.dragging=false;
      return;
    }
    _editor.dragging=true;
    var p=e.touches?e.touches[0]:e;
    _editor.lastX=p.clientX;_editor.lastY=p.clientY;
    getCanvas().style.cursor='grabbing';
  }
  function onMove(e){
    if(!_editor.img) return;
    // Pinch to zoom
    if(e.touches&&e.touches.length===2){
      e.preventDefault();
      var dx=e.touches[0].clientX-e.touches[1].clientX;
      var dy=e.touches[0].clientY-e.touches[1].clientY;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(_pinchDist>0){
        var delta=(dist-_pinchDist)*0.3;
        if(Math.abs(delta)>1) editorZoom(delta>0?3:-3);
        _pinchDist=dist;
      }
      return;
    }
    if(!_editor.dragging) return;
    e.preventDefault();
    var p=e.touches?e.touches[0]:e;
    // Convert screen pixels to grid units via imgCS (image cover scale)
    var rect=getCanvas().getBoundingClientRect();
    var pixelRatio=_editor.canvasW/(rect.width);
    var imgCS=Math.min(_editor.canvasW/_editor.img.width, _editor.canvasH/_editor.img.height);
    var dx=(p.clientX-_editor.lastX)*pixelRatio/imgCS;
    var dy=(p.clientY-_editor.lastY)*pixelRatio/imgCS;
    // Inverted: dragging moves territory window (opposite of image offset)
    _editor.ox-=dx;_editor.oy-=dy;
    _editor.lastX=p.clientX;_editor.lastY=p.clientY;
    _editorDraw();
  }
  function onUp(){
    _editor.dragging=false;
    _pinchDist=0;
    if(getCanvas()) getCanvas().style.cursor='grab';
  }
  function onWheel(e){
    if(!_editor.img) return;
    var modal=document.getElementById('imgEditorModal');
    if(!modal.classList.contains('open')) return;
    e.preventDefault();
    var delta=e.deltaY>0?-5:5;
    editorZoom(delta);
  }
  // Attach once after DOM ready
  var _edBound=false;
  function _edBind(){
    if(_edBound) return;
    var c=getCanvas();
    if(!c) return;
    _edBound=true;
    c.addEventListener('mousedown',onDown);
    c.addEventListener('touchstart',onDown,{passive:false});
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:false});
    window.addEventListener('mouseup',onUp);
    window.addEventListener('touchend',onUp);
    c.addEventListener('wheel',onWheel,{passive:false});
  }
  document.addEventListener('DOMContentLoaded',_edBind);
  setTimeout(_edBind,200);
})();

// File upload for editor
document.addEventListener('DOMContentLoaded',function(){
  try{loadDisplaySettings();}catch(_e){}
  var fi=document.getElementById('editorFileInput');
  if(fi) fi.addEventListener('change',function(e){
    var file=e.target.files[0];
    if(!file) return;
    if(file.size>5*1024*1024){showToast('Image too large (max 5MB)','red');return}
    var reader=new FileReader();
    reader.onload=function(ev){
      var img=new Image();
      img.onload=function(){
        _editor.img=img;
        _editor.newFileDataUrl=ev.target.result; // track original for upload
        _editor.ox=0;_editor.oy=0;_editor.rotate=0;
        // Auto-set scale so territory window fills ~50% of canvas
        var imgCS=Math.min(_editor.canvasW/img.width, _editor.canvasH/img.height);
        var autoS=Math.max(_editor.maskW*imgCS/(_editor.canvasW*0.5), _editor.maskH*imgCS/(_editor.canvasH*0.5))*100;
        _editor.scale=Math.max(5,Math.min(500,Math.round(autoS)));
        document.getElementById('editorScaleLabel').textContent=Math.round(10000/_editor.scale)+'%';
        document.getElementById('editorRotLabel').textContent='0°';
        document.getElementById('editorUploadArea').style.display='none';
        document.getElementById('editorCanvasWrap').style.display='';
        _editorResizeCanvas();
        _editorDraw();
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
    fi.value='';
  });
});

// Save: upload ORIGINAL image (not cropped), store params for runtime rendering
async function saveEditorImage(){
  if(!_editor.img||!_editor.claim){showToast('No image to save','red');return}
  var status=document.getElementById('editorStatus');
  status.style.display='';status.style.background='rgba(255,160,60,.12)';status.style.color='var(--gold)';
  status.textContent='Saving...';

  try{
    var originalUrl=_editor.claim.originalImgUrl||_editor.claim.imgUrl||null;

    // Only upload if user picked a new file
    if(_editor.newFileDataUrl){
      var upRes=await fetch('/api/upload',{
        method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:JSON.stringify({dataUrl:_editor.newFileDataUrl})
      });
      var upData=await upRes.json();
      if(!upRes.ok) throw new Error(upData.error||'Upload failed');
      originalUrl=upData.url;
    }

    if(!originalUrl) throw new Error('No image URL');

    // Update ALL claims with ORIGINAL image URL + editor params (no cropping)
    var allClaims=(_editor.claim.claims||[_editor.claim]);
    var imgBody=JSON.stringify({
      wallet:walletState.address,
      imageUrl:originalUrl,
      originalImageUrl:originalUrl,
      imgScale:_editor.scale,
      imgRotate:-_editor.rotate,
      imgOffsetX:Math.round(_editor.ox),
      imgOffsetY:Math.round(_editor.oy)
    });
    var putPromises=allClaims.map(function(ac){
      return fetch('/api/claim/'+ac.id+'/image',{
        method:'PUT',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
        body:imgBody
      }).then(function(r){return r.json()});
    });
    var putResults=await Promise.all(putPromises);
    var anyFail=putResults.find(function(r){return r.error});
    if(anyFail) throw new Error(anyFail.error||'Save failed');

    status.style.background='rgba(76,216,154,.12)';status.style.color='var(--grn)';
    status.textContent='Image saved successfully!';

    // Update local claim data — keep original URL intact
    allClaims.forEach(function(ac){
      ac.imgUrl=originalUrl;ac.originalImgUrl=originalUrl;
      ac.imgScale=_editor.scale;ac.imgRotate=-_editor.rotate;
      ac.imgOffsetX=Math.round(_editor.ox);ac.imgOffsetY=Math.round(_editor.oy);
    });
    _editor.newFileDataUrl=null;
    // Reload texture
    cacheImage(originalUrl,function(){
      claimsSnapshot=null;compositeClaimsOnTexture();
    });
    showTerritoryInfo(_editor.claim);
    setTimeout(function(){closeImageEditor()},1200);
  }catch(err){
    status.style.background='rgba(232,72,85,.12)';status.style.color='var(--red)';
    status.textContent='Error: '+err.message;
  }
}

/* ── Mobile Territory Info ───────────────────────── */
function showMobInfoBtn(plot, evt){
  var btn=document.getElementById('mobInfoBtn');
  // Position directly above the tap point (tap lands on the image)
  var x=evt?evt.clientX:window.innerWidth/2;
  var y=evt?evt.clientY:window.innerHeight/2;
  // Clamp to viewport
  x=Math.max(40,Math.min(window.innerWidth-40,x));
  y=Math.max(40,Math.min(window.innerHeight-80,y));
  btn.style.left=x+'px';
  btn.style.top=y+'px';
  btn.style.display='block';
  btn._plot=plot;
}
function hideMobInfoBtn(){
  document.getElementById('mobInfoBtn').style.display='none';
}
function openMobTerritoryModal(){
  var btn=document.getElementById('mobInfoBtn');
  var plot=btn._plot||selectedPlot;
  if(!plot||!plot.owner) return;
  hideMobInfoBtn();
  // Fill modal data
  document.getElementById('mtCoords').textContent=plot.lat.toFixed(1)+'°, '+plot.lng.toFixed(1)+'°';
  document.getElementById('mtOwner').textContent=plot.nickname||plot.label||plot.owner;
  var _mtShowGEm=(typeof getDisplaySetting==='function')?getDisplaySetting('guildEmblem'):true;
  var _mtShowGTag=(typeof getDisplaySetting==='function')?getDisplaySetting('guildTag'):true;
  if(plot.guildTag && (_mtShowGEm || _mtShowGTag)){
    document.getElementById('mtGuildRow').style.display='';
    var _mtCell=document.getElementById('mtGuild');
    var _mtEmblem='';
    if(_mtShowGEm){
      _mtEmblem=plot.guildEmblemImage
        ? '<img src="'+plot.guildEmblemImage+'" style="width:14px;height:14px;image-rendering:pixelated;image-rendering:crisp-edges;vertical-align:middle;margin-right:4px;border-radius:2px">'
        : '<span style="margin-right:4px">'+(plot.guildEmblem||'')+'</span>';
    }
    var _mtTagHtml=_mtShowGTag
      ? ('<span style="color:var(--mars)">['+plot.guildTag+']</span>'+(plot.guildName?' <span style="color:var(--tx3);font-size:9px">'+(plot.guildName).replace(/[<>]/g,'')+'</span>':''))
      : '';
    _mtCell.innerHTML=_mtEmblem+_mtTagHtml;
  }else{ document.getElementById('mtGuildRow').style.display='none'; }
  var pw=plot.w||plot.size||10, ph=plot.h||plot.size||10;
  document.getElementById('mtSize').textContent=pw+'×'+ph+' px ('+pw*ph+' pixels)';
  document.getElementById('mtPrice').textContent=parseFloat(plot.price||0).toFixed(2)+' PP';
  // Link
  if(plot.link){
    document.getElementById('mtLinkRow').style.display='';
    _applyExternalLinkDisplay('mtLink', plot.link);
  }else{
    document.getElementById('mtLinkRow').style.display='none';
  }
  // Image
  var imgWrap=document.getElementById('mtImgWrap');
  var imgPreview=document.getElementById('mtImgPreview');
  var showUrl=plot.originalImgUrl||plot.imgUrl;
  if(showUrl){
    imgPreview.src=showUrl;
    imgWrap.style.display='';
    imgPreview._fullUrl=showUrl;
  }else{
    imgWrap.style.display='none';
  }
  selectedPlot=plot;
  // 내 영토 vs 남의 영토 액션 구분
  var isMine=walletState&&walletState.address&&(plot.owner||'').toLowerCase()===(walletState.address||'').toLowerCase();
  var ownActions=document.getElementById('mtOwnActions');
  var otherActions=document.getElementById('mtOtherActions');
  var imgLabel=document.getElementById('mtEditImgLabel');
  var hijackBtn=document.getElementById('mtHijackBtn');
  if(isMine){
    if(ownActions) ownActions.style.display='';
    if(otherActions) otherActions.style.display='none';
    if(imgLabel) imgLabel.textContent=plot.imgUrl?'EDIT IMAGE':'ADD IMAGE';
    var li=document.getElementById('mtLinkInput'); if(li) li.value=plot.link||'';
    // 판매중 표시
    var sellBtn=document.getElementById('mtSellBtn');
    if(sellBtn){
      var fs=_forSaleMap&&_forSaleMap[plot.claimId||plot.id];
      sellBtn.textContent=fs?(LANG==='ko'?'💰 판매중':LANG==='ja'?'💰 販売中':LANG==='zh'?'💰 出售中':'💰 Listed'):(LANG==='ko'?'💰 판매':LANG==='ja'?'💰 販売':LANG==='zh'?'💰 出售':'💰 Sell');
      sellBtn.style.color=fs?'#4cd89a':'#a064dc';
      sellBtn.style.borderColor=fs?'rgba(76,216,154,.4)':'rgba(160,100,220,.35)';
    }
  }else{
    if(ownActions) ownActions.style.display='none';
    if(otherActions) otherActions.style.display='';
    // 하이젝 버튼: 방어 함대 있는 경우만
    var canHijack=plot.owner&&plot.owner!=='__dead__'&&walletState.address;
    if(hijackBtn) hijackBtn.style.display=canHijack?'':'none';
  }
  var _mtm = document.getElementById('mobTerritoryModal');
  _mtm.classList.add('open');
  // [v7.215] iOS phantom-click 가드 — 모달 열린 직후 350ms 안 backdrop click 무시.
  _mtm.dataset.openedAt = String(Date.now());
  // [v7.207] HP/생산/섹터/광물 정보 로드 — territory production endpoint 호출.
  //   본인 영토는 d.owned=true 라 condition 표시 + TEND 가능. 남의 영토는 condition 만.
  try { _loadMobTerritoryProdInfo(plot.claimId || plot.id, plot); } catch(_){}
}
// [v7.207] mobTerritoryModal 의 #mtProdInfo 영역에 HP/생산/섹터/광물 채우기.
function _loadMobTerritoryProdInfo(claimId, plot){
  var box = document.getElementById('mtProdInfo');
  if (!box || !claimId) return;
  box.style.display = '';
  box.innerHTML = '<div style="color:var(--tx3);font-size:9px">'+(LANG==='ko'?'로딩 중…':LANG==='ja'?'読込中…':LANG==='zh'?'加载中…':'Loading…')+'</div>';
  var wallet = ((walletState&&walletState.address)||getMyWallet()||'').toLowerCase();
  _territoryReadJson('mob-production:'+claimId, '/api/territory/'+claimId+'/production', 8000)
    .then(function(d){
      if (!d || d.error) { box.style.display='none'; return; }
      var lang = LANG;
      var html = '';
      // HP / 등급
      if (typeof d.condition !== 'undefined') {
        var cond = Math.max(0, Math.min(100, parseFloat(d.condition)||0));
        var grade = d.grade || 'B';
        var gColor = ({S:'#69f0ae',A:'#7cf0ff',B:'#ffd700',C:'#ffab40',D:'#ff8a65',F:'#ff5252'})[grade] || '#ffd700';
        var barColor = cond>=60?'#69f0ae':cond>=30?'#ffab40':'#ff5252';
        try { window._lastTerritoryCondition = cond; window._lastTerritoryGrade = grade; } catch(_){}
        html += '<div style="margin-bottom:6px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
        html += '<span style="color:var(--tx3);font-size:9px">'+(lang==='ko'?'영토 상태 (HP)':lang==='ja'?'領土状態(HP)':lang==='zh'?'领土状态(HP)':'Condition (HP)')+'</span>';
        html += '<span style="display:flex;align-items:center;gap:5px">';
        html += '<span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:8px;color:'+gColor+';border:1px solid '+gColor+'66;background:'+gColor+'1a">'+grade+'</span>';
        html += '<span style="color:'+barColor+';font-weight:700;font-size:10px">'+cond.toFixed(0)+'/100</span>';
        html += '</span></div>';
        html += '<div style="height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+cond+'%;background:'+barColor+'"></div></div>';
        if (d.owned && cond < 100) {
          html += '<button type="button" onclick="event.stopPropagation();closeMobTerritoryModal();tendTerritory('+claimId+',\''+(wallet||'').replace(/\047/g,"\\\047")+'\')" style="margin-top:5px;width:100%;font-size:9px;padding:5px;background:rgba(105,240,174,.1);border:1px solid rgba(105,240,174,.3);border-radius:5px;color:#69f0ae;cursor:pointer;font-family:var(--fn)">'+(lang==='ko'?'🔧 정비하기':lang==='ja'?'🔧 整備する':lang==='zh'?'🔧 维护':'🔧 TEND')+'</button>';
        }
        html += '</div>';
      }
      // 예상 PP 수확
      var ppMin = d.production && d.production.ppMin || 0;
      var ppMax = d.production && d.production.ppMax || 0;
      if (ppMin > 0 || ppMax > 0) {
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--tx3);font-size:9px">'+(lang==='ko'?'예상 PP 수확':lang==='ja'?'予想PP収穫':lang==='zh'?'预估PP收获':'PP Estimate')+'</span><span style="color:#ffab40;font-weight:700;font-size:10px">'+ppMin.toFixed(4)+'~'+ppMax.toFixed(4)+'</span></div>';
      }
      // 섹터
      if (d.sector && d.sector.type) {
        var sLabel = lang==='ko'?{core:'코어',mid:'미드',frontier:'프론티어'}:lang==='ja'?{core:'コア',mid:'ミッド',frontier:'フロンティア'}:lang==='zh'?{core:'核心',mid:'中域',frontier:'边疆'}:{core:'Core',mid:'Mid',frontier:'Frontier'};
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--tx3);font-size:9px">'+(lang==='ko'?'섹터':lang==='ja'?'セクター':lang==='zh'?'扇区':'Sector')+'</span><span style="color:var(--tx2);font-size:10px">'+(sLabel[d.sector.type]||d.sector.type)+'</span></div>';
      }
      // [v7.222 upgrade #4] 총 생산 배수 + modifier 칩 — 모바일에도 곱연산 투명화.
      if (d.production && d.production.modifiers && d.production.modifiers.length) {
        var _tmm = _calcTotalMult(d.production.modifiers);
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="color:var(--tx3);font-size:9px">'+(lang==='ko'?'생산 배수':lang==='ja'?'生産倍率':lang==='zh'?'生产倍率':'Yield Mult')+'</span><span style="font-size:11px;font-weight:800;color:#ffd166;text-shadow:0 0 8px rgba(255,209,102,.4)">×'+_tmm.toFixed(2)+'</span></div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:2px">';
        d.production.modifiers.forEach(function(m){
          var lbl=lang==='ko'?(m.labelKo||m.label):(m.labelEn||m.label);
          html += '<span style="font-size:8px;padding:1px 5px;background:rgba(255,171,64,.1);border:1px solid rgba(255,171,64,.2);border-radius:10px;color:#ffab40">'+lbl+' '+m.value+'</span>';
        });
        html += '</div>';
      }
      // 마지막 수확
      if (d.lastHarvest && d.lastHarvest.at) {
        var ago = (typeof _timeAgo==='function')?_timeAgo(new Date(d.lastHarvest.at)):'';
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0"><span style="color:var(--tx3);font-size:9px">'+(lang==='ko'?'최근 수확':lang==='ja'?'最終採掘':lang==='zh'?'最近采掘':'Last Harvest')+'</span><span style="color:var(--tx2);font-size:10px">'+d.lastHarvest.pp.toFixed(4)+' PP · '+ago+'</span></div>';
      }
      // 광물 칩
      if (d.materials && d.materials.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">';
        d.materials.forEach(function(m){
          var rColor = {'common':'var(--tx2)','rare':'#64b5f6','special':'#ffb74d','legendary':'#ce93d8'}[m.rarity]||'var(--tx2)';
          var name = lang==='ko'?(m.nameKo||m.nameEn):(m.nameEn||m.nameKo);
          html += '<span style="font-size:8px;padding:1px 5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:'+rColor+'">'+m.icon+' '+name+'</span>';
        });
        html += '</div>';
      }
      box.innerHTML = html || '';
      if (!html) box.style.display = 'none';
    })
    .catch(function(){ box.style.display='none'; });
}
function closeMobTerritoryModal(){
  document.getElementById('mobTerritoryModal').classList.remove('open');
}
function openMobTerritoryModalDirect(plot){
  document.getElementById('mobInfoBtn')._plot=plot;
  selectedPlot=plot;
  openMobTerritoryModal();
}
function expandMtImg(){
  var src=document.getElementById('mtImgPreview')._fullUrl;
  if(!src) return;
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:pointer';
  ov.onclick=function(){document.body.removeChild(ov)};
  var img=document.createElement('img');
  img.src=src;
  img.style.cssText='max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 0 40px rgba(0,0,0,.6)';
  ov.appendChild(img);
  document.body.appendChild(ov);
}

/* ── Claim Modal ─────────────────────────────────── */
var selectedChain='base', uploadedUrl=null, selectedSize=20;
var selectedPayMethod='pp'; // 'pp' or 'usdt'
function selectPayMethod(m){
  selectedPayMethod=m;
  document.getElementById('payPP').className='pay-method-btn'+(m==='pp'?' sel':'');
  document.getElementById('payUSDT').className='pay-method-btn'+(m==='usdt'?' sel':'');
  // Update cost display unit
  updateCostDisplayUnit();
}
function updateCostDisplayUnit(){
  if(!lastStampCost) return;
  var unit=selectedPayMethod==='usdt'?'USDT':'PP';
  var ci=lastStampCost;
  if(ci.overlapCount>0){
    document.getElementById('hijackCost').textContent=ci.hijackCost.toFixed(2)+' '+unit+' ('+ci.overlapCount+'px overlap)';
    document.getElementById('modalCostDisplay').textContent=ci.total.toFixed(2)+' '+unit+' (new '+ci.newCount+'px + hijack '+ci.overlapCount+'px)';
  }else{
    var cw=selectedPlot?selectedPlot.w||stampW:stampW, ch=selectedPlot?selectedPlot.h||stampH:stampH;
    document.getElementById('modalCostDisplay').textContent=ci.total.toFixed(2)+' '+unit+' ('+cw+'×'+ch+' = '+ci.totalPixels.toLocaleString()+'px)';
  }
}

var lastStampCost=null; // cached cost breakdown for confirm
function openClaimModal(){
  if(!selectedPlot) return;
  // Fresh sector pricing/access data before computing cost — admin 변경이 즉시 반영
  if (typeof refreshSectors === 'function') { try { refreshSectors(); } catch(_) {} }
  var m=document.getElementById('claimModal');
  m.classList.add('open');
  document.getElementById('modalCoords').textContent=selectedPlot.lat.toFixed(1)+'°, '+selectedPlot.lng.toFixed(1)+'°';
  var hw=document.getElementById('hijackWarn'),tl=document.getElementById('modalTitle');

  var cw=selectedPlot.w||stampW, ch=selectedPlot.h||stampH;
  var costInfo=calcStampCost(selectedPlot.lat,selectedPlot.lng,cw,ch);
  lastStampCost=costInfo;

  var _isHijackMode=costInfo.overlapCount>0;
  if(_isHijackMode){
    hw.style.display='';
    tl.textContent='⚔ HIJACK — FLEET BATTLE';tl.className='claim-title wrn';
    // Build affected owners list (short display)
    var ownerKeys=Object.keys(costInfo.affectedOwners);
    var ownerDisplay=ownerKeys.map(function(o){return shortAddr(o);}).join(', ')||'--';
    document.getElementById('hijackOwner').textContent=ownerDisplay;
    document.getElementById('hijackCost').textContent=costInfo.hijackCost.toFixed(2)+' PP ('+costInfo.overlapCount+'px overlap)';
    document.getElementById('modalCostDisplay').textContent=costInfo.total.toFixed(2)+' PP (new '+costInfo.newCount+'px + hijack '+costInfo.overlapCount+'px)';

    // ── 상대방 함대 미리보기 (auto-win vs fleet battle 사전 안내) ──
    // 가장 많은 픽셀을 가진 owner를 primary defender로 선정 (서버 로직과 동일)
    var _maxPx=0, _primaryDef=null;
    for(var _ow in costInfo.affectedOwners){
      var _ct=(costInfo.affectedOwners[_ow].refund>0)
        ? Object.keys(costInfo.affectedOwners).reduce(function(s,k){return s+(k===_ow?1:0);},0)
        : 0;
      // simpler: count overlap pixels per owner from pixelGrid scan — but we can use refund>0 as proxy
    }
    // 정확한 primary defender = ownerKeys 중 첫번째 (보통 1명)
    _primaryDef = ownerKeys[0] || null;
    var _di = document.getElementById('hijackDefenderInfo');
    var _dt = document.getElementById('hijackDefenderInfoText');
    var _dic = document.getElementById('hijackDefenderInfoIcon');
    if(_di && _primaryDef){
      _di.style.display='block';
      _dt.textContent=LANG==='ko'?'조회 중...':LANG==='ja'?'確認中...':LANG==='zh'?'查询中...':'Checking...';
      _di.style.background='rgba(91,184,232,.08)';
      _di.style.border='1px solid rgba(91,184,232,.25)';
      _di.style.color='#bfe2f5';
      if(_dic) _dic.textContent='⏳';
      fetch('/api/hijack/defender-info?targetWallet='+encodeURIComponent(_primaryDef))
        .then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.json(); })
        .then(function(d){
          if(!d || typeof d !== 'object') throw new Error('bad response');
          var fleets = parseInt(d.availableFleets) || 0;
          var ships  = parseInt(d.aliveShips) || 0;
          var auto   = !!d.willAutoWin || (fleets === 0 || ships === 0);
          if(auto){
            _di.style.background='rgba(255,153,68,.1)';
            _di.style.border='1px solid rgba(255,153,68,.4)';
            _di.style.color='#FFD0A0';
            if(_dic) _dic.textContent='⚠';
            _dt.textContent=t('hijack_no_fleet_auto_win')||'No enemy fleet — auto-win (pixels transfer immediately)';
          }else{
            _di.style.background='rgba(232,72,85,.1)';
            _di.style.border='1px solid rgba(232,72,85,.4)';
            _di.style.color='#ffb4b4';
            if(_dic) _dic.textContent='⚔';
            _dt.textContent=LANG==='ko'?('상대 함대 '+fleets+'개 · 함선 '+ships+'척 → 함대전 발생'):LANG==='ja'?(fleets+'艦隊 · '+ships+'隻 → 艦隊戦発生'):LANG==='zh'?(fleets+'支舰队 · '+ships+'艘 → 舰队战开始'):(fleets+' fleet(s) · '+ships+' ship(s) → Fleet Battle');
          }
        })
        .catch(function(){
          _dt.textContent=t('hijack_fleet_info_fail')||'Failed to check enemy fleet info';
          _di.style.background='rgba(255,255,255,.04)';
          _di.style.border='1px solid rgba(255,255,255,.15)';
          _di.style.color='var(--tx3)';
        });
    } else if(_di){
      _di.style.display='none';
    }
  }else{
    hw.style.display='none';
    tl.textContent='CLAIM TERRITORY';tl.className='claim-title';
    document.getElementById('modalCostDisplay').textContent=costInfo.total.toFixed(2)+' PP ('+cw+'×'+ch+' = '+costInfo.totalPixels.toLocaleString()+'px)';
    // 하이젝 UI 숨기기
    var _fsel=document.getElementById('hijackFleetSelector');
    if(_fsel) _fsel.style.display='none';
    var _fnofl=document.getElementById('hijackNoFleetWarn');
    if(_fnofl) _fnofl.style.display='none';
    var _fload=document.getElementById('hijackFleetLoading');
    if(_fload) _fload.style.display='none';
    var _di=document.getElementById('hijackDefenderInfo');
    if(_di) _di.style.display='none';
  }
  // Show balance
  var bPP=document.getElementById('claimBalPP'), bU=document.getElementById('claimBalUSDT');
  if(bPP) bPP.textContent=(walletState.gamePP||0).toLocaleString(undefined,{maximumFractionDigits:2});
  if(bU) bU.textContent=(walletState.gameUsdt||0).toLocaleString(undefined,{maximumFractionDigits:2});
  // Reset pay method to PP
  selectedPayMethod='pp';
  selectPayMethod('pp');
  // 이미지 미리보기 표시
  if(stampImgUrl){
    uploadedUrl=stampImgUrl;
    document.getElementById('claimThumb').src=stampImgUrl;
    document.getElementById('claimImgSize').textContent=cw+'×'+ch+'px';
    document.getElementById('claimImgPreview').style.display='flex';
  }else{
    document.getElementById('claimImgPreview').style.display='none';
  }
  // 체인 정보 표시 (로그인 시 선택한 체인)
  var ch2=walletState.chain||'base';
  var cfg=CHAINS[ch2];
  if(cfg){
    document.getElementById('claimChainDot').className='chain-dot '+ch2;
    document.getElementById('claimChainName').textContent=cfg.name.toUpperCase();
  }
  selectedChain=ch2;
  // ── 섹터 레벨 진입 제한 체크 ──
  var _lvWarn=document.getElementById('claimLevelWarn');
  var _cfmBtn=document.getElementById('claimConfirmBtn');
  var _blockedSec=_getBlockedSector(selectedPlot.lat, selectedPlot.lng);
  if(_blockedSec){
    var _myLv2=parseInt((document.getElementById('profileLevel')||{}).textContent||'1')||1;
    if(_lvWarn){_lvWarn.style.display='';_lvWarn.textContent=LANG==='ko'?('🔒 이 섹터는 Lv '+_blockedSec.entryMinLevel+' 이상만 구매 가능 (현재 Lv '+_myLv2+')'):LANG==='ja'?('🔒 このセクターはLv '+_blockedSec.entryMinLevel+' 以上が必要です (現在Lv '+_myLv2+')'):LANG==='zh'?('🔒 此扇区需要Lv '+_blockedSec.entryMinLevel+' 以上 (当前Lv '+_myLv2+')'):'🔒 This sector requires Lv '+_blockedSec.entryMinLevel+' (current Lv '+_myLv2+')';}
    if(_cfmBtn){_cfmBtn.disabled=true;_cfmBtn.style.opacity='0.4';_cfmBtn.style.cursor='not-allowed';}
  }else{
    if(_lvWarn) _lvWarn.style.display='none';
    if(!_isHijackMode){
      // 일반 claim 모드: 버튼 활성화
      if(_cfmBtn){_cfmBtn.disabled=false;_cfmBtn.style.opacity='';_cfmBtn.style.cursor='';}
    }
    // 하이젝 모드: _loadHijackFleets가 버튼 상태 관리
  }
  // ── 하이젝 모드: 섹터 차단 없으면 함대 로더 실행 ──
  if(_isHijackMode && !_blockedSec){
    _loadHijackFleets();
  }
}

// ── 하이젝 함대 선택기 로딩 ──
var _hijackSelectedFleetId = null;
async function _loadHijackFleets(){
  var fsel=document.getElementById('hijackFleetSelector');
  var fnofl=document.getElementById('hijackNoFleetWarn');
  var fload=document.getElementById('hijackFleetLoading');
  var _cfmBtn=document.getElementById('claimConfirmBtn');
  if(!fsel||!fnofl||!fload) return;
  fsel.style.display='none'; fnofl.style.display='none';
  fload.style.display='';
  _hijackSelectedFleetId=null;
  // 일시적으로 버튼 비활성화
  if(_cfmBtn){_cfmBtn.disabled=true;_cfmBtn.style.opacity='0.4';_cfmBtn.style.cursor='not-allowed';}
  try{
    var headers={'Content-Type':'application/json'};
    if(emailAuth&&emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;
    var r=await fetch('/api/fleets',{headers:headers});
    var d=await r.json();
    var myFleets=(d.fleets||[]).filter(function(f){return f.ships_alive>0&&!f.is_in_battle;});
    fload.style.display='none';
    if(myFleets.length===0){
      fnofl.style.display='';
      // 버튼 비활성 유지
    }else{
      fsel.style.display='';
      var sel=document.getElementById('hijackClaimFleetSelect');
      if(sel){
        sel.innerHTML=myFleets.map(function(f){
          return '<option value="'+f.id+'">'+escapeHtml(f.name)+' ('+f.ships_alive+(LANG==="ko"?"척":LANG==="ja"?"隻":LANG==="zh"?"艘":"ships")+')</option>';
        }).join('');
        _hijackSelectedFleetId=myFleets[0].id;
        // 함대 정보 표시
        var finfo=document.getElementById('hijackFleetInfo');
        if(finfo) finfo.textContent=LANG==='ko'?('총 '+myFleets.length+'개 함대 사용 가능'):LANG==='ja'?('計 '+myFleets.length+'艦隊 使用可能'):LANG==='zh'?('共 '+myFleets.length+'支舰队 可用'):(myFleets.length+' fleet(s) available');
        sel.onchange=function(){_hijackSelectedFleetId=parseInt(this.value)||null;};
        // 버튼 활성화
        if(_cfmBtn){_cfmBtn.disabled=false;_cfmBtn.style.opacity='';_cfmBtn.style.cursor='';
          _cfmBtn.textContent='⚔ DECLARE HIJACK';}
      }
    }
  }catch(e){
    fload.style.display='none';
    fnofl.style.display='';
    console.warn('[hijack] fleet load error:',e);
  }
}
function closeClaimModal(){
  document.getElementById('claimModal').classList.remove('open');
  // 버튼 텍스트 초기화
  var _cfmBtn=document.getElementById('claimConfirmBtn');
  if(_cfmBtn){_cfmBtn.textContent=t('confirm_claim')||'CONFIRM CLAIM';_cfmBtn.disabled=false;_cfmBtn.style.opacity='';_cfmBtn.style.cursor='';}
  _hijackSelectedFleetId=null;
}

/* ── Battle Animation Overlay ──────────────────────── */
function _showBattleAnimation(result){
  return new Promise(function(resolve){
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.7);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--fn);animation:fadeIn .3s';
    var won=result.attackWon||0, lost=result.attackLost||0, total=result.overlapCount||0;
    var newPx=result.newCount||0;

    // Battle canvas for sword/shield animation
    var cvs=document.createElement('canvas');cvs.width=400;cvs.height=300;
    cvs.style.cssText='width:300px;height:225px;margin-bottom:16px';
    ov.appendChild(cvs);

    // Status text
    var statusEl=document.createElement('div');
    statusEl.style.cssText='font-size:14px;color:var(--gold);letter-spacing:2px;text-transform:uppercase';
    statusEl.textContent='BATTLE IN PROGRESS...';
    ov.appendChild(statusEl);

    // Sub-info
    var subEl=document.createElement('div');
    subEl.style.cssText='font-size:10px;color:var(--tx3);margin-top:6px';
    subEl.textContent='Attacking '+total+' pixels...';
    ov.appendChild(subEl);

    document.body.appendChild(ov);

    var ctx=cvs.getContext('2d');
    var frame=0, phase=0; // phase 0=fighting, 1=result
    var startTime=Date.now();

    function drawSword(cx,cy,angle,color){
      ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
      // Blade
      ctx.fillStyle=color;
      ctx.fillRect(-3,-40,6,35);
      // Guard
      ctx.fillStyle='#8B7355';
      ctx.fillRect(-12,-5,24,6);
      // Handle
      ctx.fillStyle='#5C4033';
      ctx.fillRect(-3,-5,6,18);
      // Pommel
      ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(0,15,4,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    function drawShield(cx,cy,color){
      ctx.save();ctx.translate(cx,cy);
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.moveTo(0,-30);ctx.lineTo(25,-20);ctx.lineTo(25,10);ctx.lineTo(0,30);
      ctx.lineTo(-25,10);ctx.lineTo(-25,-20);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;ctx.stroke();
      // Emblem
      ctx.fillStyle='rgba(255,255,255,.2)';
      ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    function drawSparks(cx,cy,t){
      for(var i=0;i<6;i++){
        var a=t*3+i*Math.PI/3;
        var r=10+Math.sin(t*5+i)*15;
        var sx=cx+Math.cos(a)*r, sy=cy+Math.sin(a)*r;
        ctx.fillStyle='rgba(255,'+Math.floor(160+Math.random()*95)+',60,'+(0.5+Math.random()*0.5)+')';
        ctx.fillRect(sx-1,sy-1,3,3);
      }
    }

    function animate(){
      if(!_pageIsActive()){
        _onPageVisibleOnce(function(){ requestAnimationFrame(animate); });
        return;
      }
      frame++;
      var elapsed=(Date.now()-startTime)/1000;
      ctx.clearRect(0,0,400,300);

      // Background: dark mars surface
      ctx.fillStyle='#1a0e08';ctx.fillRect(0,0,400,300);
      // Ground line
      ctx.fillStyle='#3a1e10';ctx.fillRect(0,220,400,80);
      ctx.strokeStyle='#6b3520';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,220);ctx.lineTo(400,220);ctx.stroke();

      if(phase===0){
        // Fighting animation
        var swing=Math.sin(elapsed*6)*0.5;
        var clash=Math.sin(elapsed*8)*5;

        // Attacker (left) — sword
        var ax=130+clash, ay=140;
        drawSword(ax,ay,-0.3+swing,'#FF7840');

        // Defender (right) — shield
        var dx=270-clash, dy=140;
        drawShield(dx,dy,'#4488CC');

        // Sparks at clash point
        if(Math.abs(clash)<3) drawSparks(200,130,elapsed);

        // Labels
        ctx.fillStyle='#FF7840';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
        ctx.fillText('ATTACKER',130,200);
        ctx.fillStyle='#4488CC';
        ctx.fillText('DEFENDER',270,200);

        // Progress bar
        var progress=Math.min(elapsed/2.5,1);
        ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(100,250,200,8);
        ctx.fillStyle='rgba(255,120,60,.6)';ctx.fillRect(100,250,200*progress,8);

        if(elapsed>2.5) phase=1;
      }

      if(phase===1){
        // Result display
        var resultAlpha=Math.min((elapsed-2.5)*2,1);
        ctx.globalAlpha=resultAlpha;

        // Result icon
        var isWin=won>=lost;
        ctx.fillStyle=isWin?'rgba(76,216,154,.15)':'rgba(232,72,85,.15)';
        ctx.beginPath();ctx.arc(200,100,50,0,Math.PI*2);ctx.fill();

        ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=isWin?'#4CD89A':'#E84855';
        ctx.fillText(isWin?'⚔':'🛡',200,95);

        ctx.font='bold 16px sans-serif';
        ctx.fillStyle=isWin?'#4CD89A':'#E84855';
        ctx.fillText(isWin?'VICTORY':'DEFENDED',200,145);

        // Stats
        ctx.font='11px sans-serif';ctx.fillStyle='#E0E0E8';
        ctx.fillText('Won: '+won+'px    Lost: '+lost+'px    New: '+newPx+'px',200,175);

        if(result.refundFromFailed>0){
          ctx.font='9px sans-serif';ctx.fillStyle='#FF7840';
          ctx.fillText('Refund: '+result.refundFromFailed+' PP (90%)',200,195);
        }

        ctx.globalAlpha=1;

        // Auto-close after showing result
        if(elapsed>4.5){
          document.body.removeChild(ov);
          showNotification(
            'hijack',
            isWin
              ? tl('Battle won','전투 승리','戦闘勝利','战斗胜利')
              : tl('Territory defended','영토 방어 성공','領土防衛成功','领地防御成功'),
            isWin
              ? tl(won+'/'+total+'px captured!',won+'/'+total+'px 점령!',won+'/'+total+'px を占領!', '已夺取 '+won+'/'+total+'px!')
              : tl('Held '+lost+'/'+total+'px against attack',lost+'/'+total+'px 방어 유지',lost+'/'+total+'px を防衛','守住了 '+lost+'/'+total+'px')
          );
          try{isWin?_sfx.hijackWin():_sfx.hijackFail()}catch(e){}
          resolve();
          return;
        }
      }

      requestAnimationFrame(animate);
    }
    animate();
  });
}

async function confirmClaim(){
  try{_sfx.click()}catch(e){}
  if(!selectedPlot) return;
  // 로그인 체크
  if(!walletState.connected){
    closeClaimModal();
    showToast(t('daily_login_required')||tl('Login required','로그인이 필요합니다','ログインが必要です','请先登录'));
    openAuthModal();
    return;
  }
  var cw=selectedPlot.w||stampW, ch=selectedPlot.h||stampH;
  var costInfo=lastStampCost||calcStampCost(selectedPlot.lat,selectedPlot.lng,cw,ch);
  var price=costInfo.total;
  var hasOverlap=costInfo.overlapCount>0;
  var linkVal=(document.getElementById('stampLinkInput')?document.getElementById('stampLinkInput').value:'').trim();

  // 이미지 없이도 땅 구매 가능 (나중에 이미지 추가)

  // 극지방 제한: 스탬프 영역이 ±70° 넘으면 차단
  var claimLatMax=selectedPlot.lat+ch*0.1/2;
  var claimLatMin=selectedPlot.lat-ch*0.1/2;
  if(claimLatMax>70||claimLatMin<-70){
    showToast(tl('Polar zone — cannot claim beyond ±70° latitude','극지대는 ±70° 위도를 넘어 점령할 수 없습니다','極地帯では ±70° 緯度を超えて領土を確保できません','极地区域无法在 ±70° 纬度之外占领'));
    if(btn){btn.disabled=false;btn.textContent=t('confirm_claim');}
    return;
  }

  // Disable button while processing
  var btn=document.getElementById('claimConfirmBtn');
  if(btn){btn.disabled=true;btn.textContent='PROCESSING...';}

  try{
    // ── Upload image: blob/data URL → server file → /uploads/xxx.jpg ──
    var sendImageUrl=uploadedUrl||'';
    if(sendImageUrl&&(sendImageUrl.startsWith('blob:')||sendImageUrl.startsWith('data:'))){
      try{
        var dataUrl=sendImageUrl;
        // Convert blob: to uploadable data
        var originalGifUrl=null;
        if(sendImageUrl.startsWith('blob:')){
          // Use cached img element (already loaded by activateStamp)
          var imgEl=imgCache[sendImageUrl];
          if(!imgEl){
            var tmpImg=new Image();tmpImg.crossOrigin='anonymous';
            await new Promise(function(resolve,reject){
              tmpImg.onload=resolve;tmpImg.onerror=reject;tmpImg.src=sendImageUrl;
            });
            imgEl=tmpImg;
          }

          // Check if GIF using the original File object
          var isGif=_stampOrigFile&&(_stampOrigFile.type==='image/gif');

          // For GIFs: upload original GIF first
          if(isGif){
            var gifDataUrl=await new Promise(function(resolve){
              var reader=new FileReader();
              reader.onload=function(){resolve(reader.result)};
              reader.readAsDataURL(_stampOrigFile);
            });
            if(btn) btn.textContent='UPLOADING GIF...';
            var gifResp=await fetch('/api/upload',{
              method:'POST',headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
              body:JSON.stringify({dataUrl:gifDataUrl})
            });
            var gifData=await gifResp.json();
            if(gifResp.ok&&gifData.url) originalGifUrl=gifData.url;
          }

          // Always create thumbnail for texture (using already-loaded imgEl)
          // Use PNG to preserve transparency, JPEG for opaque images
          var cvs=document.createElement('canvas');
          var maxDim=1536; // Higher res for texture quality
          var scale=Math.min(maxDim/(imgEl.naturalWidth||imgEl.width),maxDim/(imgEl.naturalHeight||imgEl.height),1);
          cvs.width=Math.round((imgEl.naturalWidth||imgEl.width)*scale);
          cvs.height=Math.round((imgEl.naturalHeight||imgEl.height)*scale);
          var tCtx=cvs.getContext('2d');
          tCtx.drawImage(imgEl,0,0,cvs.width,cvs.height);
          // Detect transparency: check a few pixels for alpha < 255
          var hasAlpha=false;
          try{
            var sample=tCtx.getImageData(0,0,cvs.width,Math.min(cvs.height,4));
            for(var si=3;si<sample.data.length;si+=4){
              if(sample.data[si]<250){hasAlpha=true;break;}
            }
          }catch(e){}
          dataUrl=hasAlpha?cvs.toDataURL('image/png'):cvs.toDataURL('image/jpeg',0.92);
        }
        // Upload JPEG thumbnail
        if(btn) btn.textContent='UPLOADING...';
        var upResp=await fetch('/api/upload',{
          method:'POST',
          headers:Object.assign({'Content-Type':'application/json'},getAuthHeaders()),
          body:JSON.stringify({dataUrl:dataUrl})
        });
        var upData=await upResp.json();
        if(upResp.ok&&upData.url){
          sendImageUrl=upData.url;
        }else{
          showToast(upData.error||'IMAGE UPLOAD FAILED');
          if(btn){btn.disabled=false;btn.textContent=t('confirm_claim');}
          return;
        }
      }catch(convErr){
        console.warn('Image upload failed:',convErr);
        showToast('IMAGE UPLOAD FAILED');
        if(btn){btn.disabled=false;btn.textContent=t('confirm_claim');}
        return;
      }
    }

    // ── 하이젝 (적 영토 겹침) → 함대전 경로 ──
    if(hasOverlap){
      // 함대 선택 확인
      if(!_hijackSelectedFleetId){
        showToast(LANG==='ko'?'⚠ 먼저 함대를 선택하세요':LANG==='ja'?'⚠ まず艦隊を選択してください':LANG==='zh'?'⚠ 请先选择舰队':'⚠ Select a fleet first');
        if(btn){btn.disabled=false;btn.textContent='⚔ DECLARE HIJACK';}
        return;
      }
      // 슬로대 스타일 — 하이잭 진입 전 파벌 캐릭터 대사
      try{ await showFactionFlavor('hijack_start'); }catch(_){ }
      // 로딩 표시
      if(btn) btn.textContent=LANG==='ko'?'⚔ 함대전 선언 중...':LANG==='ja'?'⚔ 艦隊戦宣言中...':LANG==='zh'?'⚔ 宣布舰队战...':'⚔ Declaring battle...';
      var hjHeaders={'Content-Type':'application/json'};
      if(emailAuth&&emailAuth.token) hjHeaders['Authorization']='Bearer '+emailAuth.token;
      var hjResp=await fetch('/api/hijack/declare-with-pp',{
        method:'POST',headers:hjHeaders,
        body:JSON.stringify({
          wallet:walletState.address,
          lat:selectedPlot.lat, lng:selectedPlot.lng,
          width:cw, height:ch,
          atk_fleet_id:_hijackSelectedFleetId,
          imageUrl:sendImageUrl,
          originalImageUrl:originalGifUrl||'',
          linkUrl:linkVal||'',
          payMethod:selectedPayMethod||'pp'
        })
      });
      var hjData=await hjResp.json();
      if(btn){btn.disabled=false;btn.textContent='⚔ DECLARE HIJACK';}
      closeClaimModal();
      if(!hjResp.ok){
        var hjErrMap={
          ko:{
            'ATK_FLEET_NOT_FOUND':'공격 함대를 찾을 수 없습니다',
            'ATK_FLEET_IN_BATTLE':'공격 함대가 이미 전투 중입니다',
            'NO_PHASE1_SHIPS':'프리깃/구축함이 없습니다',
            'TOO_MANY_PHASE1_SHIPS':'Phase 1 함선 수 초과',
            'INSUFFICIENT_PP':'PP 잔액 부족 (필요: '+(hjData.required||0).toFixed(2)+')',
            'Peace Treaty active — hijacking is temporarily disabled':'평화 협정 발동 중 — 하이젝 불가',
          },
          ja:{
            'ATK_FLEET_NOT_FOUND':'攻撃艦隊が見つかりません',
            'ATK_FLEET_IN_BATTLE':'攻撃艦隊はすでに戦闘中です',
            'NO_PHASE1_SHIPS':'フリゲート/駆逐艦がありません',
            'TOO_MANY_PHASE1_SHIPS':'Phase 1 艦船数の上限を超えています',
            'INSUFFICIENT_PP':'PP 残高不足 (必要: '+(hjData.required||0).toFixed(2)+')',
            'Peace Treaty active — hijacking is temporarily disabled':'平和条約発動中 — ハイジャック不可',
          },
          zh:{
            'ATK_FLEET_NOT_FOUND':'找不到攻击舰队',
            'ATK_FLEET_IN_BATTLE':'攻击舰队已在战斗中',
            'NO_PHASE1_SHIPS':'没有护卫舰/驱逐舰',
            'TOO_MANY_PHASE1_SHIPS':'Phase 1 舰船数量超出上限',
            'INSUFFICIENT_PP':'PP 余额不足 (需要: '+(hjData.required||0).toFixed(2)+')',
            'Peace Treaty active — hijacking is temporarily disabled':'和平条约生效中 — 暂时无法劫持',
          },
          en:{
            'ATK_FLEET_NOT_FOUND':'Attack fleet not found',
            'ATK_FLEET_IN_BATTLE':'Attack fleet is already in battle',
            'NO_PHASE1_SHIPS':'No frigates/destroyers available',
            'TOO_MANY_PHASE1_SHIPS':'Too many Phase 1 ships',
            'INSUFFICIENT_PP':'Insufficient PP balance (required: '+(hjData.required||0).toFixed(2)+')',
            'Peace Treaty active — hijacking is temporarily disabled':'Peace Treaty active — hijacking is temporarily disabled',
          }
        };
        const _hjFailPrefix={ko:'하이젝 실패: ',ja:'ハイジャック失敗: ',zh:'劫持失败: ',en:'Hijack failed: '};
        showToast((hjErrMap[LANG]||hjErrMap.en)[hjData.error]||((_hjFailPrefix[LANG]||_hjFailPrefix.en)+hjData.error));
        try{_sfx.error()}catch(e){}
        return;
      }
      // 성공 처리
      if(hjData.auto_win){
        // 자동 승리 (수비자 함대 없음)
        showNotification('hijack','⚔ AUTO-WIN',LANG==='ko'?'상대 함대 없음 — 즉시 영토 점령!':LANG==='ja'?'敵艦隊なし — 即座に領土制圧!':LANG==='zh'?'无敌方舰队 — 立即占领领地!':'No enemy fleet — territory captured!');
        try{_sfx.hijackWin()}catch(e){}
        if (typeof refreshGP === 'function') refreshGP();
        // ── 즉시 _serverPixels 반영 (Railway DB 레이턴시와 무관하게 즉시 금색 표시) ──
        var _myW=(walletState.address||'').toLowerCase();
        var _newCid=hjData.new_claim_id||null;
        var _allHijacked=[].concat(hjData.hijacked_pixels||[]).concat(hjData.new_pixels_list||[]);
        if(_allHijacked.length>0){
          _allHijacked.forEach(function(px){
            var key=px[0]+','+px[1];
            var prev=_serverPixels[key]||{};
            _serverPixels[key]={owner:_myW,price:prev.price||0,claimId:_newCid,claimIdx:prev.claimIdx};
          });
          // claims 배열에도 새 claim 추가
          if(_newCid){
            var _existClaim=false;
            for(var _ci=0;_ci<claims.length;_ci++){if(claims[_ci].id===_newCid){_existClaim=true;break;}}
            if(!_existClaim){
              claims.push({
                id:_newCid,
                owner:_myW,
                lat:selectedPlot?selectedPlot.lat:0,
                lng:selectedPlot?selectedPlot.lng:0,
                w:cw||1,
                h:ch||1,
                label:'YOU',
                nickname:walletState.nickname||'YOU',
                ts:Date.now()
              });
            }
          }
          _rebuildOwnerData();
          claimsSnapshot=null;
          compositeClaimsOnTexture();
        }
        // 맵 새로고침 — Railway DB 레이턴시 감안해 2s+6s 두 번 시도 (백업)
        function _refreshPixelsAfterHijack(){
          _guardedJsonFetch('hijack-pixels-refresh', '/api/pixels', {minGap:15000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(sp){
            if(sp&&typeof sp==='object'&&Object.keys(sp).length>0){
              initPixelGridFromServer(sp);
              // claims도 재로드
              return _guardedJsonFetch('hijack-claims-refresh', '/api/claims', {minGap:15000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(sc){
                if(sc&&sc.length){
                  var existIds={};
                  claims.forEach(function(c){if(c.id)existIds[c.id]=true;});
                  sc.forEach(function(c){if(!existIds[c.id])claims.push(c);
                    else{for(var i=0;i<claims.length;i++){if(claims[i].id===c.id){claims[i]=c;break;}}}
                  });
                }
              }).catch(function(){});
            }
          }).then(function(){claimsSnapshot=null;compositeClaimsOnTexture();}).catch(function(){});
        }
        _setActiveTimeout(_refreshPixelsAfterHijack, 2000);
        _setActiveTimeout(_refreshPixelsAfterHijack, 6000);
      }else{
        // 함대전 진행 중 — 배틀 뷰어 자동 오픈
        showNotification('hijack',LANG==='ko'?'⚔ 함대전 진행 중':LANG==='ja'?'⚔ 艦隊戦進行中':LANG==='zh'?'⚔ 舰队战进行中':'⚔ Fleet Battle',LANG==='ko'?'Phase 1 전투 시작!':LANG==='ja'?'Phase 1 開始!':LANG==='zh'?'Phase 1 开始!':'Phase 1 started!');
        try{_sfx.click()}catch(e){}
        if (typeof refreshGP === 'function') refreshGP();
        // Phase 1 battle viewer 자동 오픈 (10초 prep 후 시작)
        if (hjData.phase1_battle_id && typeof openBattleViewer === 'function') {
          // [v7.227] 영토 탈취 개시 인트로 영상 → 끝나면(또는 탭 스킵) battle viewer.
          var _bid = hjData.phase1_battle_id;
          playHijackIntro().then(function(){
            try { openBattleViewer(_bid); } catch(e) { console.error('openBattleViewer:', e); }
          });
        }
      }
      return;
    }

    // ── Optimistic update: show claim on map immediately ──
    var myAddr=walletState.address||'';
    var optimisticPixels=getClaimPixels(selectedPlot.lat,selectedPlot.lng,cw,ch);
    optimisticPixels.forEach(function(p){
      var k=pxKey(p.lat,p.lng);
      var ex=pixelGrid[k];
      if(!ex||!ex.owner||ex.owner.toLowerCase()===myAddr.toLowerCase()){
        pixelGrid[k]={owner:myAddr,price:PIXEL_PRICE,claimIdx:claims.length,claimId:-1};
      }
    });
    _serverPixels=Object.assign({},_serverPixels); // shallow copy
    optimisticPixels.forEach(function(p){
      var k=pxKey(p.lat,p.lng);
      var cur=pixelGrid[k];
      // Only add to serverPixels if we actually set it as ours (not enemy territory)
      if(cur&&cur.claimId===-1) _serverPixels[k]=cur;
    });
    _rebuildOwnerData();
    claimsSnapshot=null;
    compositeClaimsOnTexture();
    closeClaimModal();

    // 슬로대 스타일 — 새 영토 클레임 작전 시작 대사
    try{ await showFactionFlavor('claim_executing'); }catch(_){ }

    // ── Server API call: deduct PP/USDT and record claim ──
    var headers={'Content-Type':'application/json'};
    if(emailAuth.token) headers['Authorization']='Bearer '+emailAuth.token;

    var resp=await fetch('/api/claim',{
      method:'POST',
      headers:headers,
      body:JSON.stringify({
        wallet:walletState.address,
        lat:selectedPlot.lat,
        lng:selectedPlot.lng,
        width:cw,
        height:ch,
        imageUrl:sendImageUrl,
        originalImageUrl:originalGifUrl||'',
        linkUrl:linkVal||'',
        payMethod:selectedPayMethod||'pp'
      })
    });
    var d=await resp.json();

    if(!resp.ok){
      // Rollback optimistic update
      optimisticPixels.forEach(function(p){
        var k=pxKey(p.lat,p.lng);
        delete pixelGrid[k]; delete _serverPixels[k];
      });
      _rebuildOwnerData();
      claimsSnapshot=null;
      compositeClaimsOnTexture();
      showToast(srvErr(d.error)||'CLAIM FAILED','error');
      try{_sfx.error()}catch(e){}
      if(btn){btn.disabled=false;btn.textContent=t('confirm_claim');}
      return;
    }

    // ── Success: handle battle animation or direct claim ──

    var hasBattle=d.overlapCount>0;
    if(hasBattle){
      // Show battle animation overlay before revealing results
      await _showBattleAnimation(d);
    }else{
      showNotification('claim',tl('Territory claimed','영토 점령 완료','領土を確保しました','领地占领成功'),tl('New land secured for $'+d.totalCost.toFixed(2),'새 영토 확보 — $'+d.totalCost.toFixed(2),'新しい領土を確保 — $'+d.totalCost.toFixed(2),'已花费 $'+d.totalCost.toFixed(2)+' 成功占领新领地'));
      try{_sfx.claim()}catch(e){}
    }

    try{
    var myAddr=walletState.address||'';
    var myLabel=walletState.address?shortAddr(walletState.address):'YOU';
    // Compute actual claimed pixel bounds (may be smaller than requested if battle lost)
    var allConfirmed=[];
    if(d.newPixels) d.newPixels.forEach(function(p){allConfirmed.push(p)});
    if(d.wonPixels) d.wonPixels.forEach(function(p){allConfirmed.push(p)});
    var ncLat=selectedPlot.lat, ncLng=selectedPlot.lng, ncW=cw, ncH=ch;
    if(allConfirmed.length>0 && d.attackLost>0){
      // Recalculate center and size from actual confirmed pixels
      var mnLat=Infinity,mxLat=-Infinity,mnLng=Infinity,mxLng=-Infinity;
      allConfirmed.forEach(function(p){
        if(p[0]<mnLat)mnLat=p[0];if(p[0]>mxLat)mxLat=p[0];
        if(p[1]<mnLng)mnLng=p[1];if(p[1]>mxLng)mxLng=p[1];
      });
      ncLat=(mnLat+mxLat)/2; ncLng=(mnLng+mxLng)/2;
      ncW=Math.round((mxLng-mnLng)/GRID_SIZE)+1;
      ncH=Math.round((mxLat-mnLat)/GRID_SIZE)+1;
    } else if(allConfirmed.length===0){
      ncW=0; ncH=0;
    }
    var nc={lat:ncLat,lng:ncLng,owner:myAddr,price:d.totalCost,
      label:'YOU',nickname:walletState.nickname||'YOU',w:ncW,h:ncH,link:linkVal||'',id:d.claimId};
    nc.imgUrl=sendImageUrl||uploadedUrl||'';
    claims.push(nc);

    // Register pixels in grid using server-authoritative data
    var claimIdx=claims.length-1;
    if(d.newPixels){
      d.newPixels.forEach(function(p){
        var k=pxKey(p[0],p[1]);
        var entry={owner:myAddr,price:PIXEL_PRICE,claimIdx:claimIdx,claimId:d.claimId};
        pixelGrid[k]=entry;
        _serverPixels[k]=entry;
      });
    }
    if(d.wonPixels){
      // Track which old claims lost pixels
      var _lostClaimIds={};
      d.wonPixels.forEach(function(p){
        var k=pxKey(p[0],p[1]);
        var existing=pixelGrid[k];
        // Track old claimId for cleanup
        if(existing&&existing.claimId&&existing.claimId!==-1) _lostClaimIds[existing.claimId]=true;
        var newPrice=existing? existing.price*HIJACK_MULT : PIXEL_PRICE;
        var entry={owner:myAddr,price:newPrice,claimIdx:claimIdx,claimId:d.claimId};
        pixelGrid[k]=entry;
        _serverPixels[k]=entry;
      });
      // Check if old claims lost ALL their pixels — if so, remove from claims array
      for(var _lcId in _lostClaimIds){
        var lcIdN=parseInt(_lcId);
        // Count remaining pixels for this claim
        var remaining=0;
        for(var _pk in _serverPixels){
          if(_serverPixels[_pk].claimId===lcIdN) remaining++;
        }
        if(remaining===0){
          // All pixels hijacked — mark claim as dead
          for(var _ci2=0;_ci2<claims.length;_ci2++){
            if(claims[_ci2].id===lcIdN){ claims[_ci2].owner='__dead__'; break; }
          }
        }
      }
    }
    if(!d.newPixels&&!d.wonPixels&&d.overlapCount===0){
      var pixels=getClaimPixels(selectedPlot.lat,selectedPlot.lng,cw,ch);
      pixels.forEach(function(p){
        var k=pxKey(p.lat,p.lng);
        if(!pixelGrid[k]||!pixelGrid[k].owner){
          var entry={owner:myAddr,price:PIXEL_PRICE,claimIdx:claimIdx,claimId:d.claimId};
          pixelGrid[k]=entry;
          _serverPixels[k]=entry;
        }
      });
    }

    // ── Clean up optimistic pixels that weren't confirmed by server ──
    var confirmedKeys={};
    if(d.newPixels) d.newPixels.forEach(function(p){ confirmedKeys[pxKey(p[0],p[1])]=true; });
    if(d.wonPixels) d.wonPixels.forEach(function(p){ confirmedKeys[pxKey(p[0],p[1])]=true; });
    optimisticPixels.forEach(function(p){
      var k=pxKey(p.lat,p.lng);
      if(!confirmedKeys[k]){
        // This pixel wasn't confirmed — revert optimistic entry
        var cur=pixelGrid[k];
        if(cur&&cur.claimId===-1){
          // Was optimistically set by us but server didn't confirm — remove
          delete pixelGrid[k]; delete _serverPixels[k];
        }
      }
    });

    // Rebuild owner strips
    _rebuildOwnerData();

    // After battles, fetch authoritative pixel data to ensure sync
    if(hasBattle){
      _guardedJsonFetch('claim-battle-pixels-refresh', '/api/pixels', {minGap:15000, backoffMs:120000, fetchOptions:{headers:getAuthHeaders()}}).then(function(sp){
        if(sp&&typeof sp==='object'&&Object.keys(sp).length>0){
          initPixelGridFromServer(sp);
          claimsSnapshot=null;compositeClaimsOnTexture();
        }
      }).catch(function(){});
    }

    // Reset modes
    stampMode=false; stampImgUrl=null;
    stampPreviewLat=null; stampPreviewLng=null;
    lastStampCost=null;
    landSelectMode=false; landDragStart=null; landDragEnd=null; landDragRect=null;
    document.getElementById('landSelectPreview').style.display='none';
    document.getElementById('landSelectBtn').textContent='DRAG TO SELECT LAND';
    document.getElementById('landSelectBtn').style.color='var(--mars)';
    _clearDragPreviewPolygon();
    if(nc.imgUrl){
      cacheImage(nc.imgUrl,function(){claimsSnapshot=null;compositeClaimsOnTexture()});
    }
    claimsSnapshot=null;
    compositeClaimsOnTexture();
    if(d.totalPixelsSold!=null) document.getElementById('statPlots').textContent=fmtNum(d.totalPixelsSold);
    if(d.totalVolume!=null) document.getElementById('statTVL').textContent='$'+fmtNum(d.totalVolume);

    if(hasBattle){
      var feedMsg='⚔ BATTLE: won '+d.attackWon+'/'+d.overlapCount+'px, claimed '+d.newCount+'px new';
      if(d.attackLost>0) feedMsg+=' ('+d.attackLost+'px defended, refund '+d.refundFromFailed+' PP)';
      addFeed(feedMsg);
    }else{
      addFeed('⚡ YOU claimed ['+selectedPlot.lat.toFixed(0)+'°,'+selectedPlot.lng.toFixed(0)+'°]!');
    }
    // Governance change alerts
    if(d.govChanges&&d.govChanges.length) addGovFeed(d.govChanges);
    }catch(stateErr){console.error('[Claim] State update error (claim succeeded):',stateErr)}

    // Track quest progress for claim actions
    try{trackQuestAction('claim_pixels',d.pixelCount||1)}catch(e){}
    if(hasBattle&&d.attackWon>0){try{trackQuestAction('hijack',d.attackWon)}catch(e){}}

    // ── [Onboarding] Tutorial free claim → advance to step 2 ──
    if (d.tutorialFreeClaim) {
      try { onTutorialClaimSuccess(); } catch(_oe) {}
    }

    // Update balances from server response
    if(d.ppUsed!==undefined||d.usdtUsed!==undefined){
      walletState.gamePP-=(d.ppUsed||0);
      walletState.gameUsdt-=(d.usdtUsed||0);
    }
    refreshEmailBalances();

    // Refresh owned-sector list so newly-claimed sectors unlock POI discovery
    try{ if(typeof loadExplorationData==='function') loadExplorationData(); }catch(_le){}

    var savePlot={lat:selectedPlot.lat,lng:selectedPlot.lng};
    selectedPlot=null;uploadedUrl=null;
    document.getElementById('territoryInfo').style.display='none';
    refreshMyStats();

    // Hijack alerts for affected owners
    if(hasOverlap&&d.affectedOwners){
      for(var o in d.affectedOwners){
        var a=d.affectedOwners[o];
        addAlert('earn','Hijack refund: '+(a.refund||0).toFixed(2)+' PP + '+(a.bonus||0).toFixed(2)+' PP bonus from '+myAddr,savePlot);
      }
    }
  }catch(e){
    console.error('Claim error:',e);
    showToast('CLAIM FAILED: '+(e.message||'Network error'));
  }finally{
    if(btn){btn.disabled=false;btn.textContent=t('confirm_claim');}
  }
}

/* ── Old Image Upload (modal) ────────────────────── */
document.getElementById('imgFileInput').addEventListener('change',function(e){
  var file=e.target.files[0];if(!file)return;
  uploadedUrl=URL.createObjectURL(file);
  document.getElementById('uploadThumb').src=uploadedUrl;
  document.getElementById('uploadPreviewWrap').style.display='';
});
function loadFromUrl(){
  var v=document.getElementById('imgUrlInput').value.trim();if(!v)return;
  uploadedUrl=v;
  document.getElementById('uploadThumb').src=v;
  document.getElementById('uploadPreviewWrap').style.display='';
}
function clearUpload(){
  uploadedUrl=null;
  document.getElementById('uploadThumb').src='';
  document.getElementById('uploadPreviewWrap').style.display='none';
  document.getElementById('imgFileInput').value='';
  document.getElementById('imgUrlInput').value='';
}

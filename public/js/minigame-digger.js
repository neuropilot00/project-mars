/**
 * Mars Digger — Canvas-based Dig Dug minigame (화성 채굴)
 * Enhanced graphics with glow effects and detailed sprites.
 */
window.MarsDigger = (function () {
  const W = 360, H = 640, COLS = 15, ROWS = 25, CS = 24;
  const SURFACE = 2, MAX_LIVES = 3, TIME_LIMIT = 90;
  const PUMP_RANGE = 2, POPS_NEEDED = 3, DEFLATE_MS = 1000;
  let canvas, ctx, onGameEnd, rafId;
  let grid, player, minerals, worms, rocks, score, lives;
  let startTime, running, gameOver, keys = {};
  let touchStart, moveDir, pumpPressed;
  let sparkles, particles;
  let continueCount = 0;

  function init(canvasId, cb) {
    canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    ctx = canvas.getContext('2d'); onGameEnd = cb || function () {};
    canvas.addEventListener('keydown', function (e) { keys[e.key] = true; if (e.key === ' ') pumpPressed = true; e.preventDefault(); });
    canvas.addEventListener('keyup', function (e) { keys[e.key] = false; });
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); var t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY, time: Date.now() }; });
    canvas.addEventListener('touchend', function (e) {
      e.preventDefault(); if (!touchStart) return;
      var t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { pumpPressed = true; }
      else if (Math.abs(dx) > Math.abs(dy)) moveDir = dx > 0 ? 'r' : 'l';
      else moveDir = dy > 0 ? 'd' : 'u';
      touchStart = null;
    });
    canvas.tabIndex = 0; canvas.focus();
  }

  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * 2 + 0.5;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, decay: 0.03, size: Math.random() * 2.5 + 0.5, color: color });
    }
  }

  function buildLevel() {
    grid = []; for (var r = 0; r < ROWS; r++) { grid[r] = []; for (var c = 0; c < COLS; c++) grid[r][c] = r < SURFACE ? 0 : 1; }
    player = { col: 7, row: 0, dir: 'd', pumping: false, pumpTarget: null };
    minerals = []; worms = []; rocks = []; sparkles = []; particles = []; score = 0; lives = MAX_LIVES; gameOver = false;
    var tunnels = [[3,2,3,12],[6,5,6,10],[10,8,10,14],[12,3,12,9]];
    for (var i = 0; i < tunnels.length; i++) {
      var tr = tunnels[i][0], c1 = tunnels[i][1], c2 = tunnels[i][3], wr = tunnels[i][2] || tr;
      for (var c = c1; c <= c2; c++) if (grid[tr]) grid[tr][c] = 0;
      worms.push({ col: (c1 + c2) >> 1, row: tr, dir: Math.random() < 0.5 ? 'l' : 'r', pumps: 0, lastPump: 0, dead: false, moveT: 0,
        tMin: c1, tMax: c2, tRow: tr, digTimer: 0, phase: Math.random() * Math.PI * 2 });
    }
    placeItems(20, 'common', SURFACE + 1, ROWS - 1);
    placeItems(8, 'rare', SURFACE + 3, ROWS - 1);
    placeItems(3, 'crystal', 15, ROWS - 1);
    for (var i = 0; i < 5; i++) { var rr = rand(SURFACE + 2, ROWS - 3), rc = rand(1, COLS - 2);
      if (!grid[rr][rc]) continue; rocks.push({ col: rc, row: rr, falling: false, vy: 0 }); grid[rr][rc] = 2; }
  }

  function placeItems(n, type, minR, maxR) {
    for (var i = 0; i < n; i++) { var r = rand(minR, maxR), c = rand(0, COLS - 1);
      if (grid[r][c] !== 1) { i--; continue; }
      var pts = type === 'common' ? 10 : type === 'rare' ? 30 : 100;
      var depth = Math.floor((r - SURFACE) / 5) + 1;
      minerals.push({ col: c, row: r, type: type, pts: pts * depth, collected: false });
    }
  }

  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function start() { buildLevel(); running = true; startTime = Date.now(); gameOver = false; pumpPressed = false; moveDir = null; continueCount = 0; loop(); }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function getScore() { return score; }

  function loop() {
    if (!running) return;
    update(); draw();
    rafId = requestAnimationFrame(loop);
  }

  function update() {
    if (gameOver) return;
    var elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= TIME_LIMIT || lives <= 0) { endGame(); return; }
    var dx = 0, dy = 0;
    if (keys['ArrowLeft'] || moveDir === 'l') { dx = -1; player.dir = 'l'; }
    else if (keys['ArrowRight'] || moveDir === 'r') { dx = 1; player.dir = 'r'; }
    else if (keys['ArrowUp'] || moveDir === 'u') { dy = -1; player.dir = 'u'; }
    else if (keys['ArrowDown'] || moveDir === 'd') { dy = 1; player.dir = 'd'; }
    moveDir = null;
    var nc = player.col + dx, nr = player.row + dy;
    if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
      if (grid[nr][nc] === 2) { /* rock blocks */ }
      else { if (grid[nr][nc] === 1) { grid[nr][nc] = 0; addCrumble(nc, nr); } player.col = nc; player.row = nr; }
    }
    for (var i = 0; i < minerals.length; i++) { var m = minerals[i];
      if (!m.collected && m.col === player.col && m.row === player.row) {
        m.collected = true; score += m.pts;
        var color = m.type === 'common' ? '#FFD700' : m.type === 'rare' ? '#4488ff' : '#bb44ff';
        spawnParticles(m.col * CS + CS / 2, m.row * CS + CS / 2, color, 8);
      }
    }
    if (pumpPressed || keys[' ']) { tryPump(); pumpPressed = false; }
    var now = Date.now();
    for (var i = 0; i < worms.length; i++) { var w = worms[i];
      if (w.dead) continue;
      if (w.pumps > 0 && now - w.lastPump > DEFLATE_MS) w.pumps = Math.max(0, w.pumps - 1);
    }
    for (var i = 0; i < worms.length; i++) { var w = worms[i];
      if (w.dead) continue; w.moveT++; w.phase += 0.05;
      if (w.moveT < 12) continue; w.moveT = 0;
      w.digTimer++;
      if (w.digTimer > 8 && Math.abs(player.row - w.row) + Math.abs(player.col - w.col) < 8) {
        w.digTimer = 0;
        var dr = player.row > w.row ? 1 : player.row < w.row ? -1 : 0;
        var dc = player.col > w.col ? 1 : player.col < w.col ? -1 : 0;
        var tnr = w.row + dr, tnc = w.col + dc;
        if (tnr >= SURFACE && tnr < ROWS && tnc >= 0 && tnc < COLS && grid[tnr][tnc] !== 2) {
          if (grid[tnr][tnc] === 1) grid[tnr][tnc] = 0;
          w.row = tnr; w.col = tnc; wormCollision(w); continue;
        }
      }
      var nd = w.dir === 'r' ? 1 : -1, nnc = w.col + nd;
      if (nnc < 0 || nnc >= COLS || grid[w.row][nnc] === 1 || grid[w.row][nnc] === 2) w.dir = w.dir === 'r' ? 'l' : 'r';
      else { w.col = nnc; }
      wormCollision(w);
    }
    for (var i = 0; i < rocks.length; i++) { var rk = rocks[i];
      if (rk.row + 1 < ROWS && grid[rk.row + 1][rk.col] === 0) {
        rk.falling = true; grid[rk.row][rk.col] = 0; rk.row++; grid[rk.row][rk.col] = 2;
        for (var j = 0; j < worms.length; j++) { if (!worms[j].dead && worms[j].col === rk.col && worms[j].row === rk.row) { worms[j].dead = true; score += 100; spawnParticles(rk.col * CS + CS / 2, rk.row * CS + CS / 2, '#ff4444', 10); } }
        if (player.col === rk.col && player.row === rk.row) { lives--; respawn(); }
      } else { rk.falling = false; }
    }
    for (var i = sparkles.length - 1; i >= 0; i--) { sparkles[i].life--; if (sparkles[i].life <= 0) sparkles.splice(i, 1); }
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p]; pt.x += pt.vx; pt.y += pt.vy; pt.life -= pt.decay;
      if (pt.life <= 0) particles.splice(p, 1);
    }
  }

  function wormCollision(w) { if (w.col === player.col && w.row === player.row) { lives--; spawnParticles(player.col * CS + CS / 2, player.row * CS + CS / 2, '#ff4444', 8); respawn(); } }
  function respawn() { player.col = 7; player.row = 0; }

  function tryPump() {
    var dc = 0, dr = 0;
    if (player.dir === 'r') dc = 1; else if (player.dir === 'l') dc = -1;
    else if (player.dir === 'd') dr = 1; else dr = -1;
    for (var i = 0; i < worms.length; i++) { var w = worms[i]; if (w.dead) continue;
      var dist = 0;
      if (dr === 0 && w.row === player.row) dist = dc > 0 ? w.col - player.col : player.col - w.col;
      else if (dc === 0 && w.col === player.col) dist = dr > 0 ? w.row - player.row : player.row - w.row;
      if (dist > 0 && dist <= PUMP_RANGE) { w.pumps++; w.lastPump = Date.now();
        if (w.pumps >= POPS_NEEDED) { w.dead = true; score += 50; spawnParticles(w.col * CS + CS / 2, w.row * CS + CS / 2, '#44cc44', 12); } return;
      }
    }
  }

  function addCrumble(c, r) { for (var i = 0; i < 4; i++) sparkles.push({ x: c * CS + rand(2, CS - 2), y: r * CS + rand(2, CS - 2), life: 12, type: 'crumble' }); }

  function draw() {
    var t = Date.now() * 0.001;

    /* Sky - Mars atmosphere */
    var skyGrad = ctx.createLinearGradient(0, 0, 0, SURFACE * CS);
    skyGrad.addColorStop(0, '#0a0208');
    skyGrad.addColorStop(0.6, '#1a0810');
    skyGrad.addColorStop(1, '#3a1510');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, SURFACE * CS);

    /* Stars in sky */
    for (var si = 0; si < 20; si++) {
      var sx = (si * 97 + 13) % W, sy = (si * 31 + 7) % (SURFACE * CS);
      var sb = 0.3 + 0.5 * Math.sin(t * 2 + si);
      ctx.fillStyle = 'rgba(255,220,200,' + sb + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
    }

    /* Surface line */
    ctx.fillStyle = '#5a2a1a';
    ctx.fillRect(0, SURFACE * CS - 2, W, 4);

    /* Soil layers */
    for (var r = SURFACE; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = c * CS, y = r * CS;
      if (grid[r][c] === 1) {
        var depth = (r - SURFACE) / (ROWS - SURFACE);
        /* Soil gradient */
        var rb = Math.floor(130 - depth * 70), gb = Math.floor(65 - depth * 40), bb = Math.floor(30 - depth * 20);
        ctx.fillStyle = 'rgb(' + rb + ',' + gb + ',' + bb + ')';
        ctx.fillRect(x, y, CS, CS);
        /* Texture */
        ctx.fillStyle = 'rgba(255,200,150,0.06)';
        ctx.fillRect(x + 1, y + 1, CS - 2, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, y + CS - 1, CS, 1);
        /* Random pebbles */
        if ((r * 13 + c * 7) % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath(); ctx.arc(x + CS * 0.3, y + CS * 0.6, 2, 0, Math.PI * 2); ctx.fill();
        }
        if ((r * 11 + c * 23) % 7 === 0) {
          ctx.fillStyle = 'rgba(255,200,150,0.08)';
          ctx.beginPath(); ctx.arc(x + CS * 0.7, y + CS * 0.4, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (grid[r][c] === 0) {
        /* Dug tunnel */
        ctx.fillStyle = '#080406';
        ctx.fillRect(x, y, CS, CS);
        /* Tunnel edges */
        var hasWallLeft = c > 0 && grid[r][c - 1] === 1;
        var hasWallRight = c < COLS - 1 && grid[r][c + 1] === 1;
        var hasWallTop = r > 0 && grid[r - 1][c] === 1;
        var hasWallBot = r < ROWS - 1 && grid[r + 1][c] === 1;
        if (hasWallLeft) { ctx.fillStyle = 'rgba(100,50,25,0.3)'; ctx.fillRect(x, y, 2, CS); }
        if (hasWallRight) { ctx.fillStyle = 'rgba(100,50,25,0.3)'; ctx.fillRect(x + CS - 2, y, 2, CS); }
        if (hasWallTop) { ctx.fillStyle = 'rgba(100,50,25,0.3)'; ctx.fillRect(x, y, CS, 2); }
        if (hasWallBot) { ctx.fillStyle = 'rgba(100,50,25,0.3)'; ctx.fillRect(x, y + CS - 2, CS, 2); }
      } else if (grid[r][c] === 2) {
        /* Rock */
        var rkGrad = ctx.createRadialGradient(x + CS * 0.4, y + CS * 0.3, 0, x + CS / 2, y + CS / 2, CS * 0.7);
        rkGrad.addColorStop(0, '#aaa');
        rkGrad.addColorStop(0.6, '#777');
        rkGrad.addColorStop(1, '#444');
        ctx.fillStyle = rkGrad;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + CS * 0.3);
        ctx.lineTo(x + CS * 0.3, y + 2);
        ctx.lineTo(x + CS * 0.7, y + 1);
        ctx.lineTo(x + CS - 2, y + CS * 0.3);
        ctx.lineTo(x + CS - 1, y + CS * 0.7);
        ctx.lineTo(x + CS * 0.6, y + CS - 2);
        ctx.lineTo(x + CS * 0.2, y + CS - 1);
        ctx.lineTo(x + 1, y + CS * 0.6);
        ctx.closePath();
        ctx.fill();
        /* Rock crack */
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x + CS * 0.4, y + CS * 0.3); ctx.lineTo(x + CS * 0.5, y + CS * 0.6); ctx.stroke();
      }
    }

    /* Minerals */
    for (var i = 0; i < minerals.length; i++) { var m = minerals[i]; if (m.collected) continue;
      var cx = m.col * CS + CS / 2, cy = m.row * CS + CS / 2;
      var mcolor = m.type === 'common' ? '#FFD700' : m.type === 'rare' ? '#4488ff' : '#bb44ff';
      /* Glow */
      var mglow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      mglow.addColorStop(0, mcolor.replace('#', 'rgba(') ? 'rgba(' + parseInt(mcolor.slice(1, 3), 16) + ',' + parseInt(mcolor.slice(3, 5), 16) + ',' + parseInt(mcolor.slice(5, 7), 16) + ',0.3)' : 'rgba(255,215,0,0.3)');
      mglow.addColorStop(1, 'transparent');
      ctx.fillStyle = mglow;
      ctx.fillRect(cx - 10, cy - 10, 20, 20);
      /* Crystal shape */
      ctx.fillStyle = mcolor;
      ctx.shadowColor = mcolor; ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 4, cy - 2);
      ctx.lineTo(cx + 3, cy + 4);
      ctx.lineTo(cx - 3, cy + 4);
      ctx.lineTo(cx - 4, cy - 2);
      ctx.closePath();
      ctx.fill();
      /* Highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(cx - 1, cy - 4); ctx.lineTo(cx + 2, cy - 1); ctx.lineTo(cx - 1, cy - 1); ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* Worms */
    for (var i = 0; i < worms.length; i++) { var w = worms[i]; if (w.dead) continue;
      var wx = w.col * CS + CS / 2, wy = w.row * CS + CS / 2;
      var inflate = 1 + w.pumps * 0.35;
      var bob = Math.sin(w.phase) * 1.5;

      /* Body segments */
      var segCount = 4;
      for (var s = segCount - 1; s >= 0; s--) {
        var off = (w.dir === 'r' ? -1 : 1) * s * 4 * inflate;
        var segSize = (s === 0 ? 5 : 4) * inflate;
        /* Segment gradient */
        var sgrd = ctx.createRadialGradient(wx + off - 1, wy + bob - 1, 0, wx + off, wy + bob, segSize);
        sgrd.addColorStop(0, w.pumps >= 2 ? '#ff8888' : '#66ee66');
        sgrd.addColorStop(0.6, w.pumps >= 2 ? '#cc4444' : '#33bb33');
        sgrd.addColorStop(1, w.pumps >= 2 ? '#882222' : '#117711');
        ctx.fillStyle = sgrd;
        ctx.beginPath(); ctx.arc(wx + off, wy + bob, segSize, 0, Math.PI * 2); ctx.fill();
      }

      /* Eyes */
      var eyeOff = w.dir === 'r' ? 3 : -3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(wx + eyeOff - 2, wy + bob - 2, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(wx + eyeOff + 2, wy + bob - 2, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = w.pumps > 0 ? '#ff0000' : '#000';
      ctx.beginPath(); ctx.arc(wx + eyeOff - 2, wy + bob - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(wx + eyeOff + 2, wy + bob - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();

      /* Pump indicator */
      if (w.pumps > 0) {
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(wx, wy + bob, 6 * inflate + 2, 0, Math.PI * 2 * (w.pumps / POPS_NEEDED)); ctx.stroke();
      }
    }

    /* Player (astronaut) */
    var px = player.col * CS + CS / 2, py = player.row * CS + CS / 2;

    /* Helmet glow */
    var pglow = ctx.createRadialGradient(px, py, 0, px, py, 14);
    pglow.addColorStop(0, 'rgba(200,220,255,0.1)');
    pglow.addColorStop(1, 'transparent');
    ctx.fillStyle = pglow;
    ctx.fillRect(px - 14, py - 14, 28, 28);

    /* Suit body */
    var suitGrad = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 9);
    suitGrad.addColorStop(0, '#f0f0f0');
    suitGrad.addColorStop(0.5, '#d0d0d8');
    suitGrad.addColorStop(1, '#909098');
    ctx.fillStyle = suitGrad;
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();

    /* Backpack */
    var bpx = player.dir === 'r' ? -5 : player.dir === 'l' ? 5 : 0;
    var bpy = player.dir === 'u' ? 5 : player.dir === 'd' ? -5 : 0;
    ctx.fillStyle = '#888';
    ctx.fillRect(px + bpx - 3, py + bpy - 3, 6, 8);

    /* Visor */
    var vdx = player.dir === 'r' ? 3 : player.dir === 'l' ? -3 : 0;
    var vdy = player.dir === 'd' ? 3 : player.dir === 'u' ? -3 : 0;
    var visorGrad = ctx.createRadialGradient(px + vdx - 1, py + vdy - 1, 0, px + vdx, py + vdy, 4);
    visorGrad.addColorStop(0, '#88ccff');
    visorGrad.addColorStop(1, '#2266aa');
    ctx.fillStyle = visorGrad;
    ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(px + vdx, py + vdy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    /* Visor reflection */
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(px + vdx - 1, py + vdy - 1, 1.5, 0, Math.PI * 2); ctx.fill();

    /* Sparkles */
    for (var i = 0; i < sparkles.length; i++) { var sp = sparkles[i]; var a = sp.life / 12;
      if (sp.type === 'crumble') {
        ctx.fillStyle = 'rgba(160,100,40,' + a + ')';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* Particles */
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    /* HUD */
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = 'rgba(200,100,50,0.15)';
    ctx.fillRect(0, 24, W, 2);

    var elapsed = Math.min(TIME_LIMIT, (Date.now() - startTime) / 1000);
    ctx.font = 'bold 12px monospace'; ctx.textBaseline = 'top';

    ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 3;
    ctx.fillText('SCORE ' + score, 6, 6);
    ctx.shadowBlur = 0;

    var remain = Math.ceil(TIME_LIMIT - elapsed);
    ctx.fillStyle = remain <= 10 ? '#ff4444' : '#fff'; ctx.textAlign = 'center';
    if (remain <= 10) { ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 4; }
    ctx.fillText(remain + 's', W / 2, 6);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'right';
    for (var li = 0; li < lives; li++) {
      var lx = W - 44 - li * 16, ly = 12;
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(lx, ly + 1.5);
      ctx.bezierCurveTo(lx, ly - 0.5, lx - 4, ly - 3, lx - 4, ly);
      ctx.bezierCurveTo(lx - 4, ly + 2, lx, ly + 5, lx, ly + 6);
      ctx.bezierCurveTo(lx, ly + 5, lx + 4, ly + 2, lx + 4, ly);
      ctx.bezierCurveTo(lx + 4, ly - 3, lx, ly - 0.5, lx, ly + 1.5);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (gameOver) drawGameOver();
  }

  function endGame() { gameOver = true; running = false; cancelAnimationFrame(rafId); draw(); onGameEnd(score); }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#ff4400';
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;
  }

  function continueGame() {
    continueCount++; lives = MAX_LIVES; gameOver = false; running = true;
    respawn(); rafId = requestAnimationFrame(loop);
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

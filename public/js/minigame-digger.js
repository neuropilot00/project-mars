/**
 * Mars Digger — Canvas-based Dig Dug minigame (화성 채굴)
 * Self-contained, no external dependencies.
 */
window.MarsDigger = (function () {
  const W = 360, H = 640, COLS = 15, ROWS = 25, CS = 24;
  const SURFACE = 2, MAX_LIVES = 3, TIME_LIMIT = 90;
  const PUMP_RANGE = 2, POPS_NEEDED = 3, DEFLATE_MS = 1000;
  let canvas, ctx, onGameEnd, rafId;
  let grid, player, minerals, worms, rocks, score, lives;
  let startTime, running, gameOver, keys = {};
  let touchStart, moveDir, pumpPressed;
  let sparkles;
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

  function buildLevel() {
    grid = []; for (var r = 0; r < ROWS; r++) { grid[r] = []; for (var c = 0; c < COLS; c++) grid[r][c] = r < SURFACE ? 0 : 1; }
    player = { col: 7, row: 0, dir: 'd', pumping: false, pumpTarget: null };
    minerals = []; worms = []; rocks = []; sparkles = []; score = 0; lives = MAX_LIVES; gameOver = false;
    // pre-dig worm tunnels
    var tunnels = [[3,2,3,12],[6,5,6,10],[10,8,10,14],[12,3,12,9]];
    for (var i = 0; i < tunnels.length; i++) {
      var tr = tunnels[i][0], c1 = tunnels[i][1], c2 = tunnels[i][3], wr = tunnels[i][2] || tr;
      for (var c = c1; c <= c2; c++) if (grid[tr]) grid[tr][c] = 0;
      worms.push({ col: (c1 + c2) >> 1, row: tr, dir: Math.random() < 0.5 ? 'l' : 'r', pumps: 0, lastPump: 0, dead: false, moveT: 0,
        tMin: c1, tMax: c2, tRow: tr, digTimer: 0 });
    }
    // minerals
    placeItems(20, 'common', SURFACE + 1, ROWS - 1);
    placeItems(8, 'rare', SURFACE + 3, ROWS - 1);
    placeItems(3, 'crystal', 15, ROWS - 1);
    // rocks
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
    // player movement
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
    // collect minerals
    for (var i = 0; i < minerals.length; i++) { var m = minerals[i];
      if (!m.collected && m.col === player.col && m.row === player.row) { m.collected = true; score += m.pts; addSparkle(m.col, m.row, m.type); }
    }
    // pump
    if (pumpPressed || keys[' ']) { tryPump(); pumpPressed = false; }
    // deflate worms
    var now = Date.now();
    for (var i = 0; i < worms.length; i++) { var w = worms[i];
      if (w.dead) continue;
      if (w.pumps > 0 && now - w.lastPump > DEFLATE_MS) w.pumps = Math.max(0, w.pumps - 1);
    }
    // worm AI
    for (var i = 0; i < worms.length; i++) { var w = worms[i];
      if (w.dead) continue; w.moveT++;
      if (w.moveT < 12) continue; w.moveT = 0;
      // occasional dig toward player
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
      // follow tunnel
      var nd = w.dir === 'r' ? 1 : -1, nnc = w.col + nd;
      if (nnc < 0 || nnc >= COLS || grid[w.row][nnc] === 1 || grid[w.row][nnc] === 2) w.dir = w.dir === 'r' ? 'l' : 'r';
      else { w.col = nnc; }
      wormCollision(w);
    }
    // rock falling
    for (var i = 0; i < rocks.length; i++) { var rk = rocks[i];
      if (rk.row + 1 < ROWS && grid[rk.row + 1][rk.col] === 0) {
        rk.falling = true; grid[rk.row][rk.col] = 0; rk.row++; grid[rk.row][rk.col] = 2;
        // crush worm?
        for (var j = 0; j < worms.length; j++) { if (!worms[j].dead && worms[j].col === rk.col && worms[j].row === rk.row) { worms[j].dead = true; score += 100; } }
        // crush player?
        if (player.col === rk.col && player.row === rk.row) { lives--; respawn(); }
      } else { rk.falling = false; }
    }
    // sparkle decay
    for (var i = sparkles.length - 1; i >= 0; i--) { sparkles[i].life--; if (sparkles[i].life <= 0) sparkles.splice(i, 1); }
  }

  function wormCollision(w) { if (w.col === player.col && w.row === player.row) { lives--; respawn(); } }
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
        if (w.pumps >= POPS_NEEDED) { w.dead = true; score += 50; addSparkle(w.col, w.row, 'pop'); } return;
      }
    }
  }

  function addCrumble(c, r) { for (var i = 0; i < 4; i++) sparkles.push({ x: c * CS + rand(2, CS - 2), y: r * CS + rand(2, CS - 2), life: 8, type: 'crumble' }); }
  function addSparkle(c, r, type) { for (var i = 0; i < 6; i++) sparkles.push({ x: c * CS + CS / 2 + rand(-8, 8), y: r * CS + CS / 2 + rand(-8, 8), life: 15, type: type }); }

  function draw() {
    // sky
    var grd = ctx.createLinearGradient(0, 0, 0, SURFACE * CS);
    grd.addColorStop(0, '#1a0505'); grd.addColorStop(1, '#4a1a0a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, SURFACE * CS);
    // soil
    for (var r = SURFACE; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = c * CS, y = r * CS;
      if (grid[r][c] === 1) {
        var depth = (r - SURFACE) / (ROWS - SURFACE);
        var rb = Math.floor(120 - depth * 70), gb = Math.floor(60 - depth * 40), bb = Math.floor(20 - depth * 15);
        ctx.fillStyle = 'rgb(' + rb + ',' + gb + ',' + bb + ')'; ctx.fillRect(x, y, CS, CS);
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y, CS, 1); ctx.fillRect(x, y, 1, CS);
      } else if (grid[r][c] === 0) { ctx.fillStyle = '#0a0505'; ctx.fillRect(x, y, CS, CS); }
      else if (grid[r][c] === 2) { ctx.fillStyle = '#888'; ctx.fillRect(x, y, CS, CS); ctx.fillStyle = '#666'; ctx.fillRect(x + 2, y + 2, CS - 4, CS - 4); }
    }
    // minerals
    for (var i = 0; i < minerals.length; i++) { var m = minerals[i]; if (m.collected) continue;
      var cx = m.col * CS + CS / 2, cy = m.row * CS + CS / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = m.type === 'common' ? '#ffdd00' : m.type === 'rare' ? '#4488ff' : '#bb44ff';
      ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.stroke();
    }
    // worms
    for (var i = 0; i < worms.length; i++) { var w = worms[i]; if (w.dead) continue;
      var wx = w.col * CS + CS / 2, wy = w.row * CS + CS / 2, sz = 4 + w.pumps * 3;
      ctx.fillStyle = '#44cc44';
      for (var s = 0; s < 3; s++) { var off = (w.dir === 'r' ? -1 : 1) * s * 5;
        ctx.beginPath(); ctx.arc(wx + off, wy, sz, 0, Math.PI * 2); ctx.fill(); }
      // eyes
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(wx + (w.dir === 'r' ? 3 : -3), wy - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(wx + (w.dir === 'r' ? 4 : -4), wy - 2, 1, 0, Math.PI * 2); ctx.fill();
    }
    // player
    var px = player.col * CS + CS / 2, py = player.row * CS + CS / 2;
    ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
    // visor
    var vdx = player.dir === 'r' ? 3 : player.dir === 'l' ? -3 : 0;
    var vdy = player.dir === 'd' ? 3 : player.dir === 'u' ? -3 : 0;
    ctx.fillStyle = '#4488ff'; ctx.beginPath(); ctx.arc(px + vdx, py + vdy, 3, 0, Math.PI * 2); ctx.fill();
    // sparkles
    for (var i = 0; i < sparkles.length; i++) { var sp = sparkles[i]; var a = sp.life / 15;
      if (sp.type === 'crumble') { ctx.fillStyle = 'rgba(160,100,40,' + a + ')'; ctx.fillRect(sp.x, sp.y, 3, 3); }
      else { ctx.fillStyle = sp.type === 'pop' ? 'rgba(68,204,68,' + a + ')' : 'rgba(255,255,255,' + a + ')';
        ctx.beginPath(); ctx.arc(sp.x, sp.y + (15 - sp.life) * (sp.type === 'pop' ? -1 : 0.5), 2, 0, Math.PI * 2); ctx.fill(); }
    }
    // HUD
    var elapsed = Math.min(TIME_LIMIT, (Date.now() - startTime) / 1000);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 22);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('SCORE:' + score, 4, 4);
    ctx.fillStyle = '#ff6644'; ctx.textAlign = 'center'; ctx.fillText('TIME:' + Math.ceil(TIME_LIMIT - elapsed), W / 2, 4);
    ctx.fillStyle = '#ff4444'; ctx.textAlign = 'right';
    var hearts = ''; for (var i = 0; i < lives; i++) hearts += '\u2665'; ctx.fillText(hearts, W - 4, 4);
    if (gameOver) drawGameOver();
  }

  function endGame() { gameOver = true; running = false; cancelAnimationFrame(rafId); draw(); onGameEnd(score); }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace'; ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
  }

  function continueGame() {
    continueCount++;
    lives = MAX_LIVES;
    gameOver = false; running = true;
    respawn();
    rafId = requestAnimationFrame(loop);
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

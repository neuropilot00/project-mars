/**
 * Mars Runner — Canvas-based Pacman-style minigame
 * Astronaut explores Mars tunnels, collects minerals, avoids aliens.
 * Self-contained, no external dependencies.
 */
window.MarsRunner = (function () {
  const W = 360, H = 640, COLS = 15, ROWS = 20, CELL = 24;
  const OX = (W - COLS * CELL) / 2, OY = (H - ROWS * CELL) / 2;
  const DOT_R = 3, PWR_R = 5, PLR_R = 9, ENM_R = 9;
  const MOVE_SPD = 3, ENM_SPD_BASE = 1.8, ENM_SPD_INC = 0.4;
  const PWR_TIME = 5000, TIME_LIMIT = 90, MAX_LIVES = 3;
  const DOT_SCORE = 10, EAT_SCORE = 50;

  let canvas, ctx, onGameEnd, rafId;
  let grid, player, enemies, dots, powers, score, lives, startTime;
  let running, gameOver, pwrEnd, lastTime, keys = {};
  let touchStart = null;
  let continueCount = 0;

  function init(canvasId, cb) {
    canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    ctx = canvas.getContext('2d');
    onGameEnd = cb || function () {};
    canvas.width = W; canvas.height = H;
    window.addEventListener('keydown', function (e) { keys[e.key] = true; });
    window.addEventListener('keyup', function (e) { keys[e.key] = false; });
    canvas.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; touchStart = { x: t.clientX, y: t.clientY }; e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      if (!touchStart) return;
      var t = e.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 20) {
        if (Math.abs(dx) > Math.abs(dy)) player.next = dx > 0 ? [1, 0] : [-1, 0];
        else player.next = dy > 0 ? [0, 1] : [0, -1];
      }
      touchStart = null; e.preventDefault();
    }, { passive: false });
  }

  function genMaze() {
    grid = []; for (var r = 0; r < ROWS; r++) { grid[r] = []; for (var c = 0; c < COLS; c++) grid[r][c] = 1; }
    var stack = [], vis = {};
    function k(r, c) { return r + ',' + c; }
    grid[0][0] = 0; vis[k(0, 0)] = true; stack.push([0, 0]);
    while (stack.length) {
      var cur = stack[stack.length - 1], cr = cur[0], cc = cur[1];
      var dirs = [[0,2],[0,-2],[2,0],[-2,0]].sort(function () { return Math.random() - 0.5; });
      var found = false;
      for (var i = 0; i < dirs.length; i++) {
        var nr = cr + dirs[i][0], nc = cc + dirs[i][1];
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !vis[k(nr, nc)]) {
          grid[cr + dirs[i][0] / 2][cc + dirs[i][1] / 2] = 0;
          grid[nr][nc] = 0; vis[k(nr, nc)] = true; stack.push([nr, nc]); found = true; break;
        }
      }
      if (!found) stack.pop();
    }
    for (var i = 0; i < ROWS * COLS / 3; i++) {
      var r = 1 + Math.floor(Math.random() * (ROWS - 2)), c = 1 + Math.floor(Math.random() * (COLS - 2));
      grid[r][c] = 0;
    }
    grid[0][0] = 0; grid[Math.floor(ROWS / 2)][Math.floor(COLS / 2)] = 0;
  }

  function placeDots() {
    dots = []; powers = []; var cells = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++)
      if (grid[r][c] === 0 && !(r === 0 && c === 0)) cells.push([r, c]);
    cells.sort(function () { return Math.random() - 0.5; });
    var pwrCount = Math.min(4, cells.length);
    for (var i = 0; i < pwrCount; i++) powers.push({ r: cells[i][0], c: cells[i][1] });
    var dotCount = Math.min(60, cells.length - pwrCount);
    for (var i = pwrCount; i < pwrCount + dotCount; i++) dots.push({ r: cells[i][0], c: cells[i][1] });
  }

  function start() {
    genMaze(); placeDots();
    player = { r: 0, c: 0, px: OX + CELL / 2, py: OY + CELL / 2, dir: [0, 0], next: [0, 0] };
    var cr = Math.floor(ROWS / 2), cc = Math.floor(COLS / 2);
    enemies = [
      { r: cr, c: cc, px: 0, py: 0, dir: [0, 0] },
      { r: cr, c: Math.max(0, cc - 2), px: 0, py: 0, dir: [0, 0] },
      { r: cr, c: Math.min(COLS - 1, cc + 2), px: 0, py: 0, dir: [0, 0] }
    ];
    enemies.forEach(function (e) { e.px = OX + e.c * CELL + CELL / 2; e.py = OY + e.r * CELL + CELL / 2; });
    score = 0; lives = MAX_LIVES; pwrEnd = 0; gameOver = false; running = true; continueCount = 0;
    startTime = Date.now(); lastTime = startTime;
    if (keys.ArrowUp) keys.ArrowUp = false; // reset
    rafId = requestAnimationFrame(loop);
  }

  function stop() { running = false; cancelAnimationFrame(rafId); }
  function getScore() { return score; }

  function canMove(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 0; }

  function moveEntity(e, dir, spd, dt) {
    var tx = OX + e.c * CELL + CELL / 2, ty = OY + e.r * CELL + CELL / 2;
    var dx = tx - e.px, dy = ty - e.py;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      var step = spd * dt * 60;
      e.px += Math.sign(dx) * Math.min(Math.abs(dx), step);
      e.py += Math.sign(dy) * Math.min(Math.abs(dy), step);
      return false; // still moving
    }
    e.px = tx; e.py = ty;
    // Try next direction
    var nr = e.r + dir[1], nc = e.c + dir[0];
    if (canMove(nr, nc)) { e.r = nr; e.c = nc; return true; }
    return true; // at cell center, can't move
  }

  function updatePlayer(dt) {
    if (keys.ArrowLeft || keys.a || keys.A) player.next = [-1, 0];
    if (keys.ArrowRight || keys.d || keys.D) player.next = [1, 0];
    if (keys.ArrowUp || keys.w || keys.W) player.next = [0, -1];
    if (keys.ArrowDown || keys.s || keys.S) player.next = [0, 1];
    var tx = OX + player.c * CELL + CELL / 2, ty = OY + player.r * CELL + CELL / 2;
    if (Math.abs(player.px - tx) < 2 && Math.abs(player.py - ty) < 2) {
      player.px = tx; player.py = ty;
      var nr = player.r + player.next[1], nc = player.c + player.next[0];
      if (canMove(nr, nc)) { player.dir = player.next.slice(); player.r = nr; player.c = nc; }
      else {
        nr = player.r + player.dir[1]; nc = player.c + player.dir[0];
        if (canMove(nr, nc)) { player.r = nr; player.c = nc; }
      }
    } else {
      var step = MOVE_SPD * dt * 60;
      player.px += Math.sign(tx - player.px) * Math.min(Math.abs(tx - player.px), step);
      player.py += Math.sign(ty - player.py) * Math.min(Math.abs(ty - player.py), step);
    }
    for (var i = dots.length - 1; i >= 0; i--)
      if (dots[i].r === player.r && dots[i].c === player.c) { score += DOT_SCORE; dots.splice(i, 1); }
    for (var i = powers.length - 1; i >= 0; i--)
      if (powers[i].r === player.r && powers[i].c === player.c) { pwrEnd = Date.now() + PWR_TIME; powers.splice(i, 1); }
  }

  function updateEnemies(dt) {
    var elapsed = (Date.now() - startTime) / 1000;
    var spd = ENM_SPD_BASE + Math.floor(elapsed / 30) * ENM_SPD_INC;
    var powered = Date.now() < pwrEnd;
    enemies.forEach(function (e) {
      var tx = OX + e.c * CELL + CELL / 2, ty = OY + e.r * CELL + CELL / 2;
      if (Math.abs(e.px - tx) > 2 || Math.abs(e.py - ty) > 2) {
        var step = spd * dt * 60;
        e.px += Math.sign(tx - e.px) * Math.min(Math.abs(tx - e.px), step);
        e.py += Math.sign(ty - e.py) * Math.min(Math.abs(ty - e.py), step);
      } else {
        e.px = tx; e.py = ty;
        // Pick direction: toward player (or away if powered) with randomness
        var dirs = [[0,1],[0,-1],[1,0],[-1,0]].filter(function (d) { return canMove(e.r + d[1], e.c + d[0]); });
        if (dirs.length === 0) return;
        dirs.sort(function (a, b) {
          var da = Math.abs(e.r + a[1] - player.r) + Math.abs(e.c + a[0] - player.c);
          var db = Math.abs(e.r + b[1] - player.r) + Math.abs(e.c + b[0] - player.c);
          return powered ? db - da : da - db;
        });
        var pick = Math.random() < 0.6 ? dirs[0] : dirs[Math.floor(Math.random() * dirs.length)];
        e.r += pick[1]; e.c += pick[0]; e.dir = pick;
      }
      // Collision with player
      var dist = Math.abs(e.px - player.px) + Math.abs(e.py - player.py);
      if (dist < CELL * 0.8) {
        if (powered) {
          score += EAT_SCORE;
          e.r = Math.floor(ROWS / 2); e.c = Math.floor(COLS / 2);
          e.px = OX + e.c * CELL + CELL / 2; e.py = OY + e.r * CELL + CELL / 2;
        } else {
          lives--;
          player.r = 0; player.c = 0; player.px = OX + CELL / 2; player.py = OY + CELL / 2;
          player.dir = [0, 0]; player.next = [0, 0];
          if (lives <= 0) endGame();
        }
      }
    });
  }

  function endGame() {
    gameOver = true; running = false; cancelAnimationFrame(rafId);
    drawGameOver();
    onGameEnd(score);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lives <= 0 ? 'GAME OVER' : 'COMPLETE!', W / 2, H / 2 - 30);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
  }

  function continueGame() {
    continueCount++;
    lives = MAX_LIVES;
    gameOver = false; running = true;
    player.r = 0; player.c = 0; player.px = OX + CELL / 2; player.py = OY + CELL / 2;
    player.dir = [0, 0]; player.next = [0, 0];
    lastTime = Date.now();
    rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    if (!running) return;
    var now = Date.now(), dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    var elapsed = (now - startTime) / 1000;
    if (elapsed >= TIME_LIMIT || (dots.length === 0 && powers.length === 0)) { endGame(); return; }
    updatePlayer(dt); updateEnemies(dt); draw(elapsed);
    rafId = requestAnimationFrame(loop);
  }

  function draw(elapsed) {
    var powered = Date.now() < pwrEnd;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // Maze
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = OX + c * CELL, y = OY + r * CELL;
      ctx.fillStyle = grid[r][c] === 1 ? '#6B3A2A' : '#1a1a1a';
      ctx.fillRect(x, y, CELL, CELL);
      if (grid[r][c] === 1) { ctx.fillStyle = '#8B4A3A'; ctx.fillRect(x + 2, y + 2, CELL - 4, 2); }
    }
    // Dots
    ctx.fillStyle = '#FFD700';
    dots.forEach(function (d) {
      ctx.beginPath(); ctx.arc(OX + d.c * CELL + CELL / 2, OY + d.r * CELL + CELL / 2, DOT_R, 0, Math.PI * 2); ctx.fill();
    });
    // Power dots (pulsing)
    var pulse = 1 + 0.3 * Math.sin(Date.now() / 150);
    ctx.fillStyle = '#4FC3F7';
    powers.forEach(function (p) {
      ctx.beginPath(); ctx.arc(OX + p.c * CELL + CELL / 2, OY + p.r * CELL + CELL / 2, PWR_R * pulse, 0, Math.PI * 2); ctx.fill();
    });
    // Enemies
    enemies.forEach(function (e) {
      ctx.fillStyle = powered ? '#4FC3F7' : '#E53935';
      ctx.beginPath(); ctx.arc(e.px, e.py, ENM_R, 0, Math.PI * 2); ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.px - 3, e.py - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.px + 3, e.py - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(e.px - 2, e.py - 2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e.px + 4, e.py - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    });
    // Player (astronaut)
    ctx.fillStyle = '#FF9800';
    ctx.beginPath(); ctx.arc(player.px, player.py, PLR_R, 0, Math.PI * 2); ctx.fill();
    // Helmet visor
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(player.px, player.py - 1, PLR_R - 2, -Math.PI * 0.7, Math.PI * 0.1); ctx.fill();
    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, 8, 18);
    ctx.textAlign = 'center';
    var remain = Math.max(0, Math.ceil(TIME_LIMIT - elapsed));
    ctx.fillStyle = remain <= 10 ? '#E53935' : '#fff';
    ctx.fillText(remain + 's', W / 2, 18);
    ctx.textAlign = 'right'; ctx.fillStyle = '#FF9800';
    for (var i = 0; i < lives; i++) {
      ctx.beginPath(); ctx.arc(W - 20 - i * 22, 14, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (gameOver) { drawGameOver(); }
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

/**
 * Mars Runner — Canvas-based Pacman-style minigame
 * Enhanced graphics with glow effects and detailed sprites.
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
  let particles = [];

  function init(canvasId, cb) {
    canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    ctx = canvas.getContext('2d'); onGameEnd = cb || function () {};
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

  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * 2 + 0.5;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.04, size: Math.random() * 2 + 1, color: color });
    }
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
    genMaze(); placeDots(); particles = [];
    player = { r: 0, c: 0, px: OX + CELL / 2, py: OY + CELL / 2, dir: [0, 0], next: [0, 0], mouthAngle: 0 };
    var cr = Math.floor(ROWS / 2), cc = Math.floor(COLS / 2);
    enemies = [
      { r: cr, c: cc, px: 0, py: 0, dir: [0, 0], phase: 0 },
      { r: cr, c: Math.max(0, cc - 2), px: 0, py: 0, dir: [0, 0], phase: 2 },
      { r: cr, c: Math.min(COLS - 1, cc + 2), px: 0, py: 0, dir: [0, 0], phase: 4 }
    ];
    enemies.forEach(function (e) { e.px = OX + e.c * CELL + CELL / 2; e.py = OY + e.r * CELL + CELL / 2; });
    score = 0; lives = MAX_LIVES; pwrEnd = 0; gameOver = false; running = true; continueCount = 0;
    startTime = Date.now(); lastTime = startTime;
    rafId = requestAnimationFrame(loop);
  }

  function stop() { running = false; cancelAnimationFrame(rafId); }
  function getScore() { return score; }
  function canMove(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === 0; }

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
    player.mouthAngle = (player.mouthAngle + 0.15) % (Math.PI * 2);
    for (var i = dots.length - 1; i >= 0; i--)
      if (dots[i].r === player.r && dots[i].c === player.c) { score += DOT_SCORE; spawnParticles(player.px, player.py, '#FFD700', 4); dots.splice(i, 1); }
    for (var i = powers.length - 1; i >= 0; i--)
      if (powers[i].r === player.r && powers[i].c === player.c) { pwrEnd = Date.now() + PWR_TIME; spawnParticles(player.px, player.py, '#4FC3F7', 8); powers.splice(i, 1); }
  }

  function updateEnemies(dt) {
    var elapsed = (Date.now() - startTime) / 1000;
    var spd = ENM_SPD_BASE + Math.floor(elapsed / 30) * ENM_SPD_INC;
    var powered = Date.now() < pwrEnd;
    enemies.forEach(function (e) {
      e.phase += 0.05;
      var tx = OX + e.c * CELL + CELL / 2, ty = OY + e.r * CELL + CELL / 2;
      if (Math.abs(e.px - tx) > 2 || Math.abs(e.py - ty) > 2) {
        var step = spd * dt * 60;
        e.px += Math.sign(tx - e.px) * Math.min(Math.abs(tx - e.px), step);
        e.py += Math.sign(ty - e.py) * Math.min(Math.abs(ty - e.py), step);
      } else {
        e.px = tx; e.py = ty;
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
      var dist = Math.abs(e.px - player.px) + Math.abs(e.py - player.py);
      if (dist < CELL * 0.8) {
        if (powered) {
          score += EAT_SCORE; spawnParticles(e.px, e.py, '#4FC3F7', 12);
          e.r = Math.floor(ROWS / 2); e.c = Math.floor(COLS / 2);
          e.px = OX + e.c * CELL + CELL / 2; e.py = OY + e.r * CELL + CELL / 2;
        } else {
          lives--; spawnParticles(player.px, player.py, '#ff4444', 10);
          player.r = 0; player.c = 0; player.px = OX + CELL / 2; player.py = OY + CELL / 2;
          player.dir = [0, 0]; player.next = [0, 0];
          if (lives <= 0) endGame();
        }
      }
    });
  }

  function endGame() { gameOver = true; running = false; cancelAnimationFrame(rafId); drawGameOver(); onGameEnd(score); }

  function continueGame() {
    continueCount++; lives = MAX_LIVES; gameOver = false; running = true;
    player.r = 0; player.c = 0; player.px = OX + CELL / 2; player.py = OY + CELL / 2;
    player.dir = [0, 0]; player.next = [0, 0]; lastTime = Date.now();
    rafId = requestAnimationFrame(loop);
  }

  function loop(ts) {
    if (!running) return;
    var now = Date.now(), dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    var elapsed = (now - startTime) / 1000;
    if (elapsed >= TIME_LIMIT || (dots.length === 0 && powers.length === 0)) { endGame(); return; }
    updatePlayer(dt); updateEnemies(dt);
    // Update particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p]; pt.x += pt.vx; pt.y += pt.vy; pt.life -= pt.decay;
      if (pt.life <= 0) particles.splice(p, 1);
    }
    draw(elapsed, now);
    rafId = requestAnimationFrame(loop);
  }

  function draw(elapsed, now) {
    var powered = Date.now() < pwrEnd;
    var t = (now || Date.now()) * 0.001;

    /* Background */
    var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#06000f');
    bgGrad.addColorStop(1, '#0f0008');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* Maze */
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = OX + c * CELL, y = OY + r * CELL;
      if (grid[r][c] === 1) {
        /* Mars rock walls */
        var depth = r / ROWS;
        var wallGrad = ctx.createLinearGradient(x, y, x, y + CELL);
        wallGrad.addColorStop(0, 'hsl(15,' + (40 + depth * 20) + '%,' + (22 - depth * 8) + '%)');
        wallGrad.addColorStop(1, 'hsl(12,' + (35 + depth * 15) + '%,' + (18 - depth * 6) + '%)');
        ctx.fillStyle = wallGrad;
        ctx.fillRect(x, y, CELL, CELL);
        /* Rock texture highlights */
        ctx.fillStyle = 'rgba(255,200,150,0.08)';
        ctx.fillRect(x + 1, y + 1, CELL - 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, y + CELL - 1, CELL, 1);
        ctx.fillRect(x + CELL - 1, y, 1, CELL);
        /* Occasional crack */
        if ((r * 17 + c * 31) % 7 === 0) {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(x + CELL * 0.3, y + CELL * 0.2);
          ctx.lineTo(x + CELL * 0.6, y + CELL * 0.5);
          ctx.lineTo(x + CELL * 0.4, y + CELL * 0.8);
          ctx.stroke();
        }
      } else {
        /* Tunnel floor */
        ctx.fillStyle = 'rgba(10,5,15,0.9)';
        ctx.fillRect(x, y, CELL, CELL);
        /* Subtle floor detail */
        ctx.fillStyle = 'rgba(80,40,20,0.1)';
        if ((r + c) % 2 === 0) ctx.fillRect(x, y, CELL, CELL);
      }
    }

    /* Dots (minerals) */
    dots.forEach(function (d) {
      var dx = OX + d.c * CELL + CELL / 2, dy = OY + d.r * CELL + CELL / 2;
      var glow = ctx.createRadialGradient(dx, dy, 0, dx, dy, 8);
      glow.addColorStop(0, 'rgba(255,215,0,0.3)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(dx - 8, dy - 8, 16, 16);
      /* Crystal shape */
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(dx, dy - DOT_R);
      ctx.lineTo(dx + DOT_R, dy);
      ctx.lineTo(dx, dy + DOT_R);
      ctx.lineTo(dx - DOT_R, dy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* Power dots */
    var pulse = 0.8 + 0.4 * Math.sin(t * 4);
    powers.forEach(function (p) {
      var px = OX + p.c * CELL + CELL / 2, py = OY + p.r * CELL + CELL / 2;
      var pglow = ctx.createRadialGradient(px, py, 0, px, py, 14);
      pglow.addColorStop(0, 'rgba(79,195,247,' + (0.4 * pulse) + ')');
      pglow.addColorStop(1, 'transparent');
      ctx.fillStyle = pglow;
      ctx.fillRect(px - 14, py - 14, 28, 28);
      ctx.fillStyle = 'rgba(79,195,247,' + pulse + ')';
      ctx.shadowColor = '#4FC3F7'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px, py, PWR_R * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(px - 1, py - 1, PWR_R * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* Enemies (Mars aliens) */
    var enemyColors = ['#E53935', '#FF6F00', '#AD1457'];
    enemies.forEach(function (e, idx) {
      var bob = Math.sin(e.phase) * 1.5;
      var ex = e.px, ey = e.py + bob;
      var baseColor = powered ? '#2196F3' : enemyColors[idx % 3];

      /* Glow */
      var eglow = ctx.createRadialGradient(ex, ey, 0, ex, ey, ENM_R + 6);
      eglow.addColorStop(0, (powered ? 'rgba(33,150,243,' : 'rgba(229,57,53,') + '0.2)');
      eglow.addColorStop(1, 'transparent');
      ctx.fillStyle = eglow;
      ctx.fillRect(ex - ENM_R - 6, ey - ENM_R - 6, (ENM_R + 6) * 2, (ENM_R + 6) * 2);

      /* Ghost body */
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(ex, ey - 2, ENM_R, Math.PI, 0);
      ctx.lineTo(ex + ENM_R, ey + ENM_R - 2);
      /* Wavy bottom */
      for (var w = 0; w < 4; w++) {
        var wx = ex + ENM_R - w * (ENM_R * 2 / 4);
        var wy = ey + ENM_R - 2 + Math.sin(e.phase * 2 + w) * 2;
        ctx.lineTo(wx - ENM_R / 4, wy - 3);
        ctx.lineTo(wx - ENM_R / 2, wy);
      }
      ctx.closePath();
      ctx.fill();

      /* Highlight */
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(ex - 2, ey - 4, ENM_R * 0.6, Math.PI, 0);
      ctx.fill();

      if (powered) {
        /* Scared face */
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex - 3, ey - 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + 3, ey - 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex - 4, ey + 3); ctx.lineTo(ex - 2, ey + 1); ctx.lineTo(ex, ey + 3); ctx.lineTo(ex + 2, ey + 1); ctx.lineTo(ex + 4, ey + 3); ctx.stroke();
      } else {
        /* Normal eyes */
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex - 3.5, ey - 3, 3, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex + 3.5, ey - 3, 3, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        /* Pupils track player */
        var angle = Math.atan2(player.py - ey, player.px - ex);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(ex - 3.5 + Math.cos(angle) * 1.2, ey - 3 + Math.sin(angle) * 1.2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + 3.5 + Math.cos(angle) * 1.2, ey - 3 + Math.sin(angle) * 1.2, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    });

    /* Player (astronaut) */
    var mouth = Math.abs(Math.sin(player.mouthAngle)) * 0.5;
    var dirAngle = 0;
    if (player.dir[0] === 1) dirAngle = 0;
    else if (player.dir[0] === -1) dirAngle = Math.PI;
    else if (player.dir[1] === -1) dirAngle = -Math.PI / 2;
    else if (player.dir[1] === 1) dirAngle = Math.PI / 2;

    /* Astronaut glow */
    var pGlow = ctx.createRadialGradient(player.px, player.py, 0, player.px, player.py, PLR_R + 8);
    pGlow.addColorStop(0, 'rgba(255,152,0,0.25)');
    pGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = pGlow;
    ctx.fillRect(player.px - PLR_R - 8, player.py - PLR_R - 8, (PLR_R + 8) * 2, (PLR_R + 8) * 2);

    /* Suit body */
    var suitGrad = ctx.createRadialGradient(player.px - 2, player.py - 2, 0, player.px, player.py, PLR_R);
    suitGrad.addColorStop(0, '#FFB74D');
    suitGrad.addColorStop(0.7, '#FF9800');
    suitGrad.addColorStop(1, '#E65100');
    ctx.fillStyle = suitGrad;
    ctx.beginPath();
    ctx.arc(player.px, player.py, PLR_R, dirAngle + mouth, dirAngle + Math.PI * 2 - mouth);
    ctx.lineTo(player.px, player.py);
    ctx.closePath();
    ctx.fill();

    /* Helmet visor */
    ctx.fillStyle = 'rgba(100,200,255,0.5)';
    ctx.beginPath();
    ctx.arc(player.px, player.py, PLR_R - 2, dirAngle - 0.8, dirAngle + 0.8);
    ctx.lineTo(player.px, player.py);
    ctx.closePath();
    ctx.fill();
    /* Visor reflection */
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(player.px + Math.cos(dirAngle) * 2, player.py + Math.sin(dirAngle) * 2 - 1, 2, 0, Math.PI * 2);
    ctx.fill();

    /* Particles */
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* HUD */
    /* HUD background */
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, 32);
    ctx.fillStyle = 'rgba(255,152,0,0.1)';
    ctx.fillRect(0, 30, W, 2);

    ctx.font = 'bold 13px monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 3;
    ctx.fillText('SCORE ' + score, 10, 9);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'center';
    var remain = Math.max(0, Math.ceil(TIME_LIMIT - elapsed));
    ctx.fillStyle = remain <= 10 ? '#ff4444' : '#ffffff';
    if (remain <= 10) { ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 4; }
    ctx.fillText(remain + 's', W / 2, 9);
    ctx.shadowBlur = 0;

    /* Lives */
    ctx.textAlign = 'right';
    for (var li = 0; li < lives; li++) {
      var lx = W - 46 - li * 20, ly = 15;
      ctx.fillStyle = '#FF9800';
      ctx.shadowColor = '#FF9800'; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(100,200,255,0.5)';
      ctx.beginPath(); ctx.arc(lx + 1, ly - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* Power-up indicator */
    if (powered) {
      var pwrLeft = (pwrEnd - Date.now()) / PWR_TIME;
      ctx.fillStyle = 'rgba(33,150,243,' + (0.3 + 0.2 * Math.sin(t * 6)) + ')';
      ctx.fillRect(OX, OY - 6, COLS * CELL * pwrLeft, 3);
    }
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#ff4400';
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
    ctx.fillText(lives <= 0 ? 'GAME OVER' : 'COMPLETE!', W / 2, H / 2 - 30);
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

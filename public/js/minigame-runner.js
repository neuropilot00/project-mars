/**
 * Mars Runner — Canvas-based Pacman-style minigame
 * Enhanced graphics with glow effects and detailed sprites.
 */
window.MarsRunner = (function () {
  const W = 360, H = 640, COLS = 15, ROWS = 20, CELL = 24;
  const OX = (W - COLS * CELL) / 2, OY = (H - ROWS * CELL) / 2;
  const DOT_R = 3, PWR_R = 5, PLR_R = 9, ENM_R = 9;
  const MOVE_SPD = 2, ENM_SPD_BASE = 1.2, ENM_SPD_INC = 0.2;
  const PWR_TIME = 5000, TIME_LIMIT = 240, MAX_LIVES = 3;
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

    /* Background (flat pixel style) */
    ctx.fillStyle = '#08040C';
    ctx.fillRect(0, 0, W, H);

    /* Maze (pixel brick tiles) */
    var PS = 4; // pixel size for tile texture
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = OX + c * CELL, y = OY + r * CELL;
      if (grid[r][c] === 1) {
        /* Mars brick — flat pixel art style */
        ctx.fillStyle = '#4A2810';
        ctx.fillRect(x, y, CELL, CELL);
        /* Brick mortar lines */
        ctx.fillStyle = '#351C08';
        ctx.fillRect(x, y + 12, CELL, 2); // horizontal mortar
        if ((r + c) % 2 === 0) {
          ctx.fillRect(x + 12, y, 2, 12); // vertical top half
          ctx.fillRect(x + 4, y + 14, 2, 10); // vertical bottom half offset
        } else {
          ctx.fillRect(x + 4, y, 2, 12);
          ctx.fillRect(x + 16, y + 14, 2, 10);
        }
        /* Highlight pixels (top-left of each brick) */
        ctx.fillStyle = '#5C3418';
        ctx.fillRect(x + 2, y + 2, PS, PS);
        ctx.fillRect(x + 2, y + 16, PS, PS);
        /* Shadow pixels (bottom-right) */
        ctx.fillStyle = '#2E1406';
        ctx.fillRect(x + CELL - PS - 2, y + CELL - PS - 2, PS, PS);
      } else {
        /* Tunnel floor — dark pixel checkerboard */
        ctx.fillStyle = '#0C0610';
        ctx.fillRect(x, y, CELL, CELL);
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#100814';
          ctx.fillRect(x, y, CELL, CELL);
        }
        /* Subtle floor pixel dots */
        if ((r * 7 + c * 13) % 11 === 0) {
          ctx.fillStyle = '#1A0E1E';
          ctx.fillRect(x + 10, y + 10, PS, PS);
        }
      }
    }

    /* Dots (pixel diamond shape) */
    dots.forEach(function (d) {
      var dx = OX + d.c * CELL + CELL / 2, dy = OY + d.r * CELL + CELL / 2;
      /* 5x5 pixel diamond */
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(dx - 1, dy - 3, 2, 2);
      ctx.fillRect(dx - 3, dy - 1, 2, 2);
      ctx.fillRect(dx + 1, dy - 1, 2, 2);
      ctx.fillRect(dx - 1, dy + 1, 2, 2);
      /* Center highlight */
      ctx.fillStyle = '#FFEE88';
      ctx.fillRect(dx - 1, dy - 1, 2, 2);
    });

    /* Power dots (pixel cross, flicker) */
    var blink = Math.floor(t * 3) % 2 === 0;
    powers.forEach(function (p) {
      var px = OX + p.c * CELL + CELL / 2, py = OY + p.r * CELL + CELL / 2;
      ctx.fillStyle = blink ? '#66CCFF' : '#3399CC';
      /* 7x7 pixel cross */
      ctx.fillRect(px - 1, py - 5, 2, 10);
      ctx.fillRect(px - 5, py - 1, 10, 2);
      ctx.fillRect(px - 3, py - 3, 6, 6);
      /* Center */
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    });

    /* Enemies (Mars aliens — pixel art sprites) */
    var ENM_COLORS = [
      { E: '#CC3333', e: '#991111' },  // red alien
      { E: '#DD7700', e: '#AA5500' },  // orange alien
      { E: '#AA2266', e: '#771144' },  // magenta alien
    ];
    var ENM_SCARED = { E: '#3366CC', e: '#224488' };
    /* Alien sprite 9x8 */
    var ALIEN_SPR = [
      '..KKKKK..',
      '.KEEEEEK.',
      'KEEWKWEEK',
      'KEEPKPEEK',
      'KEEEEEEEK',
      '.KEEEEEK.',
      '.Ke.E.eK.',
      '..K.K.K..',
    ];
    /* Scared sprite */
    var ALIEN_SCARED = [
      '..KKKKK..',
      '.KEEEEEK.',
      'KEEWKWEEK',
      'KEEEEEEEK',
      'KEW.W.WEK',
      '.KEEEEEK.',
      '.Ke.E.eK.',
      '..K.K.K..',
    ];
    var esc = 2.2; // enemy pixel scale
    enemies.forEach(function (e, idx) {
      var bob = Math.sin(e.phase) * 1.5;
      var ex = e.px, ey = e.py + bob;
      var cols = ALIEN_SPR[0].length, rows = ALIEN_SPR.length;
      var ew = cols * esc, eh = rows * esc;
      var eox = ex - ew / 2, eoy = ey - eh / 2;
      var pal = powered ? ENM_SCARED : ENM_COLORS[idx % 3];
      var spr = powered ? ALIEN_SCARED : ALIEN_SPR;
      for (var sr = 0; sr < rows; sr++) {
        for (var sc2 = 0; sc2 < cols; sc2++) {
          var ch = spr[sr][sc2]; if (ch === '.') continue;
          var color;
          if (ch === 'K') color = '#111111';
          else if (ch === 'E') color = pal.E;
          else if (ch === 'e') color = pal.e;
          else if (ch === 'W') color = '#ffffff';
          else if (ch === 'P') color = '#111111'; // pupils
          else color = '#fff';
          ctx.fillStyle = color;
          ctx.fillRect(Math.floor(eox + sc2 * esc), Math.floor(eoy + sr * esc), Math.ceil(esc), Math.ceil(esc));
        }
      }
    });

    /* Player (pixel art astronaut) */
    var psc = 2; // pixel scale
    var flipX = player.dir[0] === -1;
    var rows = ASTRONAUT.length, cols = ASTRONAUT[0].length;
    var pw = cols * psc, ph = rows * psc;
    var pox = player.px - pw / 2, poy = player.py - ph / 2;
    /* Glow */
    var pGlow = ctx.createRadialGradient(player.px, player.py, 0, player.px, player.py, 14);
    pGlow.addColorStop(0, 'rgba(255,136,0,0.15)');
    pGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = pGlow;
    ctx.fillRect(player.px - 14, player.py - 14, 28, 28);
    /* Draw sprite */
    for (var sr = 0; sr < rows; sr++) {
      for (var sc2 = 0; sc2 < cols; sc2++) {
        var ch = ASTRONAUT[sr][flipX ? (cols - 1 - sc2) : sc2];
        if (ch === '.') continue;
        ctx.fillStyle = ASTRO_PAL[ch] || '#fff';
        ctx.fillRect(Math.floor(pox + sc2 * psc), Math.floor(poy + sr * psc), psc, psc);
      }
    }

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

    ctx.font = 'bold 13px "Courier New",monospace'; ctx.textBaseline = 'top';
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

    /* Lives (mini astronaut sprites) */
    for (var li = 0; li < lives; li++) {
      var lx = W - 46 - li * 16, ly = 6;
      var lsc = 1.2;
      for (var lr = 0; lr < ASTRONAUT.length; lr++) {
        for (var lc = 0; lc < ASTRONAUT[0].length; lc++) {
          var lch = ASTRONAUT[lr][lc]; if (lch === '.') continue;
          ctx.fillStyle = ASTRO_PAL[lch] || '#fff';
          ctx.fillRect(Math.floor(lx + lc * lsc - ASTRONAUT[0].length * lsc / 2), Math.floor(ly + lr * lsc), Math.ceil(lsc), Math.ceil(lsc));
        }
      }
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
    ctx.font = 'bold 32px "Courier New",monospace';
    ctx.fillStyle = '#ff4400';
    ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
    ctx.fillText(lives <= 0 ? 'GAME OVER' : 'COMPLETE!', W / 2, H / 2 - 30);
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;
  }

  /* Astronaut icon sprite for selection panel */
  var ASTRO_PAL = {
    '.': null,
    'K': '#111111', 'O': '#FF8800', 'o': '#CC5500',
    'r': '#AA3322', 'R': '#CC4433', 'S': '#DDAA88',
    'V': '#6699AA', 'v': '#445566', 'w': '#AABBCC', 'G': '#555555',
  };
  var ASTRONAUT = [
    '...KKK...',
    '..KOOOK..',
    '.KOvwVOK.',
    '.KOVSVOK.',
    '..KoOoK..',
    '.KOOrOOK.',
    'KOOrOrOOK',
    'KROrOrORK',
    '.KRoKoRK.',
    '.KRK.KRK.',
    '..KK.KK..',
  ];
  function getAstronautIcon(size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var cx = c.getContext('2d');
    var rows = ASTRONAUT.length, cols = ASTRONAUT[0].length;
    var sc = Math.floor(Math.min(size / cols, size / rows));
    var ox = (size - cols * sc) / 2, oy = (size - rows * sc) / 2;
    for (var r = 0; r < rows; r++) {
      for (var cc = 0; cc < cols; cc++) {
        var ch = ASTRONAUT[r][cc];
        if (ch === '.') continue;
        cx.fillStyle = ASTRO_PAL[ch] || '#fff';
        cx.fillRect(Math.floor(ox + cc * sc), Math.floor(oy + r * sc), sc, sc);
      }
    }
    return c.toDataURL();
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, getAstronautIcon: getAstronautIcon, get continueCount() { return continueCount; } };
})();

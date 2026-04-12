/**
 * Mars Digger — Canvas-based Dig Dug minigame (화성 채굴)
 * Full pixel-art / dot-sprite style with Mars orange theme.
 */
window.MarsDigger = (function () {
  const W = 360, H = 640, COLS = 15, ROWS = 25, CS = 24;
  const SURFACE = 2, MAX_LIVES = 3, TIME_LIMIT = 240;
  const PUMP_RANGE = 2, POPS_NEEDED = 3, DEFLATE_MS = 1000;
  const PLAYER_MOVE_RATE = 7; // frames between player moves (slower)
  let canvas, ctx, onGameEnd, rafId;
  let grid, player, minerals, worms, rocks, score, lives;
  let startTime, running, gameOver, keys = {};
  let touchStart, moveDir, pumpPressed;
  let sparkles, particles;
  let continueCount = 0;
  let playerMoveCD = 0;

  /* ── Pixel-art palettes & sprites ── */
  var DIG_PAL = {
    '.': null,
    'K': '#111111', 'W': '#ffffff', 'w': '#bbbbcc', 'g': '#777788',
    'O': '#FF8800', 'o': '#CC5500', 'S': '#DD6622', 's': '#993311',
    'R': '#CC4433', 'r': '#AA3322',
    'V': '#6699AA', 'v': '#445566', 'B': '#AABBCC',
    'G': '#555555', 'Y': '#ffcc00',
  };

  /* Astronaut player sprite (9x11) */
  var ASTRO = [
    '...KKK...',
    '..KOOOK..',
    '.KOvBVOK.',
    '.KOVSVOK.',
    '..KoOoK..',
    '.KOOrOOK.',
    'KOOrOrOOK',
    'KROrOrORK',
    '.KRoKoRK.',
    '.KRK.KRK.',
    '..KK.KK..',
  ];

  /* Sandworm head sprite (9x7) — no eyes, round mouth with teeth/mandibles */
  var WORM_HEAD = [
    '..KKKKK..',
    '.KSoSoSK.',
    'KSoOOOoSK',
    'KSoOKOoSK',
    'KSoOOOoSK',
    '.KSoSoSK.',
    '..KKKKK..',
  ];
  /* Pumped head (red tones) */
  var WORM_HEAD_P = [
    '..KKKKK..',
    '.KrrRrRK.',
    'KrRPPPRrK',
    'KrRPKPRrK',
    'KrRPPPRrK',
    '.KrrRrRK.',
    '..KKKKK..',
  ];
  var WORM_PAL = {
    '.': null, 'K': '#111111',
    'O': '#FF8800', 'o': '#CC5500', 'S': '#DD6622', 's': '#993311',
    'R': '#ff6666', 'r': '#CC4444', 'P': '#ff8888', 'p': '#882222',
    'T': '#DDDDBB',
  };

  /* Sandworm body segment (5x5) */
  var WORM_BODY = [
    '.KKK.',
    'KOoOK',
    'KoSoK',
    'KOoOK',
    '.KKK.',
  ];
  var WORM_BODY_P = [
    '.KKK.',
    'KRrRK',
    'KrprK',
    'KRrRK',
    '.KKK.',
  ];

  /* Rock pixel sprite (7x7) */
  var ROCK_SPR = [
    '..KKK..',
    '.KgwgK.',
    'KgwWwgK',
    'KwWgWwK',
    'KgwWwgK',
    '.KgwgK.',
    '..KKK..',
  ];
  var ROCK_PAL = {
    '.': null, 'K': '#333333',
    'W': '#AAAAAA', 'w': '#888888', 'g': '#666666',
  };

  /* Mineral pixel sprites */
  var MIN_COMMON = [
    '..K..',
    '.KYK.',
    'KYWYK',
    '.KYK.',
    '..K..',
  ];
  var MIN_RARE = [
    '..K..',
    '.KBK.',
    'KBWBK',
    '.KBK.',
    '..K..',
  ];
  var MIN_CRYSTAL = [
    '..K..',
    '.KPK.',
    'KPWPK',
    '.KPK.',
    '..K..',
  ];
  var MIN_PAL = {
    '.': null, 'K': '#111111',
    'Y': '#FFD700', 'B': '#4488ff', 'P': '#bb44ff', 'W': '#ffffff',
  };

  /* ── Sprite renderer ── */
  function drawSprite(sprite, palette, x, y, scale, flipH) {
    var rows = sprite.length, cols = sprite[0].length;
    var w = cols * scale, h = rows * scale;
    var sx = flipH ? x + w / 2 : x - w / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ch = sprite[r][c];
        if (ch === '.') continue;
        var color = palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        var px = flipH ? sx + (cols - 1 - c) * scale : sx + c * scale;
        ctx.fillRect(Math.floor(px), Math.floor(y - h / 2 + r * scale), scale, scale);
      }
    }
  }

  /* ── Star field (pre-generated) ── */
  var stars = [];
  for (var _si = 0; _si < 25; _si++) {
    stars.push({
      x: (_si * 97 + 13) % W,
      y: (_si * 31 + 7) % (SURFACE * CS),
      color: _si % 3 === 0 ? '#FF8800' : _si % 3 === 1 ? '#4488ff' : '#ffffff',
      blink: _si * 1.7
    });
  }

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
    playerMoveCD = 0;
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

    /* Player movement with throttle */
    playerMoveCD++;
    var wantMove = keys['ArrowLeft'] || keys['ArrowRight'] || keys['ArrowUp'] || keys['ArrowDown'] || moveDir;
    if (wantMove && (playerMoveCD >= PLAYER_MOVE_RATE || moveDir)) {
      playerMoveCD = 0;
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
    } else {
      moveDir = null;
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
      if (w.moveT < 20) continue; w.moveT = 0;
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
  function respawn() { player.col = 7; player.row = 0; playerMoveCD = 0; }

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

  /* ════════════════════════════════════════
     DRAW — Full pixel-art rendering
     ════════════════════════════════════════ */
  function draw() {
    var t = Date.now() * 0.001;

    /* ── Sky: flat dark ── */
    ctx.fillStyle = '#0a0208';
    ctx.fillRect(0, 0, W, SURFACE * CS);

    /* ── Pixel stars ── */
    for (var si = 0; si < stars.length; si++) {
      var st = stars[si];
      var on = Math.sin(t * 2 + st.blink) > 0;
      if (!on) continue;
      ctx.fillStyle = st.color;
      ctx.fillRect(st.x, st.y, 2, 2);
    }

    /* ── Surface line: orange pixel dashes ── */
    var surfY = SURFACE * CS - 2;
    for (var sx = 0; sx < W; sx += 6) {
      ctx.fillStyle = (sx / 6 | 0) % 2 === 0 ? '#DD6622' : '#993311';
      ctx.fillRect(sx, surfY, 4, 2);
    }

    /* ── Soil / Tunnels / Rocks ── */
    for (var r = SURFACE; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = c * CS, y = r * CS;
      if (grid[r][c] === 1) {
        /* Soil: pixel dirt tiles */
        var depth = (r - SURFACE) / (ROWS - SURFACE);
        var rb = Math.floor(130 - depth * 70), gb = Math.floor(65 - depth * 40), bb = Math.floor(30 - depth * 20);
        ctx.fillStyle = 'rgb(' + rb + ',' + gb + ',' + bb + ')';
        ctx.fillRect(x, y, CS, CS);

        /* Pixel mortar lines */
        var mOff = (r % 2) * (CS / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, y + CS - 1, CS, 1); // horizontal mortar
        ctx.fillRect(x + ((c * CS + mOff) % CS), y, 1, CS); // vertical mortar

        /* Pixel highlight on top edge */
        ctx.fillStyle = 'rgba(255,200,150,0.08)';
        ctx.fillRect(x + 2, y + 1, CS - 4, 1);

        /* Pixel pebbles */
        if ((r * 13 + c * 7) % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(x + 6, y + 14, 3, 2);
        }
        if ((r * 11 + c * 23) % 7 === 0) {
          ctx.fillStyle = 'rgba(255,200,150,0.1)';
          ctx.fillRect(x + 16, y + 8, 2, 2);
        }
      } else if (grid[r][c] === 0 && r >= SURFACE) {
        /* Dug tunnel: dark flat */
        ctx.fillStyle = '#080406';
        ctx.fillRect(x, y, CS, CS);

        /* Pixel edge blocks at tunnel boundaries */
        var ps = 2; // pixel size for edges
        var edgeColor = 'rgba(120,60,30,0.4)';
        if (c > 0 && grid[r][c - 1] === 1) {
          ctx.fillStyle = edgeColor;
          for (var ey = 0; ey < CS; ey += ps * 2) ctx.fillRect(x, y + ey, ps, ps);
        }
        if (c < COLS - 1 && grid[r][c + 1] === 1) {
          ctx.fillStyle = edgeColor;
          for (var ey = 0; ey < CS; ey += ps * 2) ctx.fillRect(x + CS - ps, y + ey, ps, ps);
        }
        if (r > 0 && grid[r - 1][c] === 1) {
          ctx.fillStyle = edgeColor;
          for (var ex = 0; ex < CS; ex += ps * 2) ctx.fillRect(x + ex, y, ps, ps);
        }
        if (r < ROWS - 1 && grid[r + 1][c] === 1) {
          ctx.fillStyle = edgeColor;
          for (var ex = 0; ex < CS; ex += ps * 2) ctx.fillRect(x + ex, y + CS - ps, ps, ps);
        }
      } else if (grid[r][c] === 2) {
        /* Rock: pixel sprite */
        /* Draw soil behind first */
        var depth2 = (r - SURFACE) / (ROWS - SURFACE);
        var rb2 = Math.floor(130 - depth2 * 70), gb2 = Math.floor(65 - depth2 * 40), bb2 = Math.floor(30 - depth2 * 20);
        ctx.fillStyle = 'rgb(' + rb2 + ',' + gb2 + ',' + bb2 + ')';
        ctx.fillRect(x, y, CS, CS);
        /* Rock sprite centered in cell */
        drawSprite(ROCK_SPR, ROCK_PAL, x + CS / 2, y + CS / 2, 3, false);
      }
    }

    /* ── Minerals: pixel diamonds ── */
    for (var i = 0; i < minerals.length; i++) { var m = minerals[i]; if (m.collected) continue;
      var mx = m.col * CS + CS / 2, my = m.row * CS + CS / 2;
      var mspr = m.type === 'common' ? MIN_COMMON : m.type === 'rare' ? MIN_RARE : MIN_CRYSTAL;
      /* Pixel glow pulse */
      var glowOn = Math.sin(t * 3 + i) > 0.3;
      if (glowOn) {
        var gc = m.type === 'common' ? '#FFD700' : m.type === 'rare' ? '#4488ff' : '#bb44ff';
        ctx.fillStyle = gc;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(mx - 6, my - 6, 12, 12);
        ctx.globalAlpha = 1;
      }
      drawSprite(mspr, MIN_PAL, mx, my, 2, false);
    }

    /* ── Sandworms (Dune-style, no eyes, mouth at front) ── */
    for (var i = 0; i < worms.length; i++) { var w = worms[i]; if (w.dead) continue;
      var wx = w.col * CS + CS / 2, wy = w.row * CS + CS / 2;
      var inflate = 1 + w.pumps * 0.3;
      var bob = Math.sin(w.phase) * 1.5;
      var facingR = w.dir === 'r';
      var pumped = w.pumps >= 2;
      var sc = Math.max(1, Math.floor(1.5 * inflate));

      /* Body segments (back to front) */
      var segCount = 3;
      for (var s = segCount - 1; s >= 0; s--) {
        var segOff = (facingR ? -1 : 1) * (s + 1) * 6 * inflate;
        var segBob = Math.sin(w.phase + s * 0.5) * 1.2;
        var bspr = pumped ? WORM_BODY_P : WORM_BODY;
        drawSprite(bspr, WORM_PAL, wx + segOff, wy + bob + segBob, sc, facingR);
      }

      /* Head */
      var hspr = pumped ? WORM_HEAD_P : WORM_HEAD;
      drawSprite(hspr, WORM_PAL, wx, wy + bob, sc, !facingR);

      /* Teeth detail on mouth side */
      var toothX = facingR ? wx + 5 * sc : wx - 5 * sc;
      ctx.fillStyle = '#DDDDBB';
      ctx.fillRect(Math.floor(toothX), Math.floor(wy + bob - 2 * sc), sc, sc);
      ctx.fillRect(Math.floor(toothX), Math.floor(wy + bob + 1 * sc), sc, sc);
      ctx.fillRect(Math.floor(toothX + (facingR ? sc : -sc)), Math.floor(wy + bob), sc, sc);

      /* Pump indicator ring (pixel blocks in arc) */
      if (w.pumps > 0) {
        var ringR = 8 * inflate;
        var segments = Math.floor(12 * (w.pumps / POPS_NEEDED));
        ctx.fillStyle = '#ff4444';
        for (var ri = 0; ri < segments; ri++) {
          var ra = (ri / 12) * Math.PI * 2 - Math.PI / 2;
          ctx.fillRect(Math.floor(wx + Math.cos(ra) * ringR), Math.floor(wy + bob + Math.sin(ra) * ringR), 2, 2);
        }
      }
    }

    /* ── Player (astronaut pixel sprite) ── */
    var px = player.col * CS + CS / 2, py = player.row * CS + CS / 2;
    var flipPlayer = player.dir === 'l';
    drawSprite(ASTRO, DIG_PAL, px, py, 2, flipPlayer);

    /* Direction indicator (small pixel arrow) */
    var adx = player.dir === 'r' ? 1 : player.dir === 'l' ? -1 : 0;
    var ady = player.dir === 'd' ? 1 : player.dir === 'u' ? -1 : 0;
    ctx.fillStyle = '#FF8800';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(Math.floor(px + adx * 12), Math.floor(py + ady * 12), 3, 3);
    ctx.globalAlpha = 1;

    /* ── Sparkles (pixel blocks) ── */
    for (var i = 0; i < sparkles.length; i++) { var sp = sparkles[i]; var a = sp.life / 12;
      ctx.fillStyle = 'rgba(160,100,40,' + a + ')';
      ctx.fillRect(Math.floor(sp.x), Math.floor(sp.y), 2, 2);
    }

    /* ── Particles (pixel blocks, no shadow) ── */
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      var ps = Math.max(1, Math.floor(pt.size * pt.life));
      ctx.fillRect(Math.floor(pt.x), Math.floor(pt.y), ps, ps);
    }
    ctx.globalAlpha = 1;

    /* ── HUD ── */
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, 26);
    /* HUD bottom accent pixels */
    for (var hx = 0; hx < W; hx += 4) {
      ctx.fillStyle = (hx / 4 | 0) % 2 === 0 ? 'rgba(200,100,50,0.2)' : 'rgba(200,100,50,0.05)';
      ctx.fillRect(hx, 24, 2, 2);
    }

    var elapsed = Math.min(TIME_LIMIT, (Date.now() - startTime) / 1000);
    ctx.font = 'bold 12px "Courier New",monospace'; ctx.textBaseline = 'top';

    ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 6, 6);

    var remain = Math.ceil(TIME_LIMIT - elapsed);
    ctx.fillStyle = remain <= 10 ? '#ff4444' : '#fff'; ctx.textAlign = 'center';
    ctx.fillText(remain + 's', W / 2, 6);

    /* Lives: mini pixel astronaut helmets */
    ctx.textAlign = 'right';
    for (var li = 0; li < lives; li++) {
      var lx = W - 44 - li * 16, ly = 5;
      /* Mini helmet: 5x5 pixel art */
      ctx.fillStyle = '#FF8800';
      ctx.fillRect(lx - 1, ly + 1, 2, 2);
      ctx.fillRect(lx + 1, ly + 1, 2, 2);
      ctx.fillRect(lx - 2, ly + 3, 6, 2);
      ctx.fillRect(lx - 2, ly + 5, 6, 4);
      ctx.fillRect(lx - 1, ly + 9, 4, 2);
      /* Visor */
      ctx.fillStyle = '#6699AA';
      ctx.fillRect(lx, ly + 1, 2, 2);
    }

    if (gameOver) drawGameOver();
  }

  function endGame() { gameOver = true; running = false; cancelAnimationFrame(rafId); draw(); onGameEnd(score); }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 32px "Courier New",monospace';
    ctx.fillStyle = '#ff4400';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
  }

  function continueGame() {
    continueCount++; lives = MAX_LIVES; gameOver = false; running = true;
    respawn(); rafId = requestAnimationFrame(loop);
  }

  /* Pickaxe icon sprite for selection panel */
  var PICK_PAL = {
    '.': null,
    'K': '#111111', 'M': '#444455', 'm': '#666677',
    'O': '#DD8833', 'H': '#CC7733', 'h': '#AA5522', 'r': '#886644',
  };
  var PICKAXE = [
    'Kmm.....mmK',
    'KMmK...KmMK',
    '.KMmKKKmMK.',
    '..KMmMmMK..',
    '...KmOmK...',
    '...KrHrK...',
    '....KHK....',
    '....KHK....',
    '....KhK....',
    '....KHK....',
    '....KhK....',
    '....KHK....',
    '....KKK....',
  ];
  function getPickaxeIcon(size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var cx = c.getContext('2d');
    var rows = PICKAXE.length, cols = PICKAXE[0].length;
    var sc = Math.floor(Math.min(size / cols, size / rows));
    var ox = (size - cols * sc) / 2, oy = (size - rows * sc) / 2;
    for (var r = 0; r < rows; r++) {
      for (var cc = 0; cc < cols; cc++) {
        var ch = PICKAXE[r][cc];
        if (ch === '.') continue;
        cx.fillStyle = PICK_PAL[ch] || '#fff';
        cx.fillRect(Math.floor(ox + cc * sc), Math.floor(oy + r * sc), sc, sc);
      }
    }
    return c.toDataURL();
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, getPickaxeIcon: getPickaxeIcon, get continueCount() { return continueCount; } };
})();

/**
 * Mars Invaders — Classic Space Invaders style with pixel-art sprites
 * Manual fire, slow methodical alien movement, alien projectiles, shields.
 */
window.MarsInvaders = (function () {
  const W = 360, H = 640;
  const PX = 2; // pixel scale for sprites

  /* Speeds tuned for classic feel */
  const PLAYER_SPEED = 2;
  const BULLET_SPEED = 3.5;
  const ALIEN_BULLET_SPEED = 1.5;
  const ALIEN_STEP_X = 1.5;     // pixels per step
  const ALIEN_DROP = 8;
  const ALIEN_STEP_MS_BASE = 1200; // ms between alien steps (gets faster)
  const ALIEN_FIRE_CHANCE = 0.008; // per alien per step
  const MAX_LIVES = 3, TIME_LIMIT = 90;
  const ALIEN_SCORE = 10, BOSS_SCORE = 100, WAVE_BONUS = 20;
  const BOSS_EVERY = 5, BOSS_HP = 5;

  let canvas, ctx, onGameEnd, rafId;
  let player, playerBullet, aliens, alienBullets, shields;
  let score, lives, wave, alienDir, lastAlienStep, alienStepMs;
  let startTime, running, gameOver;
  let keys = {}, touchX = null, firePressed = false;
  let continueCount = 0, particles = [], stars = [];
  let frameCount = 0;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── Palette ── */
  var PAL = {
    '.': null,
    'W': '#ffffff', 'w': '#bbbbcc', 'g': '#888899',
    'G': '#33ff55', 'D': '#22aa33', 'd': '#116622', 'L': '#88ffaa',
    'R': '#ff2222', 'r': '#bb1111', 'P': '#ff6666', 'p': '#771111',
    'O': '#ff8800', 'o': '#cc6600', 'Y': '#ffcc00', 'y': '#998800',
    'B': '#4488ff', 'b': '#2244aa', 'C': '#44ccff', 'c': '#2288aa',
    'K': '#000000', 'S': '#bbbbcc', 's': '#888899', 'F': '#ff4400',
  };

  function drawSprite(data, x, y, sc) {
    var rows = data.length, cols = data[0].length;
    var ox = x - (cols * sc) / 2, oy = y - (rows * sc) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var ch = data[r][c];
        if (ch === '.') continue;
        ctx.fillStyle = PAL[ch] || '#fff';
        ctx.fillRect(Math.floor(ox + c * sc), Math.floor(oy + r * sc), sc, sc);
      }
    }
  }

  /* ── Sprites (small pixel grids, drawn at 2-3x scale) ── */

  /* Player ship 13x7 */
  var SHIP = [
    '......S......',
    '.....SSS.....',
    '.....SCS.....',
    '....SSSSS....',
    '.SSSSSSSSSSS.',
    'SsSSSrSrSSsSS',
    'Ss.ss.S.ss.sS',
  ];

  /* Alien type A 11x8 — squid */
  var ALIEN_A1 = [
    '.....G.....',
    '....GGG....',
    '...GGGGG...',
    '..GG.G.GG..',
    '..GGGGGGG..',
    '....G.G....',
    '...G...G...',
    '..G.....G..',
  ];
  var ALIEN_A2 = [
    '.....G.....',
    '....GGG....',
    '...GGGGG...',
    '..GG.G.GG..',
    '..GGGGGGG..',
    '...G.G.G...',
    '..G.G.G.G..',
    '...G...G...',
  ];

  /* Alien type B 11x8 — crab */
  var ALIEN_B1 = [
    '..G.....G..',
    '...G...G...',
    '..GGGGGGG..',
    '.GG.GGG.GG.',
    'GGGGGGGGGGG',
    'G.GGGGGGG.G',
    'G.G.....G.G',
    '...GG.GG...',
  ];
  var ALIEN_B2 = [
    '..G.....G..',
    'G..G...G..G',
    'G.GGGGGGG.G',
    'GGG.GGG.GGG',
    'GGGGGGGGGGG',
    '.GGGGGGGGG.',
    '..G.....G..',
    '.G.......G.',
  ];

  /* Boss 13x9 */
  var BOSS_SPRITE = [
    '....RRRRR....',
    '..RRRRRRRRR..',
    '.RRRRRRRRRRR.',
    '.RRW.RRR.WRR.',
    '.RRRRRRRRRRR.',
    '.RRRRRRRRRRR.',
    '...RR.R.RR...',
    '..RR.....RR..',
    '.RR.......RR.',
  ];

  /* Shield block 16x10 */
  var SHIELD_DATA = [
    '....GGGGGGGG....',
    '..GGGGGGGGGGGG..',
    '.GGGGGGGGGGGGGG.',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGG......GGGGG',
    'GGGG........GGGG',
    'GGG..........GGG',
  ];

  function initStars() {
    stars = [];
    for (var i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, blink: Math.random() * 6.28 });
    }
  }

  function spawnParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.28, sp = Math.random() * 2 + 0.5;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.03, size: Math.random() * 2 + 1, color: color });
    }
  }

  function createShields() {
    shields = [];
    var positions = [60, 140, 220, 300];
    for (var i = 0; i < positions.length; i++) {
      var cells = [];
      for (var r = 0; r < SHIELD_DATA.length; r++) {
        for (var c = 0; c < SHIELD_DATA[0].length; c++) {
          if (SHIELD_DATA[r][c] !== '.') {
            cells.push({ x: positions[i] - 16 + c * 2, y: H - 140 + r * 2, alive: true });
          }
        }
      }
      shields.push(cells);
    }
  }

  function init(canvasId, cb) {
    canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    ctx = canvas.getContext('2d'); onGameEnd = cb || function () {};
    resize(); initStars();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', function(e) { keys[e.key] = true; if (e.key === ' ' || e.key === 'ArrowUp') firePressed = true; });
    window.addEventListener('keyup', function(e) { keys[e.key] = false; });
    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault(); var rect = canvas.getBoundingClientRect();
      touchX = (e.touches[0].clientX - rect.left) / rect.width * W;
      firePressed = true; // tap to fire
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault(); var rect = canvas.getBoundingClientRect();
      touchX = (e.touches[0].clientX - rect.left) / rect.width * W;
    }, { passive: false });
    canvas.addEventListener('touchend', function () { touchX = null; });
  }

  function resize() {
    var parent = canvas.parentElement || document.body;
    var scale = Math.min(parent.clientWidth / W, parent.clientHeight / H, 1);
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W * scale) + 'px'; canvas.style.height = (H * scale) + 'px';
  }

  function spawnWave() {
    wave++;
    alienDir = 1;
    alienStepMs = Math.max(300, ALIEN_STEP_MS_BASE - wave * 50);
    lastAlienStep = performance.now();
    if (wave % BOSS_EVERY === 0) {
      aliens.push({ x: W / 2, y: 60, w: 13 * 3, h: 9 * 3, hp: BOSS_HP, boss: true, type: 0 });
      return;
    }
    var cols = 8, rows = Math.min(2 + Math.floor(wave / 2), 5);
    var gapX = 36, gapY = 30;
    var startX = (W - (cols - 1) * gapX) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        aliens.push({
          x: startX + c * gapX,
          y: 50 + r * gapY,
          w: 11 * PX, h: 8 * PX,
          hp: 1, boss: false, type: r % 2
        });
      }
    }
  }

  function start() {
    player = { x: W / 2, y: H - 40 };
    playerBullet = null; alienBullets = [];
    aliens = []; particles = [];
    score = 0; lives = MAX_LIVES; wave = 0; continueCount = 0;
    gameOver = false; running = true; frameCount = 0;
    startTime = performance.now();
    keys = {}; touchX = null; firePressed = false;
    initStars(); createShields(); spawnWave();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false; cancelAnimationFrame(rafId);
  }
  function getScore() { return score; }

  function loop(ts) {
    if (!running) return;
    frameCount++;
    update(ts); draw(ts);
    rafId = requestAnimationFrame(loop);
  }

  function update(ts) {
    var elapsed = (ts - startTime) / 1000;
    if (TIME_LIMIT - elapsed <= 0 || lives <= 0) { endGame(); return; }

    /* Player movement */
    if (keys['ArrowLeft'] || keys['a']) player.x -= PLAYER_SPEED;
    if (keys['ArrowRight'] || keys['d']) player.x += PLAYER_SPEED;
    if (touchX !== null) {
      var dx = touchX - player.x;
      player.x += clamp(dx, -PLAYER_SPEED * 1.5, PLAYER_SPEED * 1.5);
    }
    player.x = clamp(player.x, 20, W - 20);

    /* Player fire — one bullet at a time (classic) */
    if (firePressed && !playerBullet) {
      playerBullet = { x: player.x, y: player.y - 10 };
    }
    firePressed = false;

    /* Player bullet */
    if (playerBullet) {
      playerBullet.y -= BULLET_SPEED;
      if (playerBullet.y < 0) { playerBullet = null; }
      else {
        /* Hit aliens */
        for (var j = aliens.length - 1; j >= 0; j--) {
          var a = aliens[j];
          if (Math.abs(a.x - playerBullet.x) < a.w / 2 && Math.abs(a.y - playerBullet.y) < a.h / 2) {
            a.hp--;
            playerBullet = null;
            if (a.hp <= 0) {
              score += a.boss ? BOSS_SCORE : ALIEN_SCORE;
              spawnParticles(a.x, a.y, a.boss ? '#ff4444' : '#33ff66', a.boss ? 15 : 8);
              aliens.splice(j, 1);
              /* Speed up as aliens die (classic behavior) */
              if (!a.boss) alienStepMs = Math.max(200, alienStepMs - 10);
            } else {
              spawnParticles(a.x, a.y, '#ffaa00', 4);
            }
            break;
          }
        }
        /* Hit shields */
        if (playerBullet) {
          for (var si = 0; si < shields.length; si++) {
            var cells = shields[si];
            for (var ci = cells.length - 1; ci >= 0; ci--) {
              var sc = cells[ci];
              if (sc.alive && Math.abs(sc.x - playerBullet.x) < 2 && Math.abs(sc.y - playerBullet.y) < 2) {
                sc.alive = false; playerBullet = null; break;
              }
            }
            if (!playerBullet) break;
          }
        }
      }
    }

    /* Alien movement — step-based like original */
    if (ts - lastAlienStep >= alienStepMs && aliens.length > 0) {
      lastAlienStep = ts;
      var needDrop = false;
      for (var k = 0; k < aliens.length; k++) {
        aliens[k].x += alienDir * ALIEN_STEP_X;
        if (aliens[k].x < 20 || aliens[k].x > W - 20) needDrop = true;
      }
      if (needDrop) {
        alienDir *= -1;
        for (var k = 0; k < aliens.length; k++) aliens[k].y += ALIEN_DROP;
      }
      /* Aliens fire */
      for (var k = 0; k < aliens.length; k++) {
        if (!aliens[k].boss && Math.random() < ALIEN_FIRE_CHANCE * (1 + wave * 0.3)) {
          alienBullets.push({ x: aliens[k].x, y: aliens[k].y + aliens[k].h / 2 });
        }
      }
      /* Check if aliens reached player */
      for (var k = 0; k < aliens.length; k++) {
        if (aliens[k].y + aliens[k].h / 2 >= player.y - 10) {
          lives = 0; endGame(); return;
        }
      }
    }

    /* Alien bullets */
    for (var ab = alienBullets.length - 1; ab >= 0; ab--) {
      alienBullets[ab].y += ALIEN_BULLET_SPEED;
      if (alienBullets[ab].y > H) { alienBullets.splice(ab, 1); continue; }
      /* Hit player */
      if (Math.abs(alienBullets[ab].x - player.x) < 12 && Math.abs(alienBullets[ab].y - player.y) < 8) {
        lives--; spawnParticles(player.x, player.y, '#ff8800', 10);
        alienBullets.splice(ab, 1);
        if (lives <= 0) { endGame(); return; }
        continue;
      }
      /* Hit shields */
      for (var si = 0; si < shields.length; si++) {
        var cells = shields[si]; var hit = false;
        for (var ci = cells.length - 1; ci >= 0; ci--) {
          var sc = cells[ci];
          if (sc.alive && Math.abs(sc.x - alienBullets[ab].x) < 2 && Math.abs(sc.y - alienBullets[ab].y) < 2) {
            sc.alive = false; alienBullets.splice(ab, 1); hit = true; break;
          }
        }
        if (hit) break;
      }
    }

    /* Particles */
    for (var p = particles.length - 1; p >= 0; p--) {
      particles[p].x += particles[p].vx; particles[p].y += particles[p].vy;
      particles[p].life -= particles[p].decay;
      if (particles[p].life <= 0) particles.splice(p, 1);
    }

    /* Next wave */
    if (aliens.length === 0) { score += wave * WAVE_BONUS; createShields(); spawnWave(); }
  }

  function endGame() {
    gameOver = true; running = false; cancelAnimationFrame(rafId);
    drawGameOver(); onGameEnd(score);
  }
  function continueGame() {
    continueCount++; lives = MAX_LIVES; gameOver = false; running = true;
    alienBullets = [];
    if (aliens.length === 0) { createShields(); spawnWave(); }
    rafId = requestAnimationFrame(loop);
  }

  function draw(ts) {
    var elapsed = (ts - startTime) / 1000;
    var timeLeft = Math.max(0, TIME_LIMIT - elapsed);
    var t = ts * 0.001;
    var anim = Math.floor(frameCount / 30) % 2;

    /* Background */
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, W, H);

    /* Stars */
    for (var si = 0; si < stars.length; si++) {
      var st = stars[si];
      var b = 0.3 + 0.4 * Math.sin(t + st.blink);
      ctx.fillStyle = 'rgba(255,255,255,' + b + ')';
      ctx.fillRect(Math.floor(st.x), Math.floor(st.y), 1, 1);
    }

    /* Shields */
    ctx.fillStyle = '#22cc44';
    for (var si = 0; si < shields.length; si++) {
      var cells = shields[si];
      for (var ci = 0; ci < cells.length; ci++) {
        if (cells[ci].alive) {
          ctx.fillRect(cells[ci].x, cells[ci].y, 2, 2);
        }
      }
    }

    /* Aliens */
    for (var j = 0; j < aliens.length; j++) {
      var a = aliens[j];
      if (a.boss) {
        drawSprite(BOSS_SPRITE, a.x, a.y, 3);
        /* HP bar */
        ctx.fillStyle = '#330000';
        ctx.fillRect(a.x - 20, a.y + 16, 40, 3);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(a.x - 20, a.y + 16, 40 * (a.hp / BOSS_HP), 3);
      } else {
        var sprite;
        if (a.type === 0) sprite = anim ? ALIEN_A1 : ALIEN_A2;
        else sprite = anim ? ALIEN_B1 : ALIEN_B2;
        drawSprite(sprite, a.x, a.y, PX);
      }
    }

    /* Player ship */
    drawSprite(SHIP, player.x, player.y, 3);

    /* Player bullet */
    if (playerBullet) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playerBullet.x - 1, playerBullet.y - 4, 2, 8);
    }

    /* Alien bullets */
    ctx.fillStyle = '#ff4444';
    for (var ab = 0; ab < alienBullets.length; ab++) {
      var abx = alienBullets[ab].x, aby = alienBullets[ab].y;
      /* Zigzag bolt shape */
      if (frameCount % 4 < 2) {
        ctx.fillRect(abx - 1, aby - 3, 2, 2);
        ctx.fillRect(abx, aby - 1, 2, 2);
        ctx.fillRect(abx - 1, aby + 1, 2, 2);
      } else {
        ctx.fillRect(abx, aby - 3, 2, 2);
        ctx.fillRect(abx - 1, aby - 1, 2, 2);
        ctx.fillRect(abx, aby + 1, 2, 2);
      }
    }

    /* Particles */
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    /* Ground line */
    ctx.fillStyle = '#22cc44';
    ctx.fillRect(0, H - 16, W, 1);

    /* HUD */
    ctx.font = 'bold 12px monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
    ctx.fillText('SCORE  ' + String(score).padStart(6, '0'), 8, 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = timeLeft < 15 ? '#ff4444' : '#aaaaaa';
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('WAVE ' + wave, W - 40, 4);
    /* Lives (bottom left) */
    for (var li = 0; li < lives - 1; li++) {
      drawSprite(SHIP, 24 + li * 28, H - 6, 1.5);
    }
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace'; ctx.fillStyle = '#ff2222';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.fillStyle = '#888888'; ctx.font = '12px monospace';
    ctx.fillText('WAVE ' + wave, W / 2, H / 2 + 35);
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

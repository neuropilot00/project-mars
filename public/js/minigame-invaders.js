/**
 * Mars Invaders — Canvas-based Space Invaders minigame
 * Self-contained, no external dependencies.
 */
window.MarsInvaders = (function () {
  /* ── Tuning constants ─────────────────────────────── */
  const W = 360, H = 640;
  const PLAYER_W = 28, PLAYER_H = 22, PLAYER_SPEED = 5;
  const BULLET_R = 3, BULLET_SPEED = 7, FIRE_INTERVAL = 200;
  const ALIEN_R = 14, ALIEN_SPEED_BASE = 1.2, ALIEN_DROP = 22;
  const BOSS_R = 26, BOSS_HP = 3, BOSS_SCORE = 100;
  const ALIEN_SCORE = 10, WAVE_BONUS = 20;
  const ALIENS_PER_ROW_MIN = 5, ALIENS_PER_ROW_MAX = 8;
  const BOSS_EVERY = 5, SPEED_INC = 0.25;
  const MAX_LIVES = 3, TIME_LIMIT = 90;

  /* ── State ─────────────────────────────────────────── */
  let canvas, ctx, onGameEnd, rafId;
  let player, bullets, aliens, score, lives, wave, alienDir, alienSpeed;
  let lastFire, startTime, running, gameOver;
  let keys = {}, touchX = null;
  let continueCount = 0;

  /* ── Helpers ───────────────────────────────────────── */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ── Init ──────────────────────────────────────────── */
  function init(canvasId, cb) {
    canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    ctx = canvas.getContext('2d');
    onGameEnd = cb || function () {};
    resize();
    window.addEventListener('resize', resize);
    /* keyboard */
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', offKey);
    /* touch */
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', function () { touchX = null; });
  }

  function resize() {
    var parent = canvas.parentElement || document.body;
    var scale = Math.min(parent.clientWidth / W, parent.clientHeight / H, 1);
    canvas.width = W; canvas.height = H;
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
  }

  function onKey(e) { keys[e.key] = true; }
  function offKey(e) { keys[e.key] = false; }
  function onTouch(e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var t = e.touches[0];
    touchX = (t.clientX - rect.left) / rect.width * W;
  }

  /* ── Spawn helpers ─────────────────────────────────── */
  function spawnWave() {
    wave++;
    alienSpeed = ALIEN_SPEED_BASE + (wave - 1) * SPEED_INC;
    alienDir = 1;
    if (wave % BOSS_EVERY === 0) {
      aliens.push({ x: W / 2, y: ALIEN_R + 10, r: BOSS_R, hp: BOSS_HP, boss: true, phase: 0 });
      return;
    }
    var count = ALIENS_PER_ROW_MIN + Math.min(wave, ALIENS_PER_ROW_MAX - ALIENS_PER_ROW_MIN);
    var rows = Math.min(1 + Math.floor(wave / 3), 4);
    var gap = W / (count + 1);
    for (var row = 0; row < rows; row++) {
      for (var i = 0; i < count; i++) {
        aliens.push({ x: gap * (i + 1), y: 30 + row * (ALIEN_R * 2 + 8), r: ALIEN_R, hp: 1, boss: false });
      }
    }
  }

  /* ── Game loop ─────────────────────────────────────── */
  function start() {
    player = { x: W / 2, y: H - PLAYER_H - 10 };
    bullets = []; aliens = [];
    score = 0; lives = MAX_LIVES; wave = 0; continueCount = 0;
    lastFire = 0; gameOver = false; running = true;
    startTime = performance.now();
    keys = {}; touchX = null;
    spawnWave();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', offKey);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('touchstart', onTouch);
    canvas.removeEventListener('touchmove', onTouch);
  }

  function getScore() { return score; }

  function loop(ts) {
    if (!running) return;
    update(ts);
    draw(ts);
    rafId = requestAnimationFrame(loop);
  }

  /* ── Update ────────────────────────────────────────── */
  function update(ts) {
    var elapsed = (ts - startTime) / 1000;
    var timeLeft = TIME_LIMIT - elapsed;
    if (timeLeft <= 0 || lives <= 0) { endGame(); return; }

    /* player movement */
    if (keys['ArrowLeft'] || keys['a']) player.x -= PLAYER_SPEED;
    if (keys['ArrowRight'] || keys['d']) player.x += PLAYER_SPEED;
    if (touchX !== null) {
      var dx = touchX - player.x;
      player.x += clamp(dx, -PLAYER_SPEED * 1.5, PLAYER_SPEED * 1.5);
    }
    player.x = clamp(player.x, PLAYER_W / 2, W - PLAYER_W / 2);

    /* auto-fire */
    if (ts - lastFire >= FIRE_INTERVAL) {
      bullets.push({ x: player.x, y: player.y - PLAYER_H / 2 });
      lastFire = ts;
    }

    /* bullets */
    for (var i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y -= BULLET_SPEED;
      if (bullets[i].y < -BULLET_R) { bullets.splice(i, 1); continue; }
      /* hit test */
      for (var j = aliens.length - 1; j >= 0; j--) {
        var a = aliens[j], b = bullets[i];
        if (!b) break;
        var dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < (a.r + BULLET_R) * (a.r + BULLET_R)) {
          a.hp--;
          bullets.splice(i, 1);
          if (a.hp <= 0) {
            score += a.boss ? BOSS_SCORE : ALIEN_SCORE;
            aliens.splice(j, 1);
          }
          break;
        }
      }
    }

    /* alien movement */
    var hitEdge = false;
    for (var k = 0; k < aliens.length; k++) {
      var al = aliens[k];
      al.x += alienDir * alienSpeed;
      if (al.boss) al.phase = (al.phase || 0) + 0.05;
      if (al.x - al.r < 0 || al.x + al.r > W) hitEdge = true;
      /* reach bottom */
      if (al.y + al.r >= player.y - PLAYER_H / 2) { lives--; aliens.splice(k, 1); k--; }
    }
    if (hitEdge) {
      alienDir *= -1;
      for (var m = 0; m < aliens.length; m++) aliens[m].y += ALIEN_DROP;
    }

    /* next wave */
    if (aliens.length === 0) {
      score += wave * WAVE_BONUS;
      spawnWave();
    }
  }

  function endGame() {
    gameOver = true; running = false;
    cancelAnimationFrame(rafId);
    drawGameOver();
    onGameEnd(score);
  }

  function continueGame() {
    continueCount++;
    lives = MAX_LIVES;
    gameOver = false; running = true;
    if (aliens.length === 0) spawnWave();
    rafId = requestAnimationFrame(loop);
  }

  /* ── Draw ──────────────────────────────────────────── */
  function draw(ts) {
    var elapsed = (ts - startTime) / 1000;
    var timeLeft = Math.max(0, TIME_LIMIT - elapsed);
    /* bg */
    ctx.fillStyle = '#0a0000';
    ctx.fillRect(0, 0, W, H);
    /* subtle stars */
    ctx.fillStyle = 'rgba(255,200,180,0.4)';
    for (var s = 0; s < 40; s++) {
      var sx = (s * 97 + 13) % W, sy = (s * 71 + 29) % H;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    /* player ship (triangle) */
    ctx.fillStyle = '#ff8c00';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - PLAYER_H / 2);
    ctx.lineTo(player.x - PLAYER_W / 2, player.y + PLAYER_H / 2);
    ctx.lineTo(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - PLAYER_H / 2 + 4);
    ctx.lineTo(player.x - 6, player.y + PLAYER_H / 2 - 2);
    ctx.lineTo(player.x + 6, player.y + PLAYER_H / 2 - 2);
    ctx.closePath();
    ctx.fill();

    /* bullets */
    ctx.fillStyle = '#ffee00';
    for (var i = 0; i < bullets.length; i++) {
      ctx.beginPath();
      ctx.arc(bullets[i].x, bullets[i].y, BULLET_R, 0, Math.PI * 2);
      ctx.fill();
    }

    /* aliens */
    for (var j = 0; j < aliens.length; j++) {
      var a = aliens[j];
      if (a.boss) {
        var pulse = 0.8 + 0.2 * Math.sin(a.phase);
        ctx.fillStyle = 'rgba(255,40,40,' + pulse + ')';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        /* eyes */
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(a.x - 8, a.y - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.x + 8, a.y - 4, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#33ff66';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
        /* antennae */
        ctx.strokeStyle = '#33ff66'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(a.x - 5, a.y - a.r); ctx.lineTo(a.x - 8, a.y - a.r - 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a.x + 5, a.y - a.r); ctx.lineTo(a.x + 8, a.y - a.r - 8); ctx.stroke();
        /* antenna tips */
        ctx.fillStyle = '#aaffcc';
        ctx.beginPath(); ctx.arc(a.x - 8, a.y - a.r - 8, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.x + 8, a.y - a.r - 8, 2, 0, Math.PI * 2); ctx.fill();
        /* eyes */
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(a.x - 4, a.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.x + 4, a.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* HUD */
    ctx.font = 'bold 16px monospace'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 8, 8);
    ctx.fillStyle = '#ff4444'; ctx.textAlign = 'right';
    ctx.fillText('\u2665 '.repeat(lives).trim(), W - 8, 8);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, 8);
    ctx.font = '11px monospace'; ctx.fillStyle = '#888';
    ctx.fillText('WAVE ' + wave, W / 2, 26);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
    ctx.fillText('Wave ' + wave, W / 2, H / 2 + 40);
  }

  return { init: init, start: start, stop: stop, getScore: getScore, continueGame: continueGame, get continueCount() { return continueCount; } };
})();

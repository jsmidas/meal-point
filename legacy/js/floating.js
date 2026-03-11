/* ============================
   MEALPOINT — floating.js v4
   Standalone particle system (no GSAP dependency)
   ============================ */

(function () {
  'use strict';

  var canvas, ctx;
  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var MOUSE_RADIUS = 200;
  var W = 0, H = 0;
  var dpr = 1;
  var running = false;

  var COLORS = [
    [232, 160, 74],
    [124, 106, 239],
    [240, 192, 120],
    [167, 139, 250],
    [232, 124, 106],
    [52, 211, 153]
  ];

  var SHAPES = ['circle', 'rect', 'ring', 'diamond'];

  /* ---- Bootstrap ---- */
  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();

  function boot() {
    canvas = document.getElementById('heroCanvas');
    if (!canvas) { console.warn('[floating] #heroCanvas not found'); return; }
    ctx = canvas.getContext('2d');
    if (!ctx) { console.warn('[floating] canvas context failed'); return; }

    dpr = Math.min(window.devicePixelRatio || 1, 2);

    sizeCanvas();
    spawnParticles();
    listen();

    if (!running) { running = true; loop(); }
  }

  /* ---- Sizing ---- */
  function sizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- Create particles ---- */
  function spawnParticles() {
    particles = [];
    var count = W < 480 ? 35 : W < 768 ? 50 : W < 1200 ? 70 : 90;

    for (var i = 0; i < count; i++) {
      var col = COLORS[~~(Math.random() * COLORS.length)];
      var sz = 3 + Math.random() * 18;
      if (sz > 14 && Math.random() > 0.2) sz = 4 + Math.random() * 10;

      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        sz: sz,
        szBase: sz,
        col: col,
        a: 0.3 + Math.random() * 0.5,
        aBase: 0.3 + Math.random() * 0.5,
        shape: SHAPES[~~(Math.random() * SHAPES.length)],
        rot: Math.random() * 6.28,
        rotV: (Math.random() - 0.5) * 0.03,
        // Physics
        grav: -0.01 - Math.random() * 0.02,           // antigravity (up)
        oscAmp: 0.4 + Math.random() * 1.0,
        oscFreq: 0.3 + Math.random() * 0.6,
        oscPhase: Math.random() * 6.28,
        mass: 0.5 + Math.random() * 1.5,
        burst: false,
        life: 9999
      });
    }
  }

  /* ---- Main loop ---- */
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  /* ---- Physics update ---- */
  function update() {
    var t = performance.now() * 0.001;

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];

      // === Constant forces (always active, no mouse needed) ===
      // Antigravity: push upward
      p.vy += p.grav;

      // Horizontal sway (sine oscillation)
      p.vx += Math.sin(t * p.oscFreq + p.oscPhase) * p.oscAmp * 0.025;

      // Vertical bob (cosine oscillation, offset phase)
      p.vy += Math.cos(t * p.oscFreq * 0.7 + p.oscPhase + 2.0) * p.oscAmp * 0.012;

      // === Mouse repulsion ===
      var dx = p.x - mouse.x;
      var dy = p.y - mouse.y;
      var dd = dx * dx + dy * dy;

      if (dd < MOUSE_RADIUS * MOUSE_RADIUS && dd > 1) {
        var d = Math.sqrt(dd);
        var f = ((MOUSE_RADIUS - d) / MOUSE_RADIUS);
        f = f * f * 6; // quadratic, strong push
        var ang = Math.atan2(dy, dx);
        p.vx += Math.cos(ang) * f * p.mass * 0.12;
        p.vy += Math.sin(ang) * f * p.mass * 0.12;
        p.a = Math.min(p.aBase + f * 0.08, 1);
        p.sz = p.szBase + f * 1.5;
      } else {
        p.a += (p.aBase - p.a) * 0.06;
        p.sz += (p.szBase - p.sz) * 0.06;
      }

      // Damping
      p.vx *= 0.985;
      p.vy *= 0.985;

      // Speed cap
      var spd = p.vx * p.vx + p.vy * p.vy;
      if (spd > 25) { // max 5 px/frame
        var s = Math.sqrt(spd);
        p.vx = (p.vx / s) * 5;
        p.vy = (p.vy / s) * 5;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotV;

      // Wrap edges
      var m = p.sz + 30;
      if (p.x < -m) p.x += W + m * 2;
      if (p.x > W + m) p.x -= W + m * 2;
      if (p.y < -m) p.y += H + m * 2;
      if (p.y > H + m) p.y -= H + m * 2;

      // Burst fade
      if (p.burst) {
        p.life--;
        p.a *= 0.96;
        if (p.life <= 0) { particles.splice(i, 1); }
      }
    }
  }

  /* ---- Draw ---- */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Connections
    drawLines();

    // Particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.a < 0.01) continue;

      var c = p.col;
      var rgb = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.a;

      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, p.sz, 0, 6.2832);
          ctx.fillStyle = rgb;
          ctx.fill();
          // Soft glow halo
          if (p.sz > 6) {
            ctx.globalAlpha = p.a * 0.12;
            ctx.beginPath();
            ctx.arc(0, 0, p.sz * 2.2, 0, 6.2832);
            ctx.fill();
          }
          break;

        case 'rect':
          var s = p.sz * 1.7;
          var r = p.sz * 0.35;
          ctx.beginPath();
          rrect(ctx, -s / 2, -s / 2, s, s, r);
          ctx.fillStyle = rgb;
          ctx.fill();
          break;

        case 'ring':
          ctx.beginPath();
          ctx.arc(0, 0, p.sz, 0, 6.2832);
          ctx.strokeStyle = rgb;
          ctx.lineWidth = Math.max(1.5, p.sz * 0.2);
          ctx.stroke();
          break;

        case 'diamond':
          var d = p.sz * 1.3;
          ctx.beginPath();
          ctx.moveTo(0, -d);
          ctx.lineTo(d * 0.6, 0);
          ctx.lineTo(0, d);
          ctx.lineTo(-d * 0.6, 0);
          ctx.closePath();
          ctx.fillStyle = rgb;
          ctx.fill();
          break;
      }
      ctx.restore();
    }
  }

  function drawLines() {
    var max = 130;
    var maxSq = max * max;
    var len = Math.min(particles.length, 80);

    for (var i = 0; i < len; i++) {
      var a = particles[i];
      for (var j = i + 1; j < len; j++) {
        var b = particles[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        if (dx > max || dx < -max || dy > max || dy < -max) continue;
        var dd = dx * dx + dy * dy;
        if (dd < maxSq) {
          var dist = Math.sqrt(dd);
          var op = (1 - dist / max) * 0.18;
          var r = (a.col[0] + b.col[0]) >> 1;
          var g = (a.col[1] + b.col[1]) >> 1;
          var bl = (a.col[2] + b.col[2]) >> 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + bl + ',' + op + ')';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }

  function rrect(c, x, y, w, h, r) {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
  }

  /* ---- Events ---- */
  function listen() {
    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', function () {
      mouse.x = -9999; mouse.y = -9999;
    });
    window.addEventListener('touchmove', function (e) {
      if (e.touches.length) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    }, { passive: true });
    window.addEventListener('touchend', function () {
      setTimeout(function () { mouse.x = -9999; mouse.y = -9999; }, 200);
    });
    window.addEventListener('click', function (e) {
      burst(e.clientX, e.clientY, 14);
    });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { sizeCanvas(); spawnParticles(); }, 200);
    });
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma != null && e.beta != null) {
          mouse.x = ((e.gamma + 45) / 90) * W;
          mouse.y = ((e.beta + 45) / 90) * H;
          mouse.x = Math.max(0, Math.min(W, mouse.x));
          mouse.y = Math.max(0, Math.min(H, mouse.y));
        }
      });
    }
  }

  function burst(cx, cy, n) {
    for (var i = 0; i < n; i++) {
      var ang = (6.2832 / n) * i + (Math.random() - 0.5) * 0.6;
      var spd = 3 + Math.random() * 5;
      var col = COLORS[~~(Math.random() * COLORS.length)];
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        sz: 3 + Math.random() * 10,
        szBase: 2,
        col: col,
        a: 0.9,
        aBase: 0,
        shape: SHAPES[~~(Math.random() * SHAPES.length)],
        rot: Math.random() * 6.28,
        rotV: (Math.random() - 0.5) * 0.08,
        grav: -0.015,
        oscAmp: 0.5, oscFreq: 0.5, oscPhase: Math.random() * 6.28,
        mass: 1, burst: true, life: 80
      });
    }
  }

})();

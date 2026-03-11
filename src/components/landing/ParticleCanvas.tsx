"use client";

import { useEffect, useRef } from "react";

const COLORS = [
  [232, 160, 74],
  [124, 106, 239],
  [240, 192, 120],
  [167, 139, 250],
  [232, 124, 106],
  [52, 211, 153],
];

const SHAPES = ["circle", "rect", "ring", "diamond"] as const;

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  sz: number; szBase: number;
  col: number[];
  a: number; aBase: number;
  shape: (typeof SHAPES)[number];
  rot: number; rotV: number;
  grav: number;
  oscAmp: number; oscFreq: number; oscPhase: number;
  mass: number;
  burst: boolean; life: number;
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };
    const MOUSE_RADIUS = 200;
    let W = 0, H = 0;
    let particles: Particle[] = [];
    let rafId: number;

    function sizeCanvas() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnParticles() {
      particles = [];
      const count = W < 480 ? 35 : W < 768 ? 50 : W < 1200 ? 70 : 90;
      for (let i = 0; i < count; i++) {
        const col = COLORS[~~(Math.random() * COLORS.length)];
        let sz = 3 + Math.random() * 18;
        if (sz > 14 && Math.random() > 0.2) sz = 4 + Math.random() * 10;
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5,
          sz, szBase: sz,
          col, a: 0.3 + Math.random() * 0.5, aBase: 0.3 + Math.random() * 0.5,
          shape: SHAPES[~~(Math.random() * SHAPES.length)],
          rot: Math.random() * 6.28, rotV: (Math.random() - 0.5) * 0.03,
          grav: -0.01 - Math.random() * 0.02,
          oscAmp: 0.4 + Math.random() * 1.0,
          oscFreq: 0.3 + Math.random() * 0.6,
          oscPhase: Math.random() * 6.28,
          mass: 0.5 + Math.random() * 1.5,
          burst: false, life: 9999,
        });
      }
    }

    function burst(cx: number, cy: number, n: number) {
      for (let i = 0; i < n; i++) {
        const ang = (6.2832 / n) * i + (Math.random() - 0.5) * 0.6;
        const spd = 3 + Math.random() * 5;
        const col = COLORS[~~(Math.random() * COLORS.length)];
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          sz: 3 + Math.random() * 10, szBase: 2,
          col, a: 0.9, aBase: 0,
          shape: SHAPES[~~(Math.random() * SHAPES.length)],
          rot: Math.random() * 6.28, rotV: (Math.random() - 0.5) * 0.08,
          grav: -0.015, oscAmp: 0.5, oscFreq: 0.5, oscPhase: Math.random() * 6.28,
          mass: 1, burst: true, life: 80,
        });
      }
    }

    function update() {
      const t = performance.now() * 0.001;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += p.grav;
        p.vx += Math.sin(t * p.oscFreq + p.oscPhase) * p.oscAmp * 0.025;
        p.vy += Math.cos(t * p.oscFreq * 0.7 + p.oscPhase + 2.0) * p.oscAmp * 0.012;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dd = dx * dx + dy * dy;
        if (dd < MOUSE_RADIUS * MOUSE_RADIUS && dd > 1) {
          const d = Math.sqrt(dd);
          const f = ((MOUSE_RADIUS - d) / MOUSE_RADIUS) ** 2 * 6;
          const ang = Math.atan2(dy, dx);
          p.vx += Math.cos(ang) * f * p.mass * 0.12;
          p.vy += Math.sin(ang) * f * p.mass * 0.12;
          p.a = Math.min(p.aBase + f * 0.08, 1);
          p.sz = p.szBase + f * 1.5;
        } else {
          p.a += (p.aBase - p.a) * 0.06;
          p.sz += (p.szBase - p.sz) * 0.06;
        }

        p.vx *= 0.985;
        p.vy *= 0.985;
        const spd = p.vx * p.vx + p.vy * p.vy;
        if (spd > 25) {
          const s = Math.sqrt(spd);
          p.vx = (p.vx / s) * 5;
          p.vy = (p.vy / s) * 5;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;

        const m = p.sz + 30;
        if (p.x < -m) p.x += W + m * 2;
        if (p.x > W + m) p.x -= W + m * 2;
        if (p.y < -m) p.y += H + m * 2;
        if (p.y > H + m) p.y -= H + m * 2;

        if (p.burst) {
          p.life--;
          p.a *= 0.96;
          if (p.life <= 0) particles.splice(i, 1);
        }
      }
    }

    function drawLines() {
      const max = 130;
      const maxSq = max * max;
      const len = Math.min(particles.length, 80);
      for (let i = 0; i < len; i++) {
        const a = particles[i];
        for (let j = i + 1; j < len; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (dx > max || dx < -max || dy > max || dy < -max) continue;
          const dd = dx * dx + dy * dy;
          if (dd < maxSq) {
            const dist = Math.sqrt(dd);
            const op = (1 - dist / max) * 0.18;
            const r = (a.col[0] + b.col[0]) >> 1;
            const g = (a.col[1] + b.col[1]) >> 1;
            const bl = (a.col[2] + b.col[2]) >> 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.strokeStyle = `rgba(${r},${g},${bl},${op})`;
            ctx!.lineWidth = 0.8;
            ctx!.stroke();
          }
        }
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      drawLines();
      for (const p of particles) {
        if (p.a < 0.01) continue;
        const rgb = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = p.a;
        switch (p.shape) {
          case "circle":
            ctx!.beginPath();
            ctx!.arc(0, 0, p.sz, 0, 6.2832);
            ctx!.fillStyle = rgb;
            ctx!.fill();
            if (p.sz > 6) {
              ctx!.globalAlpha = p.a * 0.12;
              ctx!.beginPath();
              ctx!.arc(0, 0, p.sz * 2.2, 0, 6.2832);
              ctx!.fill();
            }
            break;
          case "rect": {
            const s = p.sz * 1.7;
            const r = p.sz * 0.35;
            ctx!.beginPath();
            rrect(ctx!, -s / 2, -s / 2, s, s, r);
            ctx!.fillStyle = rgb;
            ctx!.fill();
            break;
          }
          case "ring":
            ctx!.beginPath();
            ctx!.arc(0, 0, p.sz, 0, 6.2832);
            ctx!.strokeStyle = rgb;
            ctx!.lineWidth = Math.max(1.5, p.sz * 0.2);
            ctx!.stroke();
            break;
          case "diamond": {
            const d = p.sz * 1.3;
            ctx!.beginPath();
            ctx!.moveTo(0, -d);
            ctx!.lineTo(d * 0.6, 0);
            ctx!.lineTo(0, d);
            ctx!.lineTo(-d * 0.6, 0);
            ctx!.closePath();
            ctx!.fillStyle = rgb;
            ctx!.fill();
            break;
          }
        }
        ctx!.restore();
      }
    }

    function loop() {
      update();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    // Events
    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
    };
    const onTouchEnd = () => { setTimeout(() => { mouse.x = -9999; mouse.y = -9999; }, 200); };
    const onClick = (e: MouseEvent) => { burst(e.clientX, e.clientY, 14); };
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { sizeCanvas(); spawnParticles(); }, 200); };

    sizeCanvas();
    spawnParticles();
    loop();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ pointerEvents: "auto" }}
    />
  );
}

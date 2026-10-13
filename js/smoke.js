// js/smoke.js — Sistema de partículas de fumaça vermelha no drag

import {
  smokeCanvas, smokeCtx,
  smokeParticles, smokeAnimFrame,
  lastSmokeEmitTime, lastSmokePos,
  setSmokeParticles, setSmokeAnimFrame,
  setLastSmokeEmitTime, setLastSmokePos
} from './state.js';

export function initSmokeCanvas() {
  if (!smokeCanvas) return;
  const resize = () => {
    smokeCanvas.width  = window.innerWidth;
    smokeCanvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();
}

export function emitSmoke(x, y) {
  if (!smokeCtx || !x || !y) return;
  const now  = performance.now();
  const dist = Math.hypot(x - lastSmokePos.x, y - lastSmokePos.y);
  if (now - lastSmokeEmitTime < 28 && dist < 10) return;
  setLastSmokeEmitTime(now);
  setLastSmokePos({ x, y });

  const count = dist > 24 ? 2 : 1;
  const newParticles = [...smokeParticles];
  for (let i = 0; i < count; i++) {
    newParticles.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.32 - Math.random() * 0.42,
      initialSize: 20 + Math.random() * 16,
      currentSize: 20 + Math.random() * 16,
      maxSize: 75 + Math.random() * 32,
      alpha: 0,
      targetAlpha: 0.38 + Math.random() * 0.16,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.012,
      birthTime: now,
      lifespan: 1000
    });
  }
  setSmokeParticles(newParticles);
  if (!smokeAnimFrame) setSmokeAnimFrame(requestAnimationFrame(renderSmoke));
}

function renderSmoke(now) {
  if (!smokeCtx) return;
  smokeCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);

  const alive = [];
  for (const p of smokeParticles) {
    const progress = (now - p.birthTime) / p.lifespan;
    if (progress >= 1) continue;

    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotSpeed;
    p.currentSize = p.initialSize + (p.maxSize - p.initialSize) * Math.sin(progress * Math.PI * 0.5);
    p.alpha = progress < 0.1
      ? (progress / 0.1) * p.targetAlpha
      : p.targetAlpha * (1 - (progress - 0.1) / 0.9);

    smokeCtx.save();
    smokeCtx.translate(p.x, p.y);
    smokeCtx.rotate(p.rotation);

    const g = smokeCtx.createRadialGradient(0, 0, 0, 0, 0, p.currentSize);
    g.addColorStop(0,    `rgba(239,68,68,${p.alpha * 0.55})`);
    g.addColorStop(0.3,  `rgba(220,38,38,${p.alpha * 0.38})`);
    g.addColorStop(0.65, `rgba(159,18,57,${p.alpha * 0.15})`);
    g.addColorStop(1,    'rgba(136,19,55,0)');

    smokeCtx.fillStyle = g;
    smokeCtx.beginPath();
    smokeCtx.arc(0, 0, p.currentSize, 0, Math.PI * 2);
    smokeCtx.fill();
    smokeCtx.restore();
    alive.push(p);
  }

  setSmokeParticles(alive);
  setSmokeAnimFrame(alive.length > 0 ? requestAnimationFrame(renderSmoke) : null);
}

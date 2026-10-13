// js/effects.js — Efeitos visuais: caveira do título, claquete/estrelas, skull do board

import { clapperIcon, starsBurst, boardSkullWatermark, setClapperInterval } from './state.js';

// ── Caveira do título ─────────────────────────────────────────────────────────

export function setupTitleSkull() {
  const skull = document.getElementById('titleSkullIcon');
  if (!skull) return;

  const blink = () => {
    if (skull.classList.contains('blinking')) return;
    skull.classList.add('blinking');
    setTimeout(() => skull.classList.remove('blinking'), 900);
  };

  skull.addEventListener('click', () => {
    blink();
    try { if (navigator.vibrate) navigator.vibrate([35, 40, 35]); } catch {}
  });

  setInterval(blink, 45000); // pisca a cada 45s
}

// ── Caveira do board (aparece ao soltar drag) ─────────────────────────────────

export function triggerSkullAnimation() {
  if (!boardSkullWatermark) return;
  boardSkullWatermark.classList.remove('animate-skull');
  void boardSkullWatermark.offsetWidth; // force reflow
  boardSkullWatermark.classList.add('animate-skull');
}

// ── Claquete e explosão de estrelas ──────────────────────────────────────────

export function setupClapperboard() {
  if (!clapperIcon) return;
  clapperIcon.addEventListener('click', triggerClapperAnimation);
  setClapperInterval(setInterval(triggerClapperAnimation, 30000));
  setTimeout(triggerClapperAnimation, 800);
}

function triggerClapperAnimation() {
  if (clapperIcon.classList.contains('clapping')) return;
  clapperIcon.classList.add('clapping');
  setTimeout(createStarBurst, 540);
  setTimeout(() => clapperIcon.classList.remove('clapping'), 950);
}

function createStarBurst() {
  if (!starsBurst) return;
  starsBurst.innerHTML = '';
  const colors = ['#a855f7', '#c084fc', '#ffd700', '#fff34a', '#ffffff', '#e879f9'];

  for (let i = 0; i < 8; i++) {
    const size  = 12 + Math.floor(Math.random() * 8);
    const color = colors[i % colors.length];
    const star  = document.createElement('div');
    star.className = 'star-particle';
    star.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="display:block"><path d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8Z"/></svg>`;

    const angle = Math.PI / 180 * (-75 + i * 22 + (Math.random() * 8 - 4));
    const dist  = 20 + Math.random() * 26;
    star.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    star.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
    star.style.setProperty('--rot', `${Math.floor(Math.random() * 180)}deg`);
    starsBurst.appendChild(star);
  }

  setTimeout(() => { starsBurst.innerHTML = ''; }, 900);
}

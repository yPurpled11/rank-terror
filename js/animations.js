// js/animations.js — Animações de entrada do ranking e da galeria de filmes com scroll trigger e opção de pular via Espaço

import { areAnimsEnabled } from './animToggle.js';

let isIntroActive = false;
let activeTimeouts = [];
let poolObserver = null;
let hasPoolAnimated = false;

function safeTimeout(fn, ms) {
  const id = setTimeout(() => {
    activeTimeouts = activeTimeouts.filter(t => t !== id);
    fn();
  }, ms);
  activeTimeouts.push(id);
  return id;
}

function handleSkipKey(e) {
  if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
    // Se o usuário estiver digitando em um input ou textarea, não intercepta
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }
    e.preventDefault();
    skipIntroAnimation();
  }
}

/**
 * Pula todas as animações imediatamente e revela todos os itens
 */
export function skipIntroAnimation() {
  if (!isIntroActive && !poolObserver && !hasPoolAnimated) return;
  isIntroActive = false;
  hasPoolAnimated = true;

  if (poolObserver) {
    poolObserver.disconnect();
    poolObserver = null;
  }

  // Cancela todos os timers de animação em andamento
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];

  // Oculta e remove listener do indicador de pular
  const hint = document.getElementById('skipIntroHint');
  if (hint) {
    hint.classList.remove('visible');
  }
  window.removeEventListener('keydown', handleSkipKey);

  // Garante que todas as linhas do ranking estejam visíveis
  const rows = document.querySelectorAll('.board-wrapper .tier-row');
  rows.forEach(row => {
    row.classList.add('tier-row-visible');
  });

  // Revela todas as imagens do ranking e da reserva
  const pool = document.getElementById('imagePool');
  if (pool) {
    pool.classList.remove('pool-intro-flash');
    pool.classList.remove('pool-awaiting-scroll');
  }

  document.querySelectorAll('.tier-item').forEach(item => {
    item.classList.remove('pool-item-entering');
    item.classList.add('pool-item-entered');
    item.style.animationDelay = '';
  });

  // Remove estado de introdução do body
  document.body.classList.remove('intro-animating');
}

/**
 * Anima as imagens do ranking de cima para baixo, da esquerda para a direita,
 * usando a mesma animação de revelação dos filmes restantes (poolItemReveal).
 */
export function animateBoardIntro() {
  const isDesktop = window.matchMedia('(min-width: 993px)').matches;

  // No celular ou se desativado: revela tudo imediatamente
  if (!isDesktop || !areAnimsEnabled()) {
    finishBoardIntro();
    return;
  }

  const rows = Array.from(document.querySelectorAll('#tierlistBoard .tier-row, .board-wrapper .tier-row'));
  rows.forEach(row => row.classList.add('tier-row-visible'));

  // Coleta os itens rank a rank (de cima para baixo, da esquerda para a direita)
  const rankedItems = [];
  rows.forEach(row => {
    const items = Array.from(row.querySelectorAll('.tier-dropzone .tier-item'));
    if (items.length > 0) {
      rankedItems.push({ row, items });
    }
  });

  const totalItems = rankedItems.reduce((acc, curr) => acc + curr.items.length, 0);
  if (totalItems === 0) {
    finishBoardIntro();
    return;
  }

  isIntroActive = true;

  // Exibe o indicador central inferior de pular animação
  const hint = document.getElementById('skipIntroHint');
  if (hint) {
    hint.classList.add('visible');
    hint.onclick = () => skipIntroAnimation();
  }
  window.addEventListener('keydown', handleSkipKey);

  let currentDelay = 0;
  const ITEM_STAGGER = 0.055; // 55ms entre itens do mesmo rank
  const ROW_GAP      = 0.12;  // 120ms de intervalo suave entre um rank e o próximo

  const allBoardItems = [];

  rankedItems.forEach(({ items }) => {
    items.forEach(item => {
      allBoardItems.push(item);
      item.classList.add('pool-item-entering');
      item.style.animationDelay = `${currentDelay.toFixed(3)}s`;
      currentDelay += ITEM_STAGGER;
    });
    currentDelay += ROW_GAP;
  });

  const totalDuration = (currentDelay + 0.4) * 1000;

  safeTimeout(() => {
    if (!isIntroActive) return;
    allBoardItems.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.classList.add('pool-item-entered');
      item.style.animationDelay = '';
    });
    finishBoardIntro();
  }, totalDuration);
}

// Alias de retrocompatibilidade
export const animateTierRows = animateBoardIntro;

function finishBoardIntro() {
  isIntroActive = false;
  activeTimeouts = [];

  const hint = document.getElementById('skipIntroHint');
  if (hint) {
    hint.classList.remove('visible');
  }
  window.removeEventListener('keydown', handleSkipKey);

  document.body.classList.remove('intro-animating');

  document.querySelectorAll('#tierlistBoard .tier-item').forEach(item => {
    item.classList.remove('pool-item-entering');
    item.classList.add('pool-item-entered');
    item.style.animationDelay = '';
  });
}

/**
 * Configura o observador de scroll para a galeria de filmes não rankeados.
 * A animação só toca quando o usuário descer até ela e conseguir vê-la.
 */
export function setupPoolScrollObserver() {
  const isDesktop = window.matchMedia('(min-width: 993px)').matches;
  const pool = document.getElementById('imagePool');
  const poolSection = document.getElementById('poolSection') || pool;
  if (!pool || !poolSection) return;

  hasPoolAnimated = false;

  if (!isDesktop || !areAnimsEnabled()) {
    pool.classList.remove('pool-awaiting-scroll');
    pool.querySelectorAll('.tier-item').forEach(item => {
      item.classList.add('pool-item-entered');
    });
    return;
  }

  const poolItems = pool.querySelectorAll('.tier-item');
  if (poolItems.length === 0) {
    pool.classList.remove('pool-awaiting-scroll');
    return;
  }

  // Define estado aguardando scroll do usuário
  pool.classList.add('pool-awaiting-scroll');

  if (poolObserver) {
    poolObserver.disconnect();
    poolObserver = null;
  }

  if ('IntersectionObserver' in window) {
    poolObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasPoolAnimated) {
          hasPoolAnimated = true;
          if (poolObserver) {
            poolObserver.disconnect();
            poolObserver = null;
          }
          animatePoolIntro();
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -30px 0px',
      threshold: 0.08
    });

    poolObserver.observe(pool);
  } else {
    // Fallback caso não suporte IntersectionObserver
    animatePoolIntro();
  }
}

/**
 * Animação em onda diagonal para os itens não rankeados da galeria.
 */
export function animatePoolIntro() {
  hasPoolAnimated = true;
  if (poolObserver) {
    poolObserver.disconnect();
    poolObserver = null;
  }

  const pool = document.getElementById('imagePool');
  if (!pool) return;

  pool.classList.remove('pool-awaiting-scroll');

  const items = Array.from(pool.querySelectorAll('.tier-item'));
  if (items.length === 0) return;

  const isDesktop = window.matchMedia('(min-width: 993px)').matches;
  if (!isDesktop || !areAnimsEnabled()) {
    items.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.classList.add('pool-item-entered');
      item.style.animationDelay = '';
    });
    return;
  }

  const poolRect = pool.getBoundingClientRect();

  // Índice diagonal normalizado por posição real de cada item no layout
  const diagonals = items.map(item => {
    const r = item.getBoundingClientRect();
    const cx = (r.left + r.width / 2 - poolRect.left) / (poolRect.width || 1);
    const cy = (r.top + r.height / 2 - poolRect.top) / (poolRect.height || 1);
    return cx + cy; // range aprox: 0 (topo esq) até ~2 (baixo dir)
  });

  const minD = Math.min(...diagonals);
  const maxD = Math.max(...diagonals);
  const range = (maxD - minD) || 1;
  const WAVE_DURATION = 1.1; // Duração da onda diagonal (1.1s onda + 0.4s fade = 1.5s total)

  items.forEach((item, i) => {
    const norm = (diagonals[i] - minD) / range;
    const delay = norm * WAVE_DURATION;
    item.classList.add('pool-item-entering');
    item.style.animationDelay = `${delay.toFixed(3)}s`;
  });

  const totalDuration = (WAVE_DURATION + 0.4) * 1000; // 1.5s

  safeTimeout(() => {
    items.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.classList.add('pool-item-entered');
      item.style.animationDelay = '';
    });

    // Borda laranja brilhante pulsa no lugar da pontilhada por 1 segundo
    pool.classList.add('pool-intro-flash');

    safeTimeout(() => {
      pool.classList.remove('pool-intro-flash');
    }, 1000);
  }, totalDuration);
}

// js/animations.js — Animações de entrada dos ranks e da galeria de filmes, com opção de pular via Espaço

let isIntroActive = false;
let activeTimeouts = [];

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

export function skipIntroAnimation() {
  if (!isIntroActive) return;
  isIntroActive = false;

  // Cancela todos os timers de animação em andamento
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];

  // Oculta e remove listener do indicador
  const hint = document.getElementById('skipIntroHint');
  if (hint) {
    hint.classList.remove('visible');
  }
  window.removeEventListener('keydown', handleSkipKey);

  // Restaura todos os ranks para visíveis e no lugar normal imediatamente
  const rows = document.querySelectorAll('.board-wrapper .tier-row');
  rows.forEach(row => {
    row.classList.add('tier-row-visible');
    const label = row.querySelector('.tier-label');
    const dropzone = row.querySelector('.tier-dropzone');
    if (label) {
      label.classList.remove('tier-label-intro');
      row.style.removeProperty('--tier-center-offset');
    }
    if (dropzone) {
      dropzone.classList.remove('tier-dropzone-intro');
      dropzone.style.clipPath = '';
    }
  });

  // Restaura todas as imagens da galeria (pool) para visíveis imediatamente
  const pool = document.getElementById('imagePool');
  if (pool) {
    pool.classList.remove('pool-intro-flash');
    const items = pool.querySelectorAll('.tier-item');
    items.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.classList.add('pool-item-entered');
      item.style.animationDelay = '';
    });
  }

  // Remove estado de introdução do body
  document.body.classList.remove('intro-animating');
}

export function animateTierRows() {
  const isDesktop = window.matchMedia('(min-width: 993px)').matches;

  // No celular: não roda as animações de entrada
  if (!isDesktop) {
    document.body.classList.remove('intro-animating');
    return;
  }

  const rows = Array.from(document.querySelectorAll('.board-wrapper .tier-row'));
  if (rows.length === 0) {
    animatePoolIntro();
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

  const STAGGER      = 1000; // 1s entre o início de cada rank
  const LABEL_DUR    = 500; // 1s de deslize do label (centro → esquerda)
  const DROPZONE_DUR = 1000; // 1s de expansão da dropzone vazia (esquerda → direita)

  rows.forEach((row, i) => {
    const label    = row.querySelector('.tier-label');
    const dropzone = row.querySelector('.tier-dropzone');
    const start    = i * STAGGER;

    // Início da animação do rank i
    safeTimeout(() => {
      if (!isIntroActive) return;

      // Torna a linha visível no board
      row.classList.add('tier-row-visible');

      // Dropzone fica oculta no primeiro segundo enquanto o label desliza
      if (dropzone) {
        dropzone.style.clipPath = 'inset(0 100% 0 0)';
      }

      // Label aparece no centro e desliza para a esquerda durante 1s
      if (label) {
        const centerOffset = (row.offsetWidth / 2) - (label.offsetWidth / 2);
        row.style.setProperty('--tier-center-offset', `${centerOffset}px`);
        label.classList.add('tier-label-intro');
      }
    }, start);

    // Após 1s do início deste rank: dropzone começa a expandir da esquerda para a direita (1s)
    safeTimeout(() => {
      if (!isIntroActive) return;

      if (dropzone) {
        dropzone.style.clipPath = '';
        dropzone.classList.add('tier-dropzone-intro');
      }
    }, start + LABEL_DUR);

    // Após 2s do início deste rank: rank concluído, limpa classes de animação
    safeTimeout(() => {
      if (!isIntroActive) return;

      label?.classList.remove('tier-label-intro');
      dropzone?.classList.remove('tier-dropzone-intro');
    }, start + LABEL_DUR + DROPZONE_DUR + 60);
  });

  // Tempo total para todos os ranks completarem
  const totalTierTime = (rows.length - 1) * STAGGER + LABEL_DUR + DROPZONE_DUR + 100;

  // Inicia a galeria após o término de todos os ranks
  safeTimeout(() => {
    if (!isIntroActive) return;
    animatePoolIntro();
  }, totalTierTime);
}

export function animatePoolIntro() {
  const isDesktop = window.matchMedia('(min-width: 993px)').matches;
  if (!isDesktop) {
    document.body.classList.remove('intro-animating');
    return;
  }

  const pool = document.getElementById('imagePool');
  if (!pool) {
    finishIntro();
    return;
  }

  const items = Array.from(pool.querySelectorAll('.tier-item'));
  if (items.length === 0) {
    finishIntro();
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
    if (!isIntroActive) return;

    items.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.classList.add('pool-item-entered');
      item.style.animationDelay = '';
    });

    // Borda laranja brilhante pulsa no lugar da pontilhada por 1 segundo
    pool.classList.add('pool-intro-flash');

    safeTimeout(() => {
      pool.classList.remove('pool-intro-flash');
      finishIntro();
    }, 1000);
  }, totalDuration);
}

function finishIntro() {
  isIntroActive = false;
  activeTimeouts = [];

  const hint = document.getElementById('skipIntroHint');
  if (hint) {
    hint.classList.remove('visible');
  }
  window.removeEventListener('keydown', handleSkipKey);

  document.body.classList.remove('intro-animating');
}

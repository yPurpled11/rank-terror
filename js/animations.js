// js/animations.js — Animações de entrada dos ranks e da galeria de filmes

export function animateTierRows() {
  if (window.matchMedia('(max-width: 992px)').matches) { animatePoolIntro(); return; }

  const pool = document.getElementById('imagePool');
  const rows = Array.from(document.querySelectorAll('.board-wrapper .tier-row'));

  if (pool) pool.style.opacity = '0';

  if (rows.length === 0) {
    if (pool) pool.style.opacity = '';
    animatePoolIntro();
    return;
  }

  const STAGGER      = 1000;
  const LABEL_DUR    = 1000;
  const DROPZONE_DUR = 1000;
  const CLEANUP      = 80;

  // Oculta labels e dropzones antes de animar
  rows.forEach(row => {
    const label    = row.querySelector('.tier-label');
    const dropzone = row.querySelector('.tier-dropzone');
    if (label)    label.style.opacity    = '0';
    if (dropzone) dropzone.style.opacity = '0';
  });

  // Aguarda imagens do pool carregarem antes de iniciar
  const imgs = pool ? Array.from(pool.querySelectorAll('img')) : [];
  const imgReady = imgs.length
    ? Promise.race([
        Promise.all(imgs.map(img =>
          img.complete ? Promise.resolve()
            : new Promise(res => {
                img.addEventListener('load',  res, { once: true });
                img.addEventListener('error', res, { once: true });
              })
        )),
        new Promise(res => setTimeout(res, 3000))
      ])
    : Promise.resolve();

  imgReady.then(() => {
    rows.forEach((row, i) => {
      const label    = row.querySelector('.tier-label');
      const dropzone = row.querySelector('.tier-dropzone');
      const start    = i * STAGGER;

      // Fase 1: label aparece no centro e desliza para esquerda
      setTimeout(() => {
        if (!label) return;
        const offset = (row.offsetWidth / 2) - (label.offsetWidth / 2);
        row.style.setProperty('--tier-center-offset', offset + 'px');
        label.style.opacity = '';
        label.classList.add('tier-label-intro');
      }, start);

      // Fase 2: dropzone expande da esquerda para direita
      setTimeout(() => {
        if (!dropzone) return;
        dropzone.style.opacity = '';
        dropzone.classList.add('tier-dropzone-intro');
      }, start + LABEL_DUR);

      // Limpeza
      setTimeout(() => {
        label?.classList.remove('tier-label-intro');
        dropzone?.classList.remove('tier-dropzone-intro');
      }, start + LABEL_DUR + DROPZONE_DUR + CLEANUP);
    });

    const total = (rows.length - 1) * STAGGER + LABEL_DUR + DROPZONE_DUR + CLEANUP;
    setTimeout(() => {
      if (pool) pool.style.opacity = '';
      animatePoolIntro();
    }, total);
  });
}

export function animatePoolIntro() {
  if (window.matchMedia('(max-width: 992px)').matches) return;

  const pool  = document.getElementById('imagePool');
  if (!pool) return;

  const items = Array.from(pool.querySelectorAll('.tier-item'));
  if (!items.length) return;

  const poolRect = pool.getBoundingClientRect();

  // Índice diagonal normalizado por posição real no layout
  const diagonals = items.map(item => {
    const r  = item.getBoundingClientRect();
    return ((r.left + r.width  / 2 - poolRect.left) / poolRect.width)
         + ((r.top  + r.height / 2 - poolRect.top)  / poolRect.height);
  });

  const minD  = Math.min(...diagonals);
  const range = (Math.max(...diagonals) - minD) || 1;
  const WAVE  = 1.1; // segundos

  items.forEach((item, i) => {
    item.classList.add('pool-item-entering');
    item.style.animationDelay = ((diagonals[i] - minD) / range * WAVE).toFixed(3) + 's';
  });

  setTimeout(() => {
    items.forEach(item => {
      item.classList.remove('pool-item-entering');
      item.style.animationDelay = '';
    });
    pool.classList.add('pool-intro-flash');
    setTimeout(() => pool.classList.remove('pool-intro-flash'), 1000);
  }, (WAVE + 0.4) * 1000);
}

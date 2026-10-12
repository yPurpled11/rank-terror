// DOM Elements
const saveRankingBtn = document.getElementById('saveRankingBtn');
const saveRankingText = document.getElementById('saveRankingText');
const resetAllBtn = document.getElementById('resetAllBtn');
const exportImageBtn = document.getElementById('exportImageBtn');

const tierlistBoard = document.getElementById('tierlistBoard');
const boardSkullWatermark = document.getElementById('boardSkullWatermark');
const imagePool = document.getElementById('imagePool');
const poolPlaceholder = document.getElementById('poolPlaceholder');
const poolCounter = document.getElementById('poolCounter');
const allDropzones = document.querySelectorAll('.tier-dropzone');

// Clapperboard & Stars
const clapperIcon = document.getElementById('clapperIcon');
const starsBurst = document.getElementById('starsBurst');

// Lightbox Modal
const imageModal = document.getElementById('imageModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalImg = document.getElementById('modalImg');
const modalCaption = document.getElementById('modalCaption');

// Confirmation Reset Modal
const confirmResetModal = document.getElementById('confirmResetModal');
const confirmResetBackdrop = document.getElementById('confirmResetBackdrop');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const proceedResetBtn = document.getElementById('proceedResetBtn');

// Reddish Smoke Particle Canvas
const smokeCanvas = document.getElementById('smokeCanvas');
const smokeCtx = smokeCanvas ? smokeCanvas.getContext('2d') : null;
let smokeParticles = [];
let smokeAnimFrame = null;
let lastSmokeEmitTime = 0;
let lastSmokePos = { x: -999, y: -999 };

let draggedItem = null;
let isDraggingActive = false;
let imageIdCounter = 0;
let clapperInterval = null;
let currentActiveZone = null;
const activeRowAnimations = new WeakMap();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initSmokeCanvas();
  setupEventListeners();
  setupDropzones();
  setupClapperboard();
  setupModalEvents();
  setupConfirmModalEvents();
  await loadRankingData();
  updatePoolState();
});

// Setup Main Event Listeners
function setupEventListeners() {
  if (saveRankingBtn) {
    saveRankingBtn.addEventListener('click', saveRankingToDatabase);
  }

  resetAllBtn.addEventListener('click', () => {
    const rankedItems = tierlistBoard.querySelectorAll('.tier-item');
    if (rankedItems.length === 0) return;
    openConfirmResetModal();
  });

  exportImageBtn.addEventListener('click', exportTierList);
}

/**
 * Loads ranking data from Vercel cloud API (/api/ranking), localStorage, or ranking-data.js
 */
async function loadRankingData() {
  let dataToLoad = null;

  // 1. Tenta ler do localStorage primeiro para proteger contra resets
  let localSaved = null;
  try {
    const saved = localStorage.getItem('ranking_terror_state');
    if (saved) {
      localSaved = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Erro ao ler localStorage:', e);
  }

  // Função auxiliar para verificar se o estado possui filmes ranqueados
  function hasRankedItems(state) {
    if (!state || !state.tiers) return false;
    return Object.values(state.tiers).some(items => Array.isArray(items) && items.length > 0);
  }

  // 2. Tenta carregar do Vercel Blob via API
  try {
    const res = await fetch('/api/ranking', { cache: 'no-store' });
    if (res.ok) {
      const cloudData = await res.json();
      // Só substitui se o dado da nuvem for de fato um salvamento persistido (Blob/Upstash) ou se tiver itens ranqueados
      if (cloudData && (cloudData._source === 'vercel-blob' || cloudData._source === 'upstash' || (!cloudData.isDefault && hasRankedItems(cloudData)))) {
        dataToLoad = cloudData;
        try {
          localStorage.setItem('ranking_terror_state', JSON.stringify(cloudData));
        } catch (e) {}
      }
    }
  } catch (err) {
    // API indisponível ou offline
  }

  // 3. Se a nuvem não tinha salvamento ou retornou o padrão vazio, mas o localStorage tem o ranking do usuário: PRESERVA O LOCALSTORAGE!
  if (!dataToLoad && localSaved && hasRankedItems(localSaved)) {
    dataToLoad = localSaved;
  }

  // 4. Fallback final para localSaved ou RANKING_DATA padrão
  if (!dataToLoad) {
    dataToLoad = localSaved || window.RANKING_DATA;
  }

  if (!dataToLoad) return;

  // Clear existing items
  document.querySelectorAll('.tier-item').forEach(el => el.remove());

  // Set tier names
  if (dataToLoad.tierNames) {
    Object.entries(dataToLoad.tierNames).forEach(([tierId, name]) => {
      const row = document.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      if (row) {
        const labelSpan = row.querySelector('.tier-label span');
        if (labelSpan) labelSpan.textContent = name;
      }
    });
  }

  // Populate ranked tiers
  if (dataToLoad.tiers) {
    Object.entries(dataToLoad.tiers).forEach(([tierId, items]) => {
      const zone = document.querySelector(`.tier-dropzone[data-zone-id="${tierId}"]`);
      if (zone && Array.isArray(items)) {
        items.forEach(imgData => {
          const src = typeof imgData === 'string' ? imgData : imgData.src;
          const title = typeof imgData === 'string' ? extractTitle(imgData) : (imgData.title || extractTitle(src));
          createTierItem(src, title, zone, src);
        });
      }
    });
  }

  // Populate unranked gallery
  if (dataToLoad.unranked && Array.isArray(dataToLoad.unranked)) {
    dataToLoad.unranked.forEach(imgData => {
      const src = typeof imgData === 'string' ? imgData : imgData.src;
      const title = typeof imgData === 'string' ? extractTitle(imgData) : (imgData.title || extractTitle(src));
      createTierItem(src, title, imagePool, src);
    });
  }

  // Garante que novas imagens oficiais adicionadas em window.RANKING_DATA apareçam na reserva mesmo se havia ranking anterior salvo
  const loadedKeys = new Set();
  document.querySelectorAll('.tier-item').forEach(el => {
    const rel = el.dataset.relPath || el.querySelector('img')?.getAttribute('src');
    if (rel) {
      loadedKeys.add(decodeURIComponent(rel.split('/').pop().split('\\').pop().toLowerCase().trim()));
    }
  });

  if (window.RANKING_DATA && Array.isArray(window.RANKING_DATA.unranked)) {
    window.RANKING_DATA.unranked.forEach(imgData => {
      const src = typeof imgData === 'string' ? imgData : imgData.src;
      const key = decodeURIComponent(src.split('/').pop().split('\\').pop().toLowerCase().trim());
      if (!loadedKeys.has(key)) {
        const title = typeof imgData === 'string' ? extractTitle(imgData) : (imgData.title || extractTitle(src));
        createTierItem(src, title, imagePool, src);
        loadedKeys.add(key);
      }
    });
  }

  // Ordena a reserva em ordem numérica
  sortPoolInOrder();
  updatePoolState();
}

/**
 * Salva o ranking no banco de dados na nuvem (Vercel Blob) e localmente
 */
async function saveRankingToDatabase() {
  if (!saveRankingBtn) return;
  const state = getCurrentRankingState();

  // 1. Salva imediatamente no localStorage do navegador para persistência local
  try {
    localStorage.setItem('ranking_terror_state', JSON.stringify(state));
  } catch (e) {
    console.warn('Erro ao salvar no localStorage:', e);
  }

  // Feedback visual de salvamento em andamento
  saveRankingBtn.classList.add('btn-saving');
  saveRankingBtn.classList.remove('btn-saved', 'btn-error');
  if (saveRankingText) saveRankingText.textContent = 'Salvando...';

  try {
    const res = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });

    const data = await res.json().catch(() => ({}));

    saveRankingBtn.classList.remove('btn-saving');

    if (res.ok && data.provider === 'vercel-blob') {
      saveRankingBtn.classList.add('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvo no Blob!';
    } else if (res.ok && data.needsToken) {
      saveRankingBtn.classList.add('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvo no Navegador!';
    } else {
      saveRankingBtn.classList.add('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvo Localmente!';
    }

    setTimeout(() => {
      saveRankingBtn.classList.remove('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvar Ranking';
    }, 2800);
  } catch (err) {
    console.warn('Servidor offline ou sem conexão. Salvo localmente:', err);
    saveRankingBtn.classList.remove('btn-saving');
    saveRankingBtn.classList.add('btn-saved');
    if (saveRankingText) saveRankingText.textContent = 'Salvo no Navegador!';
    setTimeout(() => {
      saveRankingBtn.classList.remove('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvar Ranking';
    }, 2800);
  }
}

/**
 * Extracts clean title from path, removing numbers like "1. ", "7.1 . ", "01 - "
 */
function extractTitle(path) {
  if (!path) return 'Imagem';
  const filename = path.split('/').pop().split('\\').pop();
  let clean = decodeURIComponent(filename).replace(/\.[^/.]+$/, "");
  // Remove numbers and leading separators at the beginning (e.g. "1. ", "7.1 . ", "01. ")
  clean = clean.replace(/^[\d\.]+\s*[\.\-_]?\s*/, "");
  return clean.trim();
}

/**
 * Extracts numeric sorting order from filename (e.g. "1. A Coisa.jpg" -> 1, "7.1 . Criatura..." -> 7.1)
 */
function extractOrder(path) {
  if (!path) return 9999;
  const filename = path.split('/').pop().split('\\').pop();
  const clean = decodeURIComponent(filename);
  const match = clean.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 9999;
}

/**
 * Sorts all items inside imagePool in ascending numerical order
 */
function sortPoolInOrder() {
  if (!imagePool) return;
  const items = Array.from(imagePool.querySelectorAll('.tier-item'));
  if (items.length <= 1) return;

  items.sort((a, b) => {
    const orderA = a.dataset.order !== undefined && a.dataset.order !== ''
      ? parseFloat(a.dataset.order)
      : extractOrder(a.dataset.relPath || a.querySelector('img')?.getAttribute('src'));
    const orderB = b.dataset.order !== undefined && b.dataset.order !== ''
      ? parseFloat(b.dataset.order)
      : extractOrder(b.dataset.relPath || b.querySelector('img')?.getAttribute('src'));
    return orderA - orderB;
  });

  items.forEach(item => {
    imagePool.appendChild(item);
  });
}

/**
 * Serializes current board state
 */
function getCurrentRankingState() {
  const state = {
    tierNames: {},
    tiers: {},
    unranked: []
  };

  document.querySelectorAll('.tier-row').forEach(row => {
    const tierId = row.dataset.tierId;
    const labelSpan = row.querySelector('.tier-label span');
    state.tierNames[tierId] = labelSpan ? labelSpan.textContent.trim() : tierId;

    const zone = row.querySelector('.tier-dropzone');
    state.tiers[tierId] = [];
    zone.querySelectorAll('.tier-item').forEach(item => {
      const img = item.querySelector('img');
      const relPath = item.dataset.relPath || img.getAttribute('src');
      state.tiers[tierId].push({
        src: relPath,
        title: item.title.replace(' (Clique para ampliar)', '')
      });
    });
  });

  imagePool.querySelectorAll('.tier-item').forEach(item => {
    const img = item.querySelector('img');
    const relPath = item.dataset.relPath || img.getAttribute('src');
    state.unranked.push({
      src: relPath,
      title: item.title.replace(' (Clique para ampliar)', '')
    });
  });

  return state;
}

/**
 * Create draggable tier item
 */
function createTierItem(src, title = 'Imagem', container = imagePool, relPath = null) {
  const id = `item-${Date.now()}-${++imageIdCounter}`;
  
  // Ensure title has no "1. ", "2. ", "7.1 . " prefixes
  const cleanTitle = extractTitle(title);
  const pathForOrder = relPath || (typeof src === 'string' ? src : '');
  const orderNum = extractOrder(pathForOrder);

  const item = document.createElement('div');
  item.className = 'tier-item';
  item.id = id;
  item.draggable = true;
  item.title = `${cleanTitle} (Clique para ampliar)`;
  item.dataset.order = orderNum;

  if (relPath) {
    item.dataset.relPath = relPath;
  } else if (typeof src === 'string' && src.startsWith('Imagens/')) {
    item.dataset.relPath = src;
  }

  const img = document.createElement('img');
  img.src = src;
  img.alt = cleanTitle;
  img.loading = 'lazy';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'item-delete-btn';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.title = 'Devolver para a reserva';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    performWithSmoothHeightTransition(() => {
      imagePool.appendChild(item);
      sortPoolInOrder();
      updatePoolState();
    });
  });

  item.appendChild(img);
  item.appendChild(deleteBtn);

  // Click for fullscreen preview
  let startX = 0;
  let startY = 0;
  let hasMovedFar = false;

  item.addEventListener('mousedown', (e) => {
    if (e.target.closest('.item-delete-btn')) return;
    startX = e.clientX;
    startY = e.clientY;
    hasMovedFar = false;
  });

  item.addEventListener('mousemove', (e) => {
    if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
      hasMovedFar = true;
    }
  });

  item.addEventListener('click', (e) => {
    if (e.target.closest('.item-delete-btn')) return;
    if (isDraggingActive || hasMovedFar) return;
    openModal(src, cleanTitle);
  });

  setupItemDragEvents(item);

  container.appendChild(item);
  updatePoolState();
  return item;
}

// Drag Events
function setupItemDragEvents(item) {
  item.addEventListener('dragstart', (e) => {
    draggedItem = item;
    isDraggingActive = true;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    
    setTimeout(() => {
      if (draggedItem) draggedItem.style.opacity = '0.35';
    }, 0);
  });

  item.addEventListener('drag', (e) => {
    if (e.clientX > 0 && e.clientY > 0) {
      emitSmoke(e.clientX, e.clientY);
    }
  });

  item.addEventListener('dragend', () => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem.style.opacity = '1';
    }
    draggedItem = null;
    setTimeout(() => {
      isDraggingActive = false;
    }, 60);
    clearDropIndicators();
    updatePoolState();

    // 25% de chance da caveira aparecer centralizada atrás do ranking
    if (Math.random() < 0.10) {
      triggerSkullAnimation();
    }
  });

  enableTouchDrag(item);
}

// Track mouse drag across entire document to emit continuous smoke trail
document.addEventListener('dragover', (e) => {
  if (isDraggingActive && e.clientX > 0 && e.clientY > 0) {
    emitSmoke(e.clientX, e.clientY);
  }
});

// Dropzones
function setupDropzones() {
  allDropzones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (e.clientX > 0 && e.clientY > 0) {
        emitSmoke(e.clientX, e.clientY);
      }

      if (currentActiveZone && currentActiveZone !== zone) {
        currentActiveZone.classList.remove('drag-hover');
        removePlaceholder(currentActiveZone);
      }
      currentActiveZone = zone;
      zone.classList.add('drag-hover');

      const afterElement = getDragAfterElement(zone, e.clientX, e.clientY);
      updateDropPlaceholder(zone, afterElement);
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-hover');
        removePlaceholder(zone);
        if (currentActiveZone === zone) {
          currentActiveZone = null;
        }
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-hover');
      currentActiveZone = null;

      if (!draggedItem) return;

      const afterElement = getDragAfterElement(zone, e.clientX, e.clientY);

      performWithSmoothHeightTransition(() => {
        removePlaceholder(zone);
        if (afterElement == null) {
          zone.appendChild(draggedItem);
        } else {
          zone.insertBefore(draggedItem, afterElement);
        }
        updatePoolState();
      });
    });
  });
}

function getDragAfterElement(container, x, y) {
  const draggableElements = [...container.querySelectorAll('.tier-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offsetX = x - (box.left + box.width / 2);
    const offsetY = y - (box.top + box.height / 2);

    if (offsetX < 0 && Math.abs(offsetY) < box.height) {
      if (offsetX > closest.offset) {
        return { offset: offsetX, element: child };
      }
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateDropPlaceholder(zone, afterElement) {
  const row = zone.closest('.tier-row') || zone;
  const startH = row.offsetHeight;

  let placeholder = zone.querySelector('.drop-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'drop-placeholder';
  }

  const currentNext = placeholder.nextSibling;
  if (currentNext !== afterElement || placeholder.parentElement !== zone) {
    if (afterElement == null) {
      zone.appendChild(placeholder);
    } else {
      zone.insertBefore(placeholder, afterElement);
    }

    const endH = row.offsetHeight;
    if (startH !== endH) {
      animateRowHeight(row, startH, endH);
    }
  }
}

function removePlaceholder(zone) {
  const placeholder = zone.querySelector('.drop-placeholder');
  if (!placeholder) return;

  const row = zone.closest('.tier-row') || zone;
  const startH = row.offsetHeight;

  placeholder.remove();

  const endH = row.offsetHeight;
  if (startH !== endH) {
    animateRowHeight(row, startH, endH);
  }
}

function clearDropIndicators() {
  currentActiveZone = null;
  document.querySelectorAll('.tier-dropzone').forEach(z => {
    z.classList.remove('drag-hover');
    removePlaceholder(z);
  });
}

function updatePoolState() {
  const poolItems = imagePool.querySelectorAll('.tier-item');
  const count = poolItems.length;

  poolCounter.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;

  if (count === 0) {
    if (!poolPlaceholder.parentElement) {
      imagePool.appendChild(poolPlaceholder);
    }
    poolPlaceholder.style.display = 'flex';
  } else {
    poolPlaceholder.style.display = 'none';
  }
}

function enableTouchDrag(element) {
  let touchStartX = 0;
  let touchStartY = 0;
  let currentTargetZone = null;
  let ghostClone = null;
  let moved = false;

  element.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    moved = false;
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (dx > 10 || dy > 10) {
      moved = true;
      emitSmoke(touch.clientX, touch.clientY);

      if (!ghostClone) {
        ghostClone = element.cloneNode(true);
        ghostClone.classList.add('shivering-ghost');
        ghostClone.style.position = 'fixed';
        ghostClone.style.pointerEvents = 'none';
        ghostClone.style.opacity = '0.85';
        ghostClone.style.zIndex = '99999';
        document.body.appendChild(ghostClone);
        element.style.opacity = '0.3';
      }

      ghostClone.style.left = `${touch.clientX - 44}px`;
      ghostClone.style.top = `${touch.clientY - 44}px`;

      const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
      currentTargetZone = elemUnder ? elemUnder.closest('.tier-dropzone') : null;
    }
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (ghostClone) {
      ghostClone.remove();
      ghostClone = null;
      element.style.opacity = '1';

      if (currentTargetZone) {
        performWithSmoothHeightTransition(() => {
          currentTargetZone.appendChild(element);
          updatePoolState();
        });
      }

      // 25% de chance da caveira aparecer centralizada atrás do ranking
      if (Math.random() < 0.25) {
        triggerSkullAnimation();
      }
    } else if (!moved && (!e.target || !e.target.closest('.item-delete-btn'))) {
      const img = element.querySelector('img');
      if (img) {
        openModal(img.src, element.title);
      }
    }
  });
}

/**
 * Animação da Caveira (25% de chance ao terminar de arrastar uma imagem)
 * Aparece do centro para as bordas e some das bordas para o centro (~1.6s).
 */
function triggerSkullAnimation() {
  if (!boardSkullWatermark) return;
  boardSkullWatermark.classList.remove('animate-skull');
  void boardSkullWatermark.offsetWidth; // Force reflow para reiniciar a animação suavemente
  boardSkullWatermark.classList.add('animate-skull');
}

// ========================================================
// Custom Confirmation Modal
// ========================================================
function openConfirmResetModal() {
  if (!confirmResetModal) return;
  confirmResetModal.classList.add('open');
  confirmResetModal.setAttribute('aria-hidden', 'false');
}

function closeConfirmResetModal() {
  if (!confirmResetModal) return;
  confirmResetModal.classList.remove('open');
  confirmResetModal.setAttribute('aria-hidden', 'true');
}

function setupConfirmModalEvents() {
  if (!confirmResetModal) return;

  cancelResetBtn.addEventListener('click', closeConfirmResetModal);
  confirmResetBackdrop.addEventListener('click', closeConfirmResetModal);

  proceedResetBtn.addEventListener('click', () => {
    const rankedItems = tierlistBoard.querySelectorAll('.tier-item');
    if (rankedItems.length > 0) {
      performWithSmoothHeightTransition(() => {
        rankedItems.forEach(item => {
          imagePool.appendChild(item);
        });
        sortPoolInOrder();
        updatePoolState();
      });
    }
    closeConfirmResetModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmResetModal.classList.contains('open')) {
      closeConfirmResetModal();
    }
  });
}

// ========================================================
// Reddish Drag Smoke Particle Canvas System (~3s trail)
// ========================================================
function initSmokeCanvas() {
  if (!smokeCanvas) return;
  function resize() {
    smokeCanvas.width = window.innerWidth;
    smokeCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
}

function emitSmoke(x, y) {
  if (!smokeCtx || !x || !y) return;
  const now = performance.now();

  const dist = Math.hypot(x - lastSmokePos.x, y - lastSmokePos.y);
  if (now - lastSmokeEmitTime < 28 && dist < 10) return;
  lastSmokeEmitTime = now;
  lastSmokePos = { x, y };

  const count = dist > 24 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const offsetX = (Math.random() - 0.5) * 18;
    const offsetY = (Math.random() - 0.5) * 18;
    smokeParticles.push({
      x: x + offsetX,
      y: y + offsetY,
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
      lifespan: 1500 // 1.5 seconds total trail duration
    });
  }

  if (!smokeAnimFrame) {
    smokeAnimFrame = requestAnimationFrame(renderSmoke);
  }
}

function renderSmoke(now) {
  if (!smokeCtx) return;
  smokeCtx.clearRect(0, 0, smokeCanvas.width, smokeCanvas.height);

  const aliveParticles = [];

  for (let i = 0; i < smokeParticles.length; i++) {
    const p = smokeParticles[i];
    const age = now - p.birthTime;
    const progress = age / p.lifespan;

    if (progress >= 1) continue;

    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotSpeed;

    // Expand size smoothly
    p.currentSize = p.initialSize + (p.maxSize - p.initialSize) * Math.sin(progress * Math.PI * 0.5);

    // Smooth rise and fade out over ~1.5 seconds
    if (progress < 0.1) {
      p.alpha = (progress / 0.1) * p.targetAlpha;
    } else {
      p.alpha = p.targetAlpha * (1 - (progress - 0.1) / 0.9);
    }

    smokeCtx.save();
    smokeCtx.translate(p.x, p.y);
    smokeCtx.rotate(p.rotation);

    const grad = smokeCtx.createRadialGradient(0, 0, 0, 0, 0, p.currentSize);
    grad.addColorStop(0, `rgba(239, 68, 68, ${p.alpha * 0.55})`);
    grad.addColorStop(0.3, `rgba(220, 38, 38, ${p.alpha * 0.38})`);
    grad.addColorStop(0.65, `rgba(159, 18, 57, ${p.alpha * 0.15})`);
    grad.addColorStop(1, 'rgba(136, 19, 55, 0)');

    smokeCtx.fillStyle = grad;
    smokeCtx.beginPath();
    smokeCtx.arc(0, 0, p.currentSize, 0, Math.PI * 2);
    smokeCtx.fill();
    smokeCtx.restore();

    aliveParticles.push(p);
  }

  smokeParticles = aliveParticles;

  if (smokeParticles.length > 0) {
    smokeAnimFrame = requestAnimationFrame(renderSmoke);
  } else {
    smokeAnimFrame = null;
  }
}

// Smooth Height Transition Engine
function animateRowHeight(row, startH, endH) {
  if (startH === endH) return;

  const prevClean = activeRowAnimations.get(row);
  if (prevClean) {
    prevClean();
  }

  row.style.height = `${startH}px`;
  row.style.overflow = 'hidden';
  row.style.transition = 'none';

  void row.offsetHeight;

  row.style.transition = 'height 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
  row.style.height = `${endH}px`;

  const cleanup = () => {
    row.style.height = '';
    row.style.overflow = '';
    row.style.transition = '';
    row.removeEventListener('transitionend', onEnd);
    activeRowAnimations.delete(row);
  };

  const onEnd = (e) => {
    if (e.target === row && e.propertyName === 'height') {
      cleanup();
    }
  };

  row.addEventListener('transitionend', onEnd);
  activeRowAnimations.set(row, cleanup);
}

function performWithSmoothHeightTransition(action) {
  const animatedContainers = document.querySelectorAll('.tier-row, .pool-section');
  const startHeights = new Map();

  animatedContainers.forEach(container => {
    startHeights.set(container, container.offsetHeight);
  });

  action();

  animatedContainers.forEach(container => {
    const startH = startHeights.get(container);
    const endH = container.offsetHeight;

    if (startH !== undefined && startH !== endH) {
      animateRowHeight(container, startH, endH);
    }
  });
}

// Clapperboard & Stars Animation
function setupClapperboard() {
  if (!clapperIcon) return;

  clapperIcon.addEventListener('click', () => {
    triggerClapperAnimation();
  });

  clapperInterval = setInterval(() => {
    triggerClapperAnimation();
  }, 30000);

  setTimeout(() => {
    triggerClapperAnimation();
  }, 800);
}

function triggerClapperAnimation() {
  if (clapperIcon.classList.contains('clapping')) return;

  clapperIcon.classList.add('clapping');

  setTimeout(() => {
    createStarBurst();
  }, 540);

  setTimeout(() => {
    clapperIcon.classList.remove('clapping');
  }, 950);
}

function createStarBurst() {
  if (!starsBurst) return;
  starsBurst.innerHTML = '';

  const starColors = ['#ffd700', '#fff34a', '#ffffff', '#7dd3fc', '#bfff7f', '#ffbf7f'];
  const starCount = 8;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star-particle';

    const color = starColors[i % starColors.length];
    const size = 12 + Math.floor(Math.random() * 8);

    star.innerHTML = `
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="display:block;">
        <path d="M12 0L14.2 9.8L24 12L14.2 14.2L12 24L9.8 14.2L0 12L9.8 9.8Z"/>
      </svg>
    `;

    const angle = (Math.PI / 180) * (-75 + (i * 22) + (Math.random() * 8 - 4));
    const distance = 20 + Math.random() * 26;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const rot = Math.floor(Math.random() * 180);

    star.style.setProperty('--tx', `${tx}px`);
    star.style.setProperty('--ty', `${ty}px`);
    star.style.setProperty('--rot', `${rot}deg`);

    starsBurst.appendChild(star);
  }

  setTimeout(() => {
    starsBurst.innerHTML = '';
  }, 900);
}

// Lightbox Modal Functions
function setupModalEvents() {
  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('open')) {
      closeModal();
    }
  });
}

function openModal(src, title) {
  modalImg.src = src;
  modalCaption.textContent = title || 'Imagem';
  imageModal.classList.add('open');
  imageModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  imageModal.classList.remove('open');
  imageModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  modalImg.src = '';
}

// ========================================================
// 100% ROBUST TIER LIST IMAGE EXPORTER
// ========================================================
async function exportTierList() {
  const board = document.getElementById('tierlistBoard');
  const originalBtnText = exportImageBtn.innerHTML;

  try {
    exportImageBtn.disabled = true;
    exportImageBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      Baixando...
    `;

    // 1. Hide delete buttons temporarily
    const deleteButtons = board.querySelectorAll('.item-delete-btn');
    deleteButtons.forEach(btn => btn.style.display = 'none');

    // 2. Temporarily disable contenteditable to prevent html2canvas glitch
    const labels = board.querySelectorAll('.tier-label');
    labels.forEach(l => l.removeAttribute('contenteditable'));

    let canvas = null;

    // Try html2canvas first if available
    if (typeof html2canvas !== 'undefined') {
      try {
        canvas = await html2canvas(board, {
          backgroundColor: '#181b22',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false
        });
      } catch (err) {
        console.warn('html2canvas falhou, usando renderizador nativo:', err);
      }
    }

    // Restore DOM attributes
    deleteButtons.forEach(btn => btn.style.display = '');
    labels.forEach(l => l.setAttribute('contenteditable', 'true'));

    // If html2canvas failed or wasn't available, generate full native canvas
    if (!canvas) {
      canvas = await renderFullNativeCanvas();
    }

    // Trigger download reliably with DOM append
    triggerCanvasDownload(canvas);
  } catch (error) {
    console.error('Erro ao exportar imagem:', error);
    // Absolute fallback
    try {
      const fallbackCanvas = await renderFullNativeCanvas();
      triggerCanvasDownload(fallbackCanvas);
    } catch (e2) {
      alert('Não foi possível gerar a imagem da tier list.');
    }
  } finally {
    exportImageBtn.disabled = false;
    exportImageBtn.innerHTML = originalBtnText;
  }
}

/**
 * Downloads canvas reliably across all browsers (Desktop & Mobile)
 */
function triggerCanvasDownload(canvas) {
  const filename = `ranking-do-terror-${Date.now()}.png`;

  if (canvas.toBlob) {
    canvas.toBlob((blob) => {
      if (!blob) {
        fallbackDataUrl(canvas, filename);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.download = filename;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    }, 'image/png');
  } else {
    fallbackDataUrl(canvas, filename);
  }
}

function fallbackDataUrl(canvas, filename) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 500);
}

/**
 * High-definition native canvas renderer (Zero external dependencies)
 */
async function renderFullNativeCanvas() {
  const rows = tierlistBoard.querySelectorAll('.tier-row');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const boardWidth = 1080;
  const labelWidth = 145;
  const itemSize = 88;
  const padding = 10;
  const gap = 8;

  const rowLayouts = [];
  let totalHeight = 0;

  rows.forEach(row => {
    const label = row.querySelector('.tier-label');
    const color = window.getComputedStyle(label).backgroundColor;
    const text = label.textContent.trim();
    const items = Array.from(row.querySelectorAll('.tier-item'));

    const availableWidth = boardWidth - labelWidth - padding * 2;
    const itemsPerRow = Math.max(1, Math.floor((availableWidth + gap) / (itemSize + gap)));
    const numLines = Math.max(1, Math.ceil(items.length / itemsPerRow));
    const rowHeight = Math.max(96, padding * 2 + numLines * itemSize + (numLines - 1) * gap);

    rowLayouts.push({
      color,
      text,
      items,
      rowHeight,
      y: totalHeight,
      itemsPerRow
    });

    totalHeight += rowHeight;
  });

  // 2x Retina scale
  canvas.width = boardWidth * 2;
  canvas.height = totalHeight * 2;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#16181e';
  ctx.fillRect(0, 0, boardWidth, totalHeight);

  rowLayouts.forEach(layout => {
    // 1. Draw tier label box
    ctx.fillStyle = layout.color;
    ctx.fillRect(0, layout.y, labelWidth, layout.rowHeight);

    // Label text
    ctx.fillStyle = '#0b0d11';
    ctx.font = '800 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, layout.text, labelWidth / 2, layout.y + layout.rowHeight / 2, labelWidth - 20, 20);

    // 2. Draw dropzone background
    ctx.fillStyle = '#171920';
    ctx.fillRect(labelWidth, layout.y, boardWidth - labelWidth, layout.rowHeight);

    // 3. Draw items
    layout.items.forEach((item, index) => {
      const col = index % layout.itemsPerRow;
      const line = Math.floor(index / layout.itemsPerRow);

      const x = labelWidth + padding + col * (itemSize + gap);
      const y = layout.y + padding + line * (itemSize + gap);

      const img = item.querySelector('img');
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        drawRoundedRect(ctx, x, y, itemSize, itemSize, 6);
        ctx.clip();
        ctx.drawImage(img, x, y, itemSize, itemSize);
        ctx.restore();

        // Border around item
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, x, y, itemSize, itemSize, 6);
        ctx.stroke();
      }
    });

    // 4. Separator line
    ctx.fillStyle = '#262933';
    ctx.fillRect(0, layout.y + layout.rowHeight - 2, boardWidth, 2);
  });

  return canvas;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
}

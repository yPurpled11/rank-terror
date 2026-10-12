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
  setupEditMode();
  setupThemeToggle();
  setupEasterEgg();
  setupDeleteTierModalEvents();
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

  // Reorganiza e restaura tiers (ordem, nomes, cores e novos ranks customizados)
  if (dataToLoad.tierOrder && Array.isArray(dataToLoad.tierOrder) && dataToLoad.tierOrder.length > 0) {
    dataToLoad.tierOrder.forEach(tierId => {
      let row = document.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      const name = dataToLoad.tierNames?.[tierId] || tierId;
      const color = dataToLoad.tierColors?.[tierId] || '#bfff7f';

      if (!row) {
        // Rank customizado adicionado pelo usuário
        row = createCustomTierRow(tierId, name, color, false);
      } else {
        const labelDiv = row.querySelector('.tier-label');
        if (labelDiv) {
          if (color) labelDiv.style.backgroundColor = color;
          const labelSpan = labelDiv.querySelector('span');
          if (labelSpan) labelSpan.textContent = name;
        }
      }
      tierlistBoard.appendChild(row);
    });

    // Remove tiers que foram deletados pelo usuário
    document.querySelectorAll('.tier-row').forEach(row => {
      if (!dataToLoad.tierOrder.includes(row.dataset.tierId)) {
        row.remove();
      }
    });
  } else if (dataToLoad.tierNames) {
    Object.entries(dataToLoad.tierNames).forEach(([tierId, name]) => {
      const row = document.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      if (row) {
        const labelDiv = row.querySelector('.tier-label');
        if (labelDiv) {
          const labelSpan = labelDiv.querySelector('span');
          if (labelSpan) labelSpan.textContent = name;
          if (dataToLoad.tierColors?.[tierId]) {
            labelDiv.style.backgroundColor = dataToLoad.tierColors[tierId];
          }
        }
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
    tierOrder: [],
    tierNames: {},
    tierColors: {},
    tiers: {},
    unranked: []
  };

  document.querySelectorAll('.tier-row').forEach(row => {
    const tierId = row.dataset.tierId;
    const labelDiv = row.querySelector('.tier-label');
    const labelSpan = labelDiv ? labelDiv.querySelector('span') : null;
    const name = labelSpan ? labelSpan.textContent.trim() : tierId;
    const color = labelDiv ? labelDiv.style.backgroundColor : '';

    state.tierOrder.push(tierId);
    state.tierNames[tierId] = name;
    state.tierColors[tierId] = color;

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

    // 7.5% de chance da caveira aparecer centralizada atrás do ranking
    if (Math.random() < 0.075) {
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

// Setup Individual Dropzone
function setupSingleDropzone(zone) {
  if (!zone) return;

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
}

// Dropzones Initialization
function setupDropzones() {
  document.querySelectorAll('.tier-dropzone').forEach(zone => {
    setupSingleDropzone(zone);
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

  poolCounter.textContent = `${count} ${count === 1 ? 'restante' : 'restantes'}`;

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
  let touchStartTime = 0;
  let currentTargetZone = null;
  let ghostClone = null;
  let isDragging = false;
  let longPressTimer = null;

  element.addEventListener('touchstart', (e) => {
    if (e.target.closest('.item-delete-btn')) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isDragging = false;
    currentTargetZone = null;

    // Inicia timer de toque sustentado (220ms) para distinguir toque/scroll de arrasto
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isDragging = true;
      element.classList.add('touch-drag-active');
      if (navigator.vibrate) {
        try { navigator.vibrate(35); } catch (v) {}
      }
    }, 220);
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    // Se o usuário mover o dedo antes de segurar por 220ms, está ROLANDO a página normalmente
    if (!isDragging) {
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressTimer); // Cancela o arrasto e permite a rolagem nativa suave da página
      }
      return;
    }

    // Se o arrasto já foi ativado intencionalmente após o toque sustentado:
    if (e.cancelable) {
      e.preventDefault(); // Impede a rolagem da página enquanto move a imagem
    }

    emitSmoke(touch.clientX, touch.clientY);

    if (!ghostClone) {
      ghostClone = element.cloneNode(true);
      ghostClone.classList.add('shivering-ghost');
      ghostClone.style.position = 'fixed';
      ghostClone.style.pointerEvents = 'none';
      ghostClone.style.opacity = '0.9';
      ghostClone.style.zIndex = '99999';
      document.body.appendChild(ghostClone);
      element.style.opacity = '0.3';
    }

    ghostClone.style.left = `${touch.clientX - 44}px`;
    ghostClone.style.top = `${touch.clientY - 44}px`;

    const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
    currentTargetZone = elemUnder ? elemUnder.closest('.tier-dropzone') : null;
  }, { passive: false });

  const finishTouch = (e) => {
    clearTimeout(longPressTimer);
    element.classList.remove('touch-drag-active');

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

      // 7.5% de chance da caveira aparecer centralizada atrás do ranking
      if (Math.random() < 0.075) {
        triggerSkullAnimation();
      }
    } else if (!isDragging && (Date.now() - touchStartTime < 250)) {
      // Toque rápido sem arrasto -> abre prévia da imagem em tela cheia
      if (!e.target || !e.target.closest('.item-delete-btn')) {
        const img = element.querySelector('img');
        if (img) {
          openModal(img.src, element.title);
        }
      }
    }
    isDragging = false;
  };

  element.addEventListener('touchend', finishTouch);
  element.addEventListener('touchcancel', finishTouch);
}

/**
 * Animação da Caveira (5% de chance ao terminar de arrastar uma imagem)
 * Aparece do centro para as bordas e some das bordas para o centro (~1.0s).
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
// MODO EDIÇÃO (Tecla 'H' / Adicionar Imagens e Ranks / Mover Ranks)
// ========================================================

/**
 * Cria dinamicamente uma nova linha de rank (tier row) com controles de reordenação
 */
function createCustomTierRow(tierId, name, color, insertAtEnd = true) {
  const row = document.createElement('div');
  row.className = 'tier-row';
  row.dataset.tierId = tierId;

  row.innerHTML = `
    <div class="tier-reorder-controls" aria-label="Mover ou excluir rank">
      <button type="button" class="btn-tier-ctrl btn-tier-up" title="Mover rank para cima">▲</button>
      <button type="button" class="btn-tier-ctrl btn-tier-down" title="Mover rank para baixo">▼</button>
      <button type="button" class="btn-tier-ctrl btn-tier-del" title="Excluir este rank">✕</button>
    </div>
    <div class="tier-label" style="background-color: ${color};" contenteditable="true" spellcheck="false" title="Clique para editar o nome">
      <span>${name}</span>
    </div>
    <div class="tier-dropzone" data-zone-id="${tierId}"></div>
  `;

  const dropzone = row.querySelector('.tier-dropzone');
  setupSingleDropzone(dropzone);

  if (insertAtEnd && tierlistBoard) {
    tierlistBoard.appendChild(row);
  }

  return row;
}

function setupEditMode() {
  const closeBtn = document.getElementById('closeEditModeBtn');

  // 1. Fechar painel via botão '✕' no canto do próprio painel
  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleEditMode(false));
  }

  // 2. Atalho 'H' / 'h' no teclado (não aciona se estiver digitando em inputs ou contenteditable)
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleEditMode();
    }
  });

  // 3. Adicionar Nova Imagem Customizada
  const customImgFileInput = document.getElementById('customImgFileInput');
  const customImgFileName = document.getElementById('customImgFileName');
  const customImgTitleInput = document.getElementById('customImgTitleInput');
  const customImgPreviewBox = document.getElementById('customImgPreviewBox');
  const customImgPreview = document.getElementById('customImgPreview');
  const customImgPreviewTitle = document.getElementById('customImgPreviewTitle');
  const addCustomImgBtn = document.getElementById('addCustomImgBtn');

  let currentSelectedImgDataUrl = null;

  if (customImgFileInput) {
    customImgFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (customImgFileName) {
        customImgFileName.textContent = file.name;
      }

      // Preenche o nome da imagem automaticamente se o campo estiver vazio
      if (customImgTitleInput && !customImgTitleInput.value.trim()) {
        customImgTitleInput.value = extractTitle(file.name);
      }
      if (customImgPreviewTitle) {
        customImgPreviewTitle.textContent = customImgTitleInput ? (customImgTitleInput.value.trim() || 'Nova Imagem') : 'Nova Imagem';
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        currentSelectedImgDataUrl = event.target.result;
        if (customImgPreview) customImgPreview.src = currentSelectedImgDataUrl;
        if (customImgPreviewBox) customImgPreviewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    });
  }

  if (customImgTitleInput) {
    customImgTitleInput.addEventListener('input', () => {
      if (customImgPreviewTitle) {
        customImgPreviewTitle.textContent = customImgTitleInput.value.trim() || 'Nova Imagem';
      }
    });
  }

  if (addCustomImgBtn) {
    addCustomImgBtn.addEventListener('click', () => {
      if (!currentSelectedImgDataUrl) {
        alert('Por favor, escolha um arquivo de imagem do seu computador!');
        return;
      }

      const customTitle = customImgTitleInput ? (customImgTitleInput.value.trim() || 'Nova Imagem') : 'Nova Imagem';

      performWithSmoothHeightTransition(() => {
        createTierItem(currentSelectedImgDataUrl, customTitle, imagePool, null);
        sortPoolInOrder();
        updatePoolState();
      });

      showToast(`Imagem "${customTitle}" adicionada à reserva!`);

      // Reset dos campos de imagem
      currentSelectedImgDataUrl = null;
      if (customImgFileInput) customImgFileInput.value = '';
      if (customImgFileName) customImgFileName.textContent = 'Escolher Imagem...';
      if (customImgTitleInput) customImgTitleInput.value = '';
      if (customImgPreviewBox) customImgPreviewBox.style.display = 'none';
      if (customImgPreview) customImgPreview.src = '';
    });
  }

  // 4. Adicionar Novo Rank Customizado
  const customTierNameInput = document.getElementById('customTierNameInput');
  const customTierColorInput = document.getElementById('customTierColorInput');
  const colorPresets = document.getElementById('colorPresets');
  const tierPreviewBanner = document.getElementById('tierPreviewBanner');
  const tierPreviewText = document.getElementById('tierPreviewText');
  const addCustomTierBtn = document.getElementById('addCustomTierBtn');

  // Cores pré-definidas clicáveis
  if (colorPresets && customTierColorInput) {
    colorPresets.addEventListener('click', (e) => {
      const chip = e.target.closest('.color-chip');
      if (!chip) return;
      const color = chip.dataset.color;
      customTierColorInput.value = color;
      if (tierPreviewBanner) tierPreviewBanner.style.backgroundColor = color;
      colorPresets.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });

    customTierColorInput.addEventListener('input', () => {
      const color = customTierColorInput.value;
      if (tierPreviewBanner) tierPreviewBanner.style.backgroundColor = color;
      colorPresets.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    });
  }

  if (customTierNameInput) {
    customTierNameInput.addEventListener('input', () => {
      if (tierPreviewText) {
        tierPreviewText.textContent = customTierNameInput.value.trim() || 'Novo Rank';
      }
    });
  }

  if (addCustomTierBtn) {
    addCustomTierBtn.addEventListener('click', () => {
      const name = customTierNameInput ? (customTierNameInput.value.trim() || 'Novo Rank') : 'Novo Rank';
      const color = customTierColorInput ? (customTierColorInput.value || '#a855f7') : '#a855f7';
      const tierId = `custom-tier-${Date.now()}`;

      performWithSmoothHeightTransition(() => {
        createCustomTierRow(tierId, name, color, true);
      });

      showToast(`Rank "${name}" criado com sucesso!`);

      if (customTierNameInput) customTierNameInput.value = '';
      if (tierPreviewText) tierPreviewText.textContent = 'Novo Rank';
    });
  }

  // 5. Mover de posição os rankings já existentes (▲ Subir, ▼ Descer, ✕ Excluir via modal customizado)
  if (tierlistBoard) {
    tierlistBoard.addEventListener('click', (e) => {
      const upBtn = e.target.closest('.btn-tier-up');
      const downBtn = e.target.closest('.btn-tier-down');
      const delBtn = e.target.closest('.btn-tier-del');

      if (upBtn) {
        const row = upBtn.closest('.tier-row');
        const prev = row ? row.previousElementSibling : null;
        if (prev && prev.classList.contains('tier-row')) {
          performWithSmoothHeightTransition(() => {
            tierlistBoard.insertBefore(row, prev);
          });
        }
      } else if (downBtn) {
        const row = downBtn.closest('.tier-row');
        const next = row ? row.nextElementSibling : null;
        if (next && next.classList.contains('tier-row')) {
          performWithSmoothHeightTransition(() => {
            tierlistBoard.insertBefore(next, row);
          });
        }
      } else if (delBtn) {
        const row = delBtn.closest('.tier-row');
        if (!row) return;
        openDeleteTierModal(row);
      }
    });
  }

}

function toggleEditMode(forceState = null) {
  const panel = document.getElementById('editModePanel');
  
  const newState = forceState !== null ? forceState : !document.body.classList.contains('edit-mode-active');

  if (newState) {
    document.body.classList.add('edit-mode-active');
    if (panel) {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
    }
    showToast('Eu quero, Eu posso');
  } else {
    document.body.classList.remove('edit-mode-active');
    if (panel) {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }
    showToast('Painel fechado');
  }
}

// ========================================================
// Modal de Confirmação para Exclusão de Rank
// ========================================================
let pendingTierRowToDelete = null;

function openDeleteTierModal(row) {
  pendingTierRowToDelete = row;
  const modal = document.getElementById('confirmDeleteTierModal');
  const title = document.getElementById('confirmDeleteTierTitle');
  const text = document.getElementById('confirmDeleteTierText');

  const rankName = row.querySelector('.tier-label span')?.textContent?.trim() || 'este rank';
  const itemCount = row.querySelectorAll('.tier-item').length;

  if (title) title.textContent = `Excluir Rank "${rankName}"?`;
  if (text) {
    text.textContent = itemCount > 0
      ? `As ${itemCount} ${itemCount === 1 ? 'imagem' : 'imagens'} deste rank voltarão automaticamente para a reserva.`
      : 'Tem certeza que deseja excluir este rank?';
  }

  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeDeleteTierModal() {
  pendingTierRowToDelete = null;
  const modal = document.getElementById('confirmDeleteTierModal');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function setupDeleteTierModalEvents() {
  const modal = document.getElementById('confirmDeleteTierModal');
  const backdrop = document.getElementById('confirmDeleteTierBackdrop');
  const cancelBtn = document.getElementById('cancelDeleteTierBtn');
  const proceedBtn = document.getElementById('proceedDeleteTierBtn');

  if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteTierModal);
  if (backdrop) backdrop.addEventListener('click', closeDeleteTierModal);

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (pendingTierRowToDelete) {
        const row = pendingTierRowToDelete;
        const items = row.querySelectorAll('.tier-item');
        const rankName = row.querySelector('.tier-label span')?.textContent?.trim() || 'Rank';

        performWithSmoothHeightTransition(() => {
          items.forEach(item => imagePool.appendChild(item));
          sortPoolInOrder();
          row.remove();
          updatePoolState();
        });

        showToast(`Rank "${rankName}" removido com sucesso.`);
      }
      closeDeleteTierModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
      closeDeleteTierModal();
    }
  });
}

// ========================================================
// Tema Claro / Escuro & Easter Egg Purp
// ========================================================
function setupThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  const savedTheme = localStorage.getItem('ranking_theme_preference');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      // O modo claro e escuro tem prioridade e reseta o easter egg do Purp
      resetPurpEasterEgg();

      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('ranking_theme_preference', isLight ? 'light' : 'dark');
      showToast(isLight ? 'Modo Claro ativado' : 'Modo Escuro ativado');
    });
  }
}

function setupEasterEgg() {
  const purpBtn = document.getElementById('purpEasterEgg');
  if (!purpBtn) return;

  purpBtn.addEventListener('click', () => {
    // Ao clicar em 'Purp', aplica o roxo pré-definido ao fundo e cartões
    document.body.style.setProperty('--bg-main', '#140924');
    document.documentElement.style.setProperty('--bg-main', '#140924');
    document.body.style.setProperty('--bg-card', '#21103b');
    document.documentElement.style.setProperty('--bg-card', '#21103b');
    document.body.style.setProperty('--bg-tier-row', '#21103b');
    document.documentElement.style.setProperty('--bg-tier-row', '#21103b');
    document.body.style.setProperty('--bg-pool', '#21103b');
    document.documentElement.style.setProperty('--bg-pool', '#21103b');
    showToast('💜 Purp Mode');
  });
}

function resetPurpEasterEgg() {
  document.body.style.removeProperty('--bg-main');
  document.documentElement.style.removeProperty('--bg-main');
  document.body.style.removeProperty('--bg-card');
  document.documentElement.style.removeProperty('--bg-card');
  document.body.style.removeProperty('--bg-tier-row');
  document.documentElement.style.removeProperty('--bg-tier-row');
  document.body.style.removeProperty('--bg-pool');
  document.documentElement.style.removeProperty('--bg-pool');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 320);
  }, 2600);
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
      lifespan: 1000 // 1.0 second total trail duration
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

    // Smooth rise and fade out over ~1.0 second
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

  const starColors = ['#a855f7', '#c084fc', '#ffd700', '#fff34a', '#ffffff', '#e879f9'];
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

    // 1. Hide delete buttons and reorder controls temporarily
    const deleteButtons = board.querySelectorAll('.item-delete-btn');
    deleteButtons.forEach(btn => btn.style.display = 'none');
    const reorderControls = board.querySelectorAll('.tier-reorder-controls');
    reorderControls.forEach(ctrl => ctrl.style.display = 'none');

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
    reorderControls.forEach(ctrl => ctrl.style.display = '');
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

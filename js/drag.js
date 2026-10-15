// js/drag.js — Drag-and-drop (mouse + touch) e indicadores de drop

import {
  imagePool, boardSkullWatermark,
  draggedItem, isDraggingActive, currentActiveZone,
  setDraggedItem, setIsDraggingActive, setCurrentActiveZone
} from './state.js';
import { emitSmoke } from './smoke.js';
import { updatePoolState, sortPoolInOrder, performWithSmoothHeightTransition } from './ui.js';
import { extractTitle } from './utils.js';

// openModal é injetado via init para evitar dependência circular com modals.js
let _openModal = () => {};
export function injectOpenModal(fn) { _openModal = fn; }

// triggerSkullAnimation injetado de effects.js
let _triggerSkull = () => {};
export function injectTriggerSkull(fn) { _triggerSkull = fn; }

// ── Mouse drag ───────────────────────────────────────────────────────────────

export function setupItemDragEvents(item) {
  item.addEventListener('dragstart', e => {
    resetDragHysteresis();
    setDraggedItem(item);
    setIsDraggingActive(true);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    setTimeout(() => { if (draggedItem) draggedItem.style.opacity = '0.35'; }, 0);
  });

  item.addEventListener('drag', e => {
    if (e.clientX > 0 && e.clientY > 0) emitSmoke(e.clientX, e.clientY);
  });

  item.addEventListener('dragend', () => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem.style.opacity = '1';
    }
    setDraggedItem(null);
    setTimeout(() => setIsDraggingActive(false), 60);
    clearDropIndicators();
    updatePoolState();
    if (Math.random() < 0.075) _triggerSkull();
  });

  enableTouchDrag(item);
}

// Bloqueia arrasto de texto/imagens do sistema — só tier-items
document.addEventListener('dragstart', e => {
  if (!e.target?.closest?.('.tier-item')) e.preventDefault();
});

// Fumaça contínua ao arrastar sobre o documento
document.addEventListener('dragover', e => {
  if (isDraggingActive && e.clientX > 0 && e.clientY > 0) emitSmoke(e.clientX, e.clientY);
});

// ── Dropzone individual ──────────────────────────────────────────────────────

export function setupSingleDropzone(zone) {
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.clientX > 0 && e.clientY > 0) emitSmoke(e.clientX, e.clientY);

    if (currentActiveZone && currentActiveZone !== zone) {
      currentActiveZone.classList.remove('drag-hover');
      removePlaceholder(currentActiveZone);
      resetDragHysteresis();
    }
    setCurrentActiveZone(zone);
    zone.classList.add('drag-hover');
    updateDropPlaceholder(zone, getDragAfterElement(zone, e.clientX, e.clientY));
  });

  zone.addEventListener('dragleave', e => {
    const r = zone.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom;
    if (outside || (e.relatedTarget && !zone.contains(e.relatedTarget))) {
      zone.classList.remove('drag-hover');
      removePlaceholder(zone);
      if (currentActiveZone === zone) {
        setCurrentActiveZone(null);
        resetDragHysteresis();
      }
    }
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-hover');
    setCurrentActiveZone(null);
    resetDragHysteresis();
    if (!draggedItem) return;

    const after = getDragAfterElement(zone, e.clientX, e.clientY);
    performWithSmoothHeightTransition(() => {
      removePlaceholder(zone);
      if (zone === imagePool) {
        imagePool.appendChild(draggedItem);
        sortPoolInOrder();
      } else if (after == null) {
        zone.appendChild(draggedItem);
      } else {
        zone.insertBefore(draggedItem, after);
      }
      updatePoolState();
    });
  });
}

export function setupDropzones() {
  document.querySelectorAll('.tier-dropzone').forEach(setupSingleDropzone);
}

// ── Helpers de posicionamento e placeholder ──────────────────────────────────

let _lastAfterElement = null;
let _lastActiveRowIndex = null;
const ROW_HYSTERESIS_PX = 14;

export function resetDragHysteresis() {
  _lastAfterElement = null;
  _lastActiveRowIndex = null;
}

function getDragAfterElement(container, x, y) {
  const items = [...container.querySelectorAll('.tier-item:not(.dragging)')];
  if (!items.length) {
    _lastAfterElement = null;
    _lastActiveRowIndex = null;
    return null;
  }

  // Detecta placeholder existente para neutralizar deslocamento artificial nos cálculos
  const ph = container.querySelector('.drop-placeholder');
  const phRect = (ph && ph.parentElement === container) ? ph.getBoundingClientRect() : null;
  const phWidth = phRect ? (phRect.width + 8) : 0; // largura + margens horizontais

  // Agrupa itens em linhas visuais com coordenadas estáveis e normalizadas
  const rows = [];
  let currentRow = [];
  let currentRowTop = null;

  for (const item of items) {
    const box = item.getBoundingClientRect();
    let normLeft = box.left;
    // Se o placeholder estiver antes deste item na mesma linha, desfaz o deslocamento
    if (phRect && Math.abs(box.top - phRect.top) < 20 && phRect.left < box.left) {
      normLeft -= phWidth;
    }
    const normItem = {
      item,
      top: box.top,
      bottom: box.bottom,
      midX: normLeft + box.width / 2
    };

    if (currentRowTop === null || Math.abs(box.top - currentRowTop) > 20) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [normItem];
      currentRowTop = box.top;
    } else {
      currentRow.push(normItem);
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Determina a linha ativa com histerese vertical para evitar pulos entre linhas vizinhas
  let activeRowIdx = 0;
  if (rows.length === 1) {
    activeRowIdx = 0;
  } else if (_lastActiveRowIndex !== null && _lastActiveRowIndex >= 0 && _lastActiveRowIndex < rows.length) {
    activeRowIdx = _lastActiveRowIndex;
    if (activeRowIdx > 0) {
      const prevRow = rows[activeRowIdx - 1];
      const currRow = rows[activeRowIdx];
      const splitY = (prevRow[0].bottom + currRow[0].top) / 2;
      if (y < splitY - ROW_HYSTERESIS_PX) activeRowIdx--;
    }
    if (activeRowIdx < rows.length - 1) {
      const currRow = rows[activeRowIdx];
      const nextRow = rows[activeRowIdx + 1];
      const splitY = (currRow[0].bottom + nextRow[0].top) / 2;
      if (y > splitY + ROW_HYSTERESIS_PX) activeRowIdx++;
    }
  } else {
    let bestDist = Infinity;
    rows.forEach((r, idx) => {
      const rCenterY = (r[0].top + r[0].bottom) / 2;
      const d = Math.abs(y - rCenterY);
      if (d < bestDist) {
        bestDist = d;
        activeRowIdx = idx;
      }
    });
  }

  _lastActiveRowIndex = activeRowIdx;
  const activeRow = rows[activeRowIdx];

  // Dentro da linha ativa, encontra o ponto de inserção horizontal
  let targetItem = null;
  for (const it of activeRow) {
    if (x < it.midX) {
      targetItem = it.item;
      break;
    }
  }

  // Se o cursor estiver após o último item desta linha:
  // Se houver uma linha subsequente, insere antes do primeiro item dela; caso contrário, no fim
  if (!targetItem) {
    if (activeRowIdx + 1 < rows.length) {
      targetItem = rows[activeRowIdx + 1][0].item;
    } else {
      targetItem = null;
    }
  }

  _lastAfterElement = targetItem;
  return targetItem;
}

function updateDropPlaceholder(zone, afterElement) {
  let ph = zone.querySelector('.drop-placeholder')
        || document.querySelector('.drop-placeholder')
        || Object.assign(document.createElement('div'), { className: 'drop-placeholder' });

  // Só reposiciona no DOM quando a posição realmente muda
  if (ph.nextSibling !== afterElement || ph.parentElement !== zone) {
    afterElement == null ? zone.appendChild(ph) : zone.insertBefore(ph, afterElement);
  }
}

function removePlaceholder(zone) {
  zone?.querySelector('.drop-placeholder')?.remove();
}

export function clearDropIndicators() {
  resetDragHysteresis();
  setCurrentActiveZone(null);
  document.querySelectorAll('.tier-dropzone').forEach(z => {
    z.classList.remove('drag-hover');
    removePlaceholder(z);
  });
}

// ── Touch drag ───────────────────────────────────────────────────────────────

function enableTouchDrag(element) {
  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let currentTargetZone = null, ghostClone = null;
  let isDragging = false, hasMoved = false, longPressTimer = null;

  element.addEventListener('touchstart', e => {
    if (e.target.closest('.item-delete-btn')) return;
    const t = e.touches[0];
    touchStartX = t.clientX; touchStartY = t.clientY;
    touchStartTime = Date.now();
    isDragging = hasMoved = false;
    currentTargetZone = null;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isDragging = true;
      element.classList.add('touch-drag-active');
      try { if (navigator.vibrate) navigator.vibrate(35); } catch {}
    }, 220);
  }, { passive: true });

  element.addEventListener('touchmove', e => {
    const t  = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartX);
    const dy = Math.abs(t.clientY - touchStartY);
    if (dx > 6 || dy > 6) hasMoved = true;

    if (!isDragging) {
      if (dx > 6 || dy > 6) clearTimeout(longPressTimer);
      return;
    }

    if (e.cancelable) e.preventDefault();
    emitSmoke(t.clientX, t.clientY);

    if (!ghostClone) {
      ghostClone = element.cloneNode(true);
      Object.assign(ghostClone.style, {
        position: 'fixed', pointerEvents: 'none', opacity: '0.9', zIndex: '99999'
      });
      ghostClone.classList.add('shivering-ghost');
      document.body.appendChild(ghostClone);
      element.style.opacity = '0.3';
    }

    ghostClone.style.left = `${t.clientX - 44}px`;
    ghostClone.style.top  = `${t.clientY - 44}px`;
    const under = document.elementFromPoint(t.clientX, t.clientY);
    currentTargetZone = under?.closest('.tier-dropzone') ?? null;
  }, { passive: false });

  const finishTouch = e => {
    clearTimeout(longPressTimer);
    element.classList.remove('touch-drag-active');

    if (ghostClone) {
      ghostClone.remove();
      ghostClone = null;
      element.style.opacity = '1';
      if (currentTargetZone) {
        performWithSmoothHeightTransition(() => {
          currentTargetZone.appendChild(element);
          if (currentTargetZone === imagePool) sortPoolInOrder();
          updatePoolState();
        });
      }
      if (Math.random() < 0.075) _triggerSkull();
    } else if (!isDragging && !hasMoved && (Date.now() - touchStartTime < 250)) {
      if (!e.target?.closest('.item-delete-btn')) {
        const img = element.querySelector('img');
        if (img) _openModal(img.src, extractTitle(element.title || img.alt));
      }
    }
    isDragging = hasMoved = false;
  };

  element.addEventListener('touchend',    finishTouch);
  element.addEventListener('touchcancel', finishTouch);
}

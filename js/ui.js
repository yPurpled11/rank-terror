// js/ui.js — Utilitários de interface: toast, pool state, createTierItem, sortPool

import { extractTitle, extractOrder } from './utils.js';
import { imagePool, poolPlaceholder, poolCounter, activeRowAnimations, incImageIdCounter } from './state.js';

// Injetado de drag.js via main.js para evitar dependência circular
let _setupItemDragEvents = () => {};
export function injectSetupItemDragEvents(fn) { _setupItemDragEvents = fn; }

// Injetado de modals.js via main.js para evitar dependência circular
let _openModal = () => {};
export function injectOpenModalIntoUI(fn) { _openModal = fn; }

/**
 * Exibe uma notificação toast temporária
 */
export function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.cssText += 'transition:opacity .3s ease,transform .3s ease;opacity:0;transform:translateY(10px)';
    setTimeout(() => toast.remove(), 320);
  }, 2600);
}

/**
 * Atualiza o contador e o placeholder da galeria (pool)
 */
export function updatePoolState() {
  const count = imagePool.querySelectorAll('.tier-item').length;
  poolCounter.textContent = `${count} ${count === 1 ? 'restante' : 'restantes'}`;
  if (count === 0) {
    if (!poolPlaceholder.parentElement) imagePool.appendChild(poolPlaceholder);
    poolPlaceholder.style.display = 'flex';
  } else {
    poolPlaceholder.style.display = 'none';
  }
}

/**
 * Ordena todos os itens do pool em ordem numérica ascendente
 */
export function sortPoolInOrder() {
  if (!imagePool) return;
  const items = Array.from(imagePool.querySelectorAll('.tier-item'));
  if (items.length <= 1) return;
  const getOrder = el => el.dataset.order !== undefined && el.dataset.order !== ''
    ? parseFloat(el.dataset.order)
    : extractOrder(el.dataset.relPath || el.querySelector('img')?.getAttribute('src'));
  items.sort((a, b) => getOrder(a) - getOrder(b));
  items.forEach(item => imagePool.appendChild(item));
}

/**
 * Retorna o próximo número de ordem consecutivo para novos filmes
 */
export function getNextConsecutiveOrder() {
  let max = 0;
  document.querySelectorAll('.tier-item').forEach(item => {
    const ord = parseFloat(item.dataset.order);
    if (!isNaN(ord) && ord < 9000 && ord > max) max = ord;
  });
  return Math.floor(max) + 1;
}

/**
 * Cria um item de tier (card de filme) arrastável
 */
export function createTierItem(src, title = 'Imagem', container = imagePool, relPath = null) {
  const id         = `item-${Date.now()}-${incImageIdCounter()}`;
  const cleanTitle = extractTitle(title);
  const orderNum   = extractOrder(relPath || (typeof src === 'string' ? src : ''));

  const item = document.createElement('div');
  item.className = 'tier-item';
  item.id = id;
  item.draggable = true;
  item.title = cleanTitle;
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
  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    performWithSmoothHeightTransition(() => {
      imagePool.appendChild(item);
      sortPoolInOrder();
      updatePoolState();
    });
  });

  item.appendChild(img);
  item.appendChild(deleteBtn);

  // Click/toque rápido → abre prévia em tela cheia
  let startX = 0, startY = 0, hasMoved = false;
  item.addEventListener('mousedown', e => {
    if (e.target.closest('.item-delete-btn')) return;
    startX = e.clientX; startY = e.clientY; hasMoved = false;
  });
  item.addEventListener('mousemove', e => {
    if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) hasMoved = true;
  });
  item.addEventListener('click', e => {
    if (e.target.closest('.item-delete-btn')) return;
    if (hasMoved) return;
    _openModal(src, cleanTitle);
  });

  _setupItemDragEvents(item);
  container.appendChild(item);
  updatePoolState();
  return item;
}

// ── Smooth Height Transition Engine ──────────────────────────────────────────

function animateRowHeight(row, startH, endH) {
  if (startH === endH) return;
  const prevClean = activeRowAnimations.get(row);
  if (prevClean) prevClean();

  row.style.height = `${startH}px`;
  row.style.overflow = 'hidden';
  row.style.transition = 'none';
  void row.offsetHeight;
  row.style.transition = 'height 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
  row.style.height = `${endH}px`;

  const cleanup = () => {
    row.style.height = row.style.overflow = row.style.transition = '';
    row.removeEventListener('transitionend', onEnd);
    activeRowAnimations.delete(row);
  };
  const onEnd = e => { if (e.target === row && e.propertyName === 'height') cleanup(); };
  row.addEventListener('transitionend', onEnd);
  activeRowAnimations.set(row, cleanup);
}

export function performWithSmoothHeightTransition(action) {
  const containers = document.querySelectorAll('.tier-row, .pool-section');
  const startHeights = new Map();
  containers.forEach(c => startHeights.set(c, c.offsetHeight));
  action();
  containers.forEach(c => {
    const startH = startHeights.get(c);
    const endH   = c.offsetHeight;
    if (startH !== undefined && startH !== endH) animateRowHeight(c, startH, endH);
  });
}

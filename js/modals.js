// js/modals.js — Modal de imagem (lightbox) e modal de confirmação de reset

import { imageModal, modalBackdrop, modalCloseBtn, modalImg, modalCaption,
         confirmResetModal, confirmResetBackdrop, cancelResetBtn, proceedResetBtn,
         imagePool } from './state.js';
import { extractTitle } from './utils.js';
import { sortPoolInOrder, updatePoolState, performWithSmoothHeightTransition } from './ui.js';

// ── Lightbox ─────────────────────────────────────────────────────────────────

export function setupModalEvents() {
  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && imageModal.classList.contains('open')) closeModal();
  });
}

export function openModal(src, title) {
  const clean = extractTitle(title);
  modalImg.src = src;
  modalImg.alt = clean || 'Imagem';
  modalImg.removeAttribute('title');
  modalCaption.textContent = clean || 'Imagem';
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

// ── Modal de confirmação de reset ────────────────────────────────────────────

export function setupConfirmModalEvents() {
  if (!confirmResetModal) return;

  const close = () => {
    confirmResetModal.classList.remove('open');
    confirmResetModal.setAttribute('aria-hidden', 'true');
  };

  cancelResetBtn.addEventListener('click', close);
  confirmResetBackdrop.addEventListener('click', close);

  proceedResetBtn.addEventListener('click', () => {
    const ranked = document.getElementById('tierlistBoard')?.querySelectorAll('.tier-item');
    if (ranked?.length > 0) {
      performWithSmoothHeightTransition(() => {
        ranked.forEach(item => imagePool.appendChild(item));
        sortPoolInOrder();
        updatePoolState();
      });
    }
    close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && confirmResetModal.classList.contains('open')) close();
  });
}

export function openConfirmResetModal() {
  if (!confirmResetModal) return;
  confirmResetModal.classList.add('open');
  confirmResetModal.setAttribute('aria-hidden', 'false');
}

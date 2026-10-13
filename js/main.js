// js/main.js — Ponto de entrada: inicialização e orquestração dos módulos

import { saveRankingBtn, resetAllBtn, exportImageBtn, imagePool } from './state.js';
import { initSmokeCanvas } from './smoke.js';
import { updatePoolState, performWithSmoothHeightTransition, sortPoolInOrder,
         injectSetupItemDragEvents, injectOpenModalIntoUI } from './ui.js';
import { setupDropzones, setupItemDragEvents, injectOpenModal, injectTriggerSkull } from './drag.js';
import { openModal, setupModalEvents, setupConfirmModalEvents, openConfirmResetModal } from './modals.js';
import { setupEditMode, setupDeleteTierModalEvents, toggleEditMode } from './editMode.js';
import { setupThemeToggle, setupEasterEgg } from './theme.js';
import { setupTitleSkull, setupClapperboard, triggerSkullAnimation } from './effects.js';
import { setupCustomScrollbar } from './scrollbar.js';
import { loadRankingData, saveRankingToDatabase } from './data.js';
import { exportTierList } from './export.js';
import { animateTierRows } from './animations.js';
import { waitForImages } from './utils.js';

// Injeta dependências que evitam importações circulares
injectOpenModal(openModal);           // drag.js precisa de openModal
injectTriggerSkull(triggerSkullAnimation); // drag.js precisa de triggerSkullAnimation
injectSetupItemDragEvents(setupItemDragEvents); // ui.js precisa de setupItemDragEvents
injectOpenModalIntoUI(openModal);     // ui.js precisa de openModal

// Expõe toggleEditMode globalmente (chamado de atalho de teclado via HTML e outros contextos)
window.toggleEditMode = toggleEditMode;

// ── Inicialização ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const loadingBar   = document.getElementById('loadingBarFill');
  const loadingLabel = document.getElementById('loadingLabel');

  const setProgress = (pct, label) => {
    if (loadingBar)   loadingBar.style.width = pct + '%';
    if (loadingLabel) loadingLabel.textContent = label;
  };

  setProgress(10, 'Preparando o cenário...');

  // Módulos de setup (síncronos)
  initSmokeCanvas();
  setupDropzones();
  setupEditMode();
  setupCustomScrollbar();
  setupThemeToggle();
  setupEasterEgg();
  setupTitleSkull();
  setupDeleteTierModalEvents();
  setupClapperboard();
  setupModalEvents();
  setupConfirmModalEvents();

  // Event listeners principais
  saveRankingBtn?.addEventListener('click', saveRankingToDatabase);
  exportImageBtn.addEventListener('click', exportTierList);
  resetAllBtn.addEventListener('click', () => {
    if (document.getElementById('tierlistBoard')?.querySelectorAll('.tier-item').length > 0) {
      openConfirmResetModal();
    }
  });

  setProgress(30, 'Carregando dados do ranking...');
  await loadRankingData();
  updatePoolState();

  setProgress(60, 'Aguardando imagens...');

  // Aguarda todas as imagens carregarem (pool + tiers), com timeout de 5s
  const allImgs = Array.from(document.querySelectorAll('.tier-item img, .tier-row img'));
  await waitForImages(allImgs, 5000);

  setProgress(90, 'Quase lá...');
  await new Promise(res => setTimeout(res, 300));

  setProgress(100, 'Pronto!');
  await new Promise(res => setTimeout(res, 350));

  // Fecha a tela de carregamento
  const screen = document.getElementById('loadingScreen');
  if (screen) {
    screen.classList.add('hidden');
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
  }

  // Inicia as animações após a transição da loading screen (600ms)
  setTimeout(animateTierRows, 650);
});

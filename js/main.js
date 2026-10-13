// js/main.js — Ponto de entrada: inicialização e orquestração dos módulos

import { saveRankingBtn, resetAllBtn, exportImageBtn } from './state.js';
import { initSmokeCanvas } from './smoke.js';
import { updatePoolState, injectSetupItemDragEvents, injectOpenModalIntoUI } from './ui.js';
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
import { setupAnimToggle, areAnimsEnabled } from './animToggle.js';

// Injeta dependências que evitam importações circulares
injectOpenModal(openModal);
injectTriggerSkull(triggerSkullAnimation);
injectSetupItemDragEvents(setupItemDragEvents);
injectOpenModalIntoUI(openModal);

// Expõe toggleEditMode globalmente para atalhos de teclado e HTML
window.toggleEditMode = toggleEditMode;

// ── Inicialização do Aplicativo ──────────────────────────────────────────────

async function startApp() {
  const loadingBar   = document.getElementById('loadingBarFill');
  const loadingLabel = document.getElementById('loadingLabel');

  const setProgress = (pct, label) => {
    if (loadingBar)   loadingBar.style.width = `${pct}%`;
    if (loadingLabel) loadingLabel.textContent = label;
  };

  setProgress(15, 'Preparando o cenário...');

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
  setupAnimToggle(); // botão de ativar/desativar animações

  // Event listeners principais
  saveRankingBtn?.addEventListener('click', saveRankingToDatabase);
  exportImageBtn?.addEventListener('click', exportTierList);
  resetAllBtn?.addEventListener('click', () => {
    if (document.getElementById('tierlistBoard')?.querySelectorAll('.tier-item').length > 0) {
      openConfirmResetModal();
    }
  });

  setProgress(35, 'Carregando dados do ranking...');
  await loadRankingData();
  updatePoolState();

  setProgress(65, 'Aguardando imagens...');
  const allImgs = Array.from(document.querySelectorAll('.tier-item img, .tier-row img, img[src="Caveira.png"]'));
  await waitForImages(allImgs, 4000);

  setProgress(90, 'Quase lá...');
  await new Promise(res => setTimeout(res, 250));

  setProgress(100, 'Pronto!');
  await new Promise(res => setTimeout(res, 350));

  // 1. Desvanece a tela de carregamento e revela suavemente o site principal
  const screen = document.getElementById('loadingScreen');
  if (screen) {
    screen.classList.add('hidden');
    setTimeout(() => screen.remove(), 600);
  }
  document.body.classList.remove('loading-active');

  // 2. Aguarda a transição de revelação (450ms) e inicia as animações (se ativadas)
  setTimeout(() => {
    if (areAnimsEnabled()) {
      animateTierRows();
    } else {
      // Sem animação: remove estado de intro imediatamente
      document.body.classList.remove('intro-animating');
      document.querySelectorAll('.board-wrapper .tier-row').forEach(row => {
        row.classList.add('tier-row-visible');
      });
    }
  }, 450);
}

// Disparo seguro compatível com ES Modules
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

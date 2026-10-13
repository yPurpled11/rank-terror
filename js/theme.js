// js/theme.js — Tema claro/escuro e Easter Egg Purp Mode

import { showToast } from './ui.js';

function resetPurpEasterEgg() {
  document.body.classList.remove('purp-mode');
}

export function setupThemeToggle() {
  const btn = document.getElementById('themeToggleBtn');
  const saved = localStorage.getItem('ranking_theme_preference');

  if      (saved === 'light') { document.body.classList.add('light-mode'); document.body.classList.remove('purp-mode'); }
  else if (saved === 'purp')  { document.body.classList.add('purp-mode');  document.body.classList.remove('light-mode'); }
  else                        { document.body.classList.remove('light-mode', 'purp-mode'); }

  btn?.addEventListener('click', () => {
    resetPurpEasterEgg();
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('ranking_theme_preference', isLight ? 'light' : 'dark');
    showToast(isLight ? 'Modo Claro ativado' : 'Modo Escuro ativado');
  });
}

export function setupEasterEgg() {
  const btn = document.getElementById('purpEasterEgg');
  btn?.addEventListener('click', () => {
    document.body.classList.remove('light-mode');
    document.body.classList.add('purp-mode');
    localStorage.setItem('ranking_theme_preference', 'purp');
    showToast('💜 Purp Mode');
  });
}

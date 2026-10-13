// js/animToggle.js — Botão de ativar/desativar animações do site (desktop only)

const PREF_KEY = 'ranking_anims_enabled';

/**
 * Retorna true se as animações estiverem ativas (padrão: ativo)
 */
export function areAnimsEnabled() {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

function saveAnimPref(enabled) {
  try { localStorage.setItem(PREF_KEY, String(enabled)); } catch {}
}

function applyAnimState(btn, enabled) {
  if (enabled) {
    document.body.classList.remove('anims-disabled');
    if (btn) btn.title = 'Desativar animações';
  } else {
    document.body.classList.add('anims-disabled');
    if (btn) btn.title = 'Ativar animações';
  }
}

export function setupAnimToggle() {
  const btn = document.getElementById('animToggleBtn');
  if (!btn) return;

  // Aplica preferência salva ao iniciar
  const enabled = areAnimsEnabled();
  applyAnimState(btn, enabled);

  btn.addEventListener('click', () => {
    const nowEnabled = !document.body.classList.contains('anims-disabled');
    const next = !nowEnabled;
    applyAnimState(btn, next);
    saveAnimPref(next);
  });
}

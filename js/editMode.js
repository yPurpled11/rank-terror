// js/editMode.js — Painel de edição, criação/exclusão de ranks customizados

import { imagePool, tierlistBoard } from './state.js';
import { showToast, updatePoolState, sortPoolInOrder, getNextConsecutiveOrder,
         createTierItem, performWithSmoothHeightTransition } from './ui.js';
import { setupSingleDropzone } from './drag.js';
import { extractTitle } from './utils.js';

// ── Modal de exclusão de rank ─────────────────────────────────────────────────

let pendingTierRowToDelete = null;

export function openDeleteTierModal(row) {
  pendingTierRowToDelete = row;
  const modal     = document.getElementById('confirmDeleteTierModal');
  const title     = document.getElementById('confirmDeleteTierTitle');
  const text      = document.getElementById('confirmDeleteTierText');
  const rankName  = row.querySelector('.tier-label span')?.textContent?.trim() || 'este rank';
  const itemCount = row.querySelectorAll('.tier-item').length;

  if (title) title.textContent = `Excluir Rank "${rankName}"?`;
  if (text) {
    text.textContent = itemCount > 0
      ? `As ${itemCount} ${itemCount === 1 ? 'imagem' : 'imagens'} deste rank voltarão automaticamente para a reserva.`
      : 'Tem certeza que deseja excluir este rank?';
  }
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
}

function closeDeleteTierModal() {
  pendingTierRowToDelete = null;
  const modal = document.getElementById('confirmDeleteTierModal');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

export function setupDeleteTierModalEvents() {
  const modal     = document.getElementById('confirmDeleteTierModal');
  const backdrop  = document.getElementById('confirmDeleteTierBackdrop');
  const cancelBtn = document.getElementById('cancelDeleteTierBtn');
  const proceedBtn= document.getElementById('proceedDeleteTierBtn');

  if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteTierModal);
  if (backdrop)  backdrop.addEventListener('click',  closeDeleteTierModal);

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      if (pendingTierRowToDelete) {
        const row      = pendingTierRowToDelete;
        const items    = row.querySelectorAll('.tier-item');
        const rankName = row.querySelector('.tier-label span')?.textContent?.trim() || 'Rank';
        performWithSmoothHeightTransition(() => {
          items.forEach(item => imagePool.appendChild(item));
          sortPoolInOrder();
          row.remove();
          updatePoolState();
          renderExistingTiersEditList();
        });
        showToast(`Rank "${rankName}" removido com sucesso.`);
      }
      closeDeleteTierModal();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeDeleteTierModal();
  });
}

// ── Lista de ranks existentes ─────────────────────────────────────────────────

export function renderExistingTiersEditList() {
  const container = document.getElementById('editExistingTiersList');
  if (!container || !tierlistBoard) return;
  container.innerHTML = '';

  const rows = tierlistBoard.querySelectorAll('.tier-row');
  if (rows.length === 0) {
    container.innerHTML = '<span style="color:#94a3b8;font-size:.85rem;padding:4px;text-align:center">Nenhum rank disponível.</span>';
    return;
  }

  function syncBoardOrder() {
    const items = container.querySelectorAll('.existing-tier-edit-item');
    performWithSmoothHeightTransition(() => {
      items.forEach(it => {
        const target = tierlistBoard.querySelector(`.tier-row[data-tier-id="${it.dataset.tierId}"]`);
        if (target) tierlistBoard.appendChild(target);
      });
    });
  }

  rows.forEach((row, index) => {
    const tierId   = row.dataset.tierId;
    const labelSpan= row.querySelector('.tier-label span');
    const labelDiv = row.querySelector('.tier-label');
    const tierName = labelSpan?.textContent.trim() || `Rank ${index + 1}`;
    const tierColor= labelDiv?.style.backgroundColor || '#a855f7';

    const item = document.createElement('div');
    item.className = 'existing-tier-edit-item';
    item.dataset.tierId = tierId;

    const colorBadge = Object.assign(document.createElement('div'), {
      className: 'existing-tier-color-badge',
      title: `Cor do rank: ${tierName}`
    });
    colorBadge.style.backgroundColor = tierColor;

    const reorderBtns = document.createElement('div');
    reorderBtns.className = 'existing-tier-reorder-btns';

    const makeBtn = (cls, label, text, onClick) => {
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: cls, title: label, textContent: text });
      btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      return btn;
    };

    reorderBtns.appendChild(makeBtn('btn-tier-item-move btn-move-up', 'Subir rank (▲)', '▲', () => {
      const prev = item.previousElementSibling;
      if (prev?.classList.contains('existing-tier-edit-item')) { container.insertBefore(item, prev); syncBoardOrder(); }
    }));
    reorderBtns.appendChild(makeBtn('btn-tier-item-move btn-move-down', 'Descer rank (▼)', '▼', () => {
      const next = item.nextElementSibling;
      if (next?.classList.contains('existing-tier-edit-item')) { container.insertBefore(next, item); syncBoardOrder(); }
    }));

    const input = Object.assign(document.createElement('input'), {
      type: 'text', className: 'existing-tier-input',
      value: tierName, placeholder: `Nome do rank ${index + 1}...`
    });
    input.addEventListener('input', () => {
      if (labelSpan) labelSpan.textContent = input.value.trim() || `Rank ${index + 1}`;
    });

    const delBtn = makeBtn('btn-tier-item-del', `Excluir rank "${tierName}"`, '×', () => {
      const targetRow = tierlistBoard.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      if (targetRow) openDeleteTierModal(targetRow);
    });

    item.append(colorBadge, reorderBtns, input, delBtn);
    container.appendChild(item);
  });

  window.syncTiersScrollbar?.();
}

// ── Criação de rank customizado ───────────────────────────────────────────────

export function createCustomTierRow(tierId, name, color, position = 'bottom') {
  const row = document.createElement('div');
  row.className = 'tier-row';
  row.dataset.tierId = tierId;
  row.innerHTML = `
    <div class="tier-label" style="background-color:${color}">
      <span>${name}</span>
    </div>
    <div class="tier-dropzone" data-zone-id="${tierId}"></div>
  `;
  setupSingleDropzone(row.querySelector('.tier-dropzone'));
  if (tierlistBoard) {
    position === 'top' ? tierlistBoard.prepend(row) : tierlistBoard.appendChild(row);
  }
  renderExistingTiersEditList();
  return row;
}

// ── Painel principal de edição ────────────────────────────────────────────────

export function toggleEditMode(forceState = null) {
  const panel    = document.getElementById('editModePanel');
  const newState = forceState !== null ? forceState : !document.body.classList.contains('edit-mode-active');

  document.body.classList.toggle('edit-mode-active', newState);
  if (panel) {
    panel.classList.toggle('open', newState);
    panel.setAttribute('aria-hidden', String(!newState));
  }
  if (newState) { renderExistingTiersEditList(); showToast('Eu quero, Eu posso'); }
  else            showToast('Painel fechado');
}

export function setupEditMode() {
  const closeBtn = document.getElementById('closeEditModeBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => toggleEditMode(false));

  window.addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable) return;
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); toggleEditMode(); }
  });

  // ── Adicionar Novo Filme ──────────────────────────────────────────────────
  const fileInput       = document.getElementById('customImgFileInput');
  const fileName        = document.getElementById('customImgFileName');
  const titleInput      = document.getElementById('customImgTitleInput');
  const previewBox      = document.getElementById('customImgPreviewBox');
  const previewImg      = document.getElementById('customImgPreview');
  const previewTitle    = document.getElementById('customImgPreviewTitle');
  const removePreviewBtn= document.getElementById('removeCustomImgPreviewBtn');
  const addImgBtn       = document.getElementById('addCustomImgBtn');

  let selectedDataUrl = null;

  const resetImgFields = () => {
    selectedDataUrl = null;
    if (fileInput)    fileInput.value = '';
    if (fileName)     fileName.textContent = 'Escolher Imagem...';
    if (titleInput)   titleInput.value = '';
    if (previewBox)   previewBox.style.display = 'none';
    if (previewImg)   previewImg.src = '';
  };

  fileInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileName) fileName.textContent = file.name;
    if (titleInput && !titleInput.value.trim()) titleInput.value = extractTitle(file.name);
    if (previewTitle) previewTitle.textContent = titleInput?.value.trim() || 'Novo Filme';
    const reader = new FileReader();
    reader.onload = ev => {
      selectedDataUrl = ev.target.result;
      if (previewImg)  previewImg.src = selectedDataUrl;
      if (previewBox)  previewBox.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  titleInput?.addEventListener('input', () => {
    if (previewTitle) previewTitle.textContent = titleInput.value.trim() || 'Novo Filme';
  });

  removePreviewBtn?.addEventListener('click', () => { resetImgFields(); showToast('Imagem selecionada removida'); });

  addImgBtn?.addEventListener('click', () => {
    if (!selectedDataUrl) { alert('Por favor, escolha um arquivo de imagem do seu computador!'); return; }
    const customTitle = titleInput?.value.trim() || 'Novo Filme';
    const order       = getNextConsecutiveOrder();
    performWithSmoothHeightTransition(() => {
      const item = createTierItem(selectedDataUrl, customTitle, imagePool, null);
      item.dataset.order = order;
      sortPoolInOrder();
      updatePoolState();
    });
    showToast(`Filme "${customTitle}" adicionado à reserva!`);
    resetImgFields();
  });

  // ── Adicionar Novo Rank ───────────────────────────────────────────────────
  const tierNameInput     = document.getElementById('customTierNameInput');
  const tierColorInput    = document.getElementById('customTierColorInput');
  const colorPresets      = document.getElementById('colorPresets');
  const previewBanner     = document.getElementById('tierPreviewBanner');
  const previewText       = document.getElementById('tierPreviewText');
  const addTopBtn         = document.getElementById('addCustomTierTopBtn');
  const addBottomBtn      = document.getElementById('addCustomTierBottomBtn');

  colorPresets?.addEventListener('click', e => {
    const chip = e.target.closest('.color-chip');
    if (!chip) return;
    const color = chip.dataset.color;
    if (tierColorInput)  tierColorInput.value = color;
    if (previewBanner)   previewBanner.style.backgroundColor = color;
    colorPresets.querySelectorAll('.color-chip').forEach(c => c.classList.toggle('active', c === chip));
  });

  tierColorInput?.addEventListener('input', () => {
    if (previewBanner) previewBanner.style.backgroundColor = tierColorInput.value;
    colorPresets?.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
  });

  tierNameInput?.addEventListener('input', () => {
    if (previewText) previewText.textContent = tierNameInput.value.trim() || 'Novo Rank';
  });

  const handleCreateRank = position => {
    const name  = tierNameInput?.value.trim() || 'Novo Rank';
    const color = tierColorInput?.value || '#a855f7';
    const id    = `custom-tier-${Date.now()}`;
    performWithSmoothHeightTransition(() => createCustomTierRow(id, name, color, position));

    const list = document.getElementById('editExistingTiersList');
    if (list) setTimeout(() => { list.scrollTop = position === 'top' ? 0 : list.scrollHeight; }, 50);
    showToast(`Rank "${name}" adicionado ${position === 'top' ? 'ao topo' : 'na base'}!`);
    if (tierNameInput)  tierNameInput.value = '';
    if (previewText)    previewText.textContent = 'Novo Rank';
  };

  addTopBtn?.addEventListener('click',    () => handleCreateRank('top'));
  addBottomBtn?.addEventListener('click', () => handleCreateRank('bottom'));

  // ── Reordenar ranks via botões ▲/▼ no board ───────────────────────────────
  tierlistBoard?.addEventListener('click', e => {
    const upBtn  = e.target.closest('.btn-tier-up');
    const downBtn= e.target.closest('.btn-tier-down');
    const delBtn = e.target.closest('.btn-tier-del');

    if (upBtn) {
      const row  = upBtn.closest('.tier-row');
      const prev = row?.previousElementSibling;
      if (prev?.classList.contains('tier-row')) {
        performWithSmoothHeightTransition(() => { tierlistBoard.insertBefore(row, prev); renderExistingTiersEditList(); });
      }
    } else if (downBtn) {
      const row  = downBtn.closest('.tier-row');
      const next = row?.nextElementSibling;
      if (next?.classList.contains('tier-row')) {
        performWithSmoothHeightTransition(() => { tierlistBoard.insertBefore(next, row); renderExistingTiersEditList(); });
      }
    } else if (delBtn) {
      const row = delBtn.closest('.tier-row');
      if (row) openDeleteTierModal(row);
    }
  });
}

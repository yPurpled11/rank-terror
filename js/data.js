// js/data.js — Carregamento e salvamento do ranking

import { saveRankingBtn, saveRankingText, imagePool, tierlistBoard } from './state.js';
import { createTierItem, sortPoolInOrder, updatePoolState } from './ui.js';
import { resolveItem, normalizeFilename, extractTitle } from './utils.js';
import { createCustomTierRow } from './editMode.js';

function hasRankedItems(state) {
  return state?.tiers && Object.values(state.tiers).some(items => Array.isArray(items) && items.length > 0);
}

export async function loadRankingData() {
  let dataToLoad = null;

  // 1. localStorage como fallback local
  let localSaved = null;
  try {
    const saved = localStorage.getItem('ranking_terror_state');
    if (saved) localSaved = JSON.parse(saved);
  } catch (e) { console.warn('Erro ao ler localStorage:', e); }

  // 2. Tenta carregar da nuvem (Vercel Blob / Upstash)
  try {
    const res = await fetch('/api/ranking', { cache: 'no-store' });
    if (res.ok) {
      const cloud = await res.json();
      if (cloud && (cloud._source === 'vercel-blob' || cloud._source === 'upstash'
          || (!cloud.isDefault && hasRankedItems(cloud)))) {
        dataToLoad = cloud;
        try { localStorage.setItem('ranking_terror_state', JSON.stringify(cloud)); } catch {}
      }
    }
  } catch {}

  // 3. Preserva localStorage se a nuvem trouxe estado padrão vazio
  if (!dataToLoad && localSaved && hasRankedItems(localSaved)) dataToLoad = localSaved;

  // 4. Fallback final
  if (!dataToLoad) dataToLoad = localSaved || window.RANKING_DATA;
  if (!dataToLoad) return;

  // Limpa itens existentes
  document.querySelectorAll('.tier-item').forEach(el => el.remove());

  // Restaura tiers (ordem, nomes, cores, ranks customizados)
  if (dataToLoad.tierOrder?.length > 0) {
    dataToLoad.tierOrder.forEach(tierId => {
      let row = document.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      const name  = dataToLoad.tierNames?.[tierId]  || tierId;
      const color = dataToLoad.tierColors?.[tierId] || '#bfff7f';
      if (!row) {
        row = createCustomTierRow(tierId, name, color, false);
      } else {
        const labelDiv  = row.querySelector('.tier-label');
        const labelSpan = labelDiv?.querySelector('span');
        if (color && labelDiv) labelDiv.style.backgroundColor = color;
        if (labelSpan) labelSpan.textContent = name;
      }
      tierlistBoard.appendChild(row);
    });
    // Remove tiers deletados pelo usuário
    document.querySelectorAll('.tier-row').forEach(row => {
      if (!dataToLoad.tierOrder.includes(row.dataset.tierId)) row.remove();
    });
  } else if (dataToLoad.tierNames) {
    Object.entries(dataToLoad.tierNames).forEach(([tierId, name]) => {
      const row      = document.querySelector(`.tier-row[data-tier-id="${tierId}"]`);
      const labelDiv = row?.querySelector('.tier-label');
      if (!labelDiv) return;
      const span = labelDiv.querySelector('span');
      if (span) span.textContent = name;
      if (dataToLoad.tierColors?.[tierId]) labelDiv.style.backgroundColor = dataToLoad.tierColors[tierId];
    });
  }

  // Popula tiers ranqueados
  if (dataToLoad.tiers) {
    Object.entries(dataToLoad.tiers).forEach(([tierId, items]) => {
      const zone = document.querySelector(`.tier-dropzone[data-zone-id="${tierId}"]`);
      if (zone && Array.isArray(items)) {
        items.forEach(imgData => {
          const { src, title, order } = resolveItem(imgData);
          const item = createTierItem(src, title, zone, src);
          if (order !== null) item.dataset.order = order;
        });
      }
    });
  }

  // Popula galeria (unranked)
  dataToLoad.unranked?.forEach?.(imgData => {
    const { src, title, order } = resolveItem(imgData);
    const item = createTierItem(src, title, imagePool, src);
    if (order !== null) item.dataset.order = order;
  });

  // Garante que novas imagens oficiais apareçam mesmo com ranking salvo
  const loadedKeys = new Set();
  document.querySelectorAll('.tier-item').forEach(el => {
    const rel = el.dataset.relPath || el.querySelector('img')?.getAttribute('src');
    if (rel) loadedKeys.add(normalizeFilename(rel));
  });

  window.RANKING_DATA?.unranked?.forEach?.(imgData => {
    const { src, title } = resolveItem(imgData);
    const key = normalizeFilename(src);
    if (!loadedKeys.has(key)) {
      createTierItem(src, title, imagePool, src);
      loadedKeys.add(key);
    }
  });

  sortPoolInOrder();
  updatePoolState();
}

export function getCurrentRankingState() {
  const state = { tierOrder: [], tierNames: {}, tierColors: {}, tiers: {}, unranked: [] };

  document.querySelectorAll('.tier-row').forEach(row => {
    const tierId    = row.dataset.tierId;
    const labelDiv  = row.querySelector('.tier-label');
    const labelSpan = labelDiv?.querySelector('span');
    state.tierOrder.push(tierId);
    state.tierNames[tierId]  = labelSpan?.textContent.trim() || tierId;
    state.tierColors[tierId] = labelDiv?.style.backgroundColor || '';
    state.tiers[tierId] = [];
    row.querySelector('.tier-dropzone')?.querySelectorAll('.tier-item').forEach(item => {
      const img = item.querySelector('img');
      state.tiers[tierId].push({
        src:   item.dataset.relPath || img.getAttribute('src'),
        title: extractTitle(item.title),
        order: item.dataset.order
      });
    });
  });

  imagePool.querySelectorAll('.tier-item').forEach(item => {
    const img = item.querySelector('img');
    state.unranked.push({
      src:   item.dataset.relPath || img.getAttribute('src'),
      title: extractTitle(item.title),
      order: item.dataset.order
    });
  });

  return state;
}

export async function saveRankingToDatabase() {
  if (!saveRankingBtn) return;
  const state = getCurrentRankingState();

  try { localStorage.setItem('ranking_terror_state', JSON.stringify(state)); }
  catch (e) { console.warn('Erro ao salvar no localStorage:', e); }

  saveRankingBtn.classList.add('btn-saving');
  saveRankingBtn.classList.remove('btn-saved', 'btn-error');
  if (saveRankingText) saveRankingText.textContent = 'Salvando...';

  const finish = msg => {
    saveRankingBtn.classList.remove('btn-saving');
    saveRankingBtn.classList.add('btn-saved');
    if (saveRankingText) saveRankingText.textContent = msg;
    setTimeout(() => {
      saveRankingBtn.classList.remove('btn-saved');
      if (saveRankingText) saveRankingText.textContent = 'Salvar Ranking';
    }, 2800);
  };

  try {
    const res  = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    const data = await res.json().catch(() => ({}));
    finish(res.ok && data.provider === 'vercel-blob' ? 'Salvo no Blob!' : 'Salvo no Navegador!');
  } catch {
    finish('Salvo no Navegador!');
  }
}

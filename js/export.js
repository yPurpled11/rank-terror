// js/export.js — Exportação da tier list como imagem PNG

import { exportImageBtn, tierlistBoard } from './state.js';

export async function exportTierList() {
  const board          = document.getElementById('tierlistBoard');
  const originalBtnText= exportImageBtn.innerHTML;

  try {
    exportImageBtn.disabled = true;
    exportImageBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      Baixando...
    `;

    const deleteBtns     = board.querySelectorAll('.item-delete-btn');
    const reorderCtrls   = board.querySelectorAll('.tier-reorder-controls');
    deleteBtns.forEach(b => b.style.display = 'none');
    reorderCtrls.forEach(c => c.style.display = 'none');

    let canvas = null;
    if (typeof html2canvas !== 'undefined') {
      try {
        canvas = await html2canvas(board, {
          backgroundColor: '#181b22', scale: 2, useCORS: true, allowTaint: true, logging: false
        });
      } catch (err) { console.warn('html2canvas falhou, usando renderizador nativo:', err); }
    }

    deleteBtns.forEach(b => b.style.display = '');
    reorderCtrls.forEach(c => c.style.display = '');

    if (!canvas) canvas = await renderFullNativeCanvas();
    triggerCanvasDownload(canvas);
  } catch (error) {
    console.error('Erro ao exportar imagem:', error);
    try { triggerCanvasDownload(await renderFullNativeCanvas()); }
    catch { alert('Não foi possível gerar a imagem da tier list.'); }
  } finally {
    exportImageBtn.disabled = false;
    exportImageBtn.innerHTML = originalBtnText;
  }
}

function triggerCanvasDownload(canvas) {
  const filename = `ranking-do-terror-${Date.now()}.png`;
  const download = (href) => {
    const a = Object.assign(document.createElement('a'), { style: 'display:none', download: filename, href });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
  };

  if (canvas.toBlob) {
    canvas.toBlob(blob => {
      if (!blob) { download(canvas.toDataURL('image/png')); return; }
      const url = URL.createObjectURL(blob);
      download(url);
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }, 'image/png');
  } else {
    download(canvas.toDataURL('image/png'));
  }
}

async function renderFullNativeCanvas() {
  const rows       = tierlistBoard.querySelectorAll('.tier-row');
  const canvas     = document.createElement('canvas');
  const ctx        = canvas.getContext('2d');
  const boardWidth = 1080, labelWidth = 145, itemSize = 88, padding = 10, gap = 8;

  const rowLayouts = [];
  let totalHeight  = 0;

  rows.forEach(row => {
    const label         = row.querySelector('.tier-label');
    const color         = window.getComputedStyle(label).backgroundColor;
    const text          = label.textContent.trim();
    const items         = Array.from(row.querySelectorAll('.tier-item'));
    const availableW    = boardWidth - labelWidth - padding * 2;
    const itemsPerRow   = Math.max(1, Math.floor((availableW + gap) / (itemSize + gap)));
    const numLines      = Math.max(1, Math.ceil(items.length / itemsPerRow));
    const rowHeight     = Math.max(96, padding * 2 + numLines * itemSize + (numLines - 1) * gap);

    rowLayouts.push({ color, text, items, rowHeight, y: totalHeight, itemsPerRow });
    totalHeight += rowHeight;
  });

  canvas.width  = boardWidth * 2;
  canvas.height = totalHeight * 2;
  ctx.scale(2, 2);

  ctx.fillStyle = '#16181e';
  ctx.fillRect(0, 0, boardWidth, totalHeight);

  rowLayouts.forEach(layout => {
    ctx.fillStyle = layout.color;
    ctx.fillRect(0, layout.y, labelWidth, layout.rowHeight);

    ctx.fillStyle = '#0b0d11';
    ctx.font = '800 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, layout.text, labelWidth / 2, layout.y + layout.rowHeight / 2, labelWidth - 20, 20);

    ctx.fillStyle = '#171920';
    ctx.fillRect(labelWidth, layout.y, boardWidth - labelWidth, layout.rowHeight);

    layout.items.forEach((item, index) => {
      const col = index % layout.itemsPerRow;
      const line= Math.floor(index / layout.itemsPerRow);
      const x   = labelWidth + padding + col * (itemSize + gap);
      const y   = layout.y + padding + line * (itemSize + gap);
      const img = item.querySelector('img');
      if (img?.complete && img.naturalWidth > 0) {
        ctx.save();
        drawRoundedRect(ctx, x, y, itemSize, itemSize, 6);
        ctx.clip();
        ctx.drawImage(img, x, y, itemSize, itemSize);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, x, y, itemSize, itemSize, 6);
        ctx.stroke();
      }
    });

    ctx.fillStyle = '#262933';
    ctx.fillRect(0, layout.y + layout.rowHeight - 2, boardWidth, 2);
  });

  return canvas;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line.trim()); line = word + ' '; }
    else line = test;
  }
  lines.push(line.trim());
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

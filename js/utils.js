// js/utils.js — Funções utilitárias puras (sem dependências de estado DOM)

/**
 * Extrai título limpo de um caminho de arquivo, removendo prefixos numéricos
 * (e.g. "1. ", "7.1 . ", "01 - ")
 */
export function extractTitle(path) {
  if (!path) return 'Imagem';
  const filename = path.split('/').pop().split('\\').pop();
  let clean = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
  clean = clean.replace(/^[\d\.]+\s*[\.\-_]?\s*/, '');
  clean = clean.replace(/\s*\(Clique para ampliar\)/gi, '');
  return clean.trim();
}

/**
 * Extrai número de ordem numérico do filename (ex: "7.1 . Criatura..." → 7.1)
 */
export function extractOrder(path) {
  if (!path) return 9999;
  const filename = path.split('/').pop().split('\\').pop();
  const match = decodeURIComponent(filename).match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 9999;
}

/**
 * Normaliza filename para comparação (lowercase, sem path, sem encoding)
 */
export function normalizeFilename(p) {
  return p ? decodeURIComponent(p.split('/').pop().split('\\').pop().toLowerCase().trim()) : '';
}

/**
 * Resolve item de dados (string ou objeto) para { src, title, order }
 */
export function resolveItem(imgData) {
  const src   = typeof imgData === 'string' ? imgData : imgData.src;
  const title = typeof imgData === 'string' ? extractTitle(imgData) : (imgData.title || extractTitle(src));
  const order = (typeof imgData === 'object' && imgData.order !== undefined && imgData.order !== null)
    ? imgData.order : null;
  return { src, title, order };
}

/**
 * Aguarda um array de imagens carregarem, com timeout de segurança
 */
export function waitForImages(imgs, timeoutMs = 5000) {
  if (!imgs.length) return Promise.resolve();
  const loads = imgs.map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise(res => {
          img.addEventListener('load',  res, { once: true });
          img.addEventListener('error', res, { once: true });
        })
  );
  return Promise.race([Promise.all(loads), new Promise(res => setTimeout(res, timeoutMs))]);
}

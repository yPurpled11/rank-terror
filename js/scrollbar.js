// js/scrollbar.js — Scrollbar customizada para a lista de ranks no modo edição

export function setupCustomScrollbar() {
  const list  = document.getElementById('editExistingTiersList');
  const track = document.getElementById('tiersScrollTrack');
  const thumb = document.getElementById('tiersScrollThumb');
  if (!list || !track || !thumb) return;

  function updateThumb() {
    const { scrollTop, scrollHeight, clientHeight } = list;
    const trackH  = track.clientHeight;
    const ratio   = clientHeight / scrollHeight;
    const thumbH  = Math.max(24, trackH * ratio);
    const maxTop  = trackH - thumbH;
    const top     = scrollHeight > clientHeight
      ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
    thumb.style.height = thumbH + 'px';
    thumb.style.top    = top + 'px';
    track.classList.toggle('is-visible', scrollHeight > clientHeight);
  }

  list.addEventListener('scroll', updateThumb);

  // Clique no track → pula para a posição
  track.addEventListener('mousedown', e => {
    if (e.target === thumb) return;
    const rect  = track.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / track.clientHeight;
    list.scrollTop = ratio * (list.scrollHeight - list.clientHeight);
    e.preventDefault();
  });

  // Drag do thumb
  let dragging = false, startY = 0, startScroll = 0;

  thumb.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    startScroll = list.scrollTop;
    thumb.classList.add('dragging');
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta    = e.clientY - startY;
    const scrollable = list.scrollHeight - list.clientHeight;
    const ratio    = scrollable / (track.clientHeight - thumb.offsetHeight);
    list.scrollTop = startScroll + delta * ratio;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('dragging');
  });

  // Atualiza quando a lista muda (re-render de ranks)
  new MutationObserver(updateThumb).observe(list, { childList: true, subtree: true });
  updateThumb();

  // Expõe para uso externo
  window.syncTiersScrollbar = updateThumb;
}

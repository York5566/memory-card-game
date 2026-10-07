// Match Chromium's default fullscreen bubble: 3800ms shown, 700ms fade-out.
// The browser does not expose its own bubble's actual visibility to the page.
export function createFullscreenHint(notice, isActive, place = () => {}) {
  let fade, dismiss;
  const cancel = () => {
    clearTimeout(fade); clearTimeout(dismiss);
    notice.hidden = true; notice.textContent = '';
    delete notice.dataset.state;
  };
  const schedule = () => {
    cancel();
    if (!isActive()) return;
    notice.textContent = 'CTRL+滾輪可以調整畫面大小';
    notice.dataset.state = 'visible';
    notice.hidden = false;
    place();
    fade = setTimeout(() => {
      if (!isActive()) { cancel(); return; }
      notice.dataset.state = 'closing';
    }, 3800);
    dismiss = setTimeout(cancel, 4500);
  };
  return { schedule, cancel };
}

// Prefer an upper corner; a shorter screen can use empty stage background.
// Only the fixed overlay moves. Never change the game's padding or dimensions.
export function positionFullscreenHint(notice, panel) {
  const width = window.innerWidth, height = window.innerHeight;
  const size = notice.getBoundingClientRect(), margin = 16;
  const protectedRects = [...panel.querySelectorAll('#rules-label, #fullscreen, .stats, .game-controls, .logo-canvas, .card-grid, #game-status')]
    .map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
  for (const element of panel.querySelectorAll('.stage-copy h2, .stage-copy p')) {
    const range = document.createRange(); range.selectNodeContents(element);
    protectedRects.push(...range.getClientRects());
  }
  const stage = panel.querySelector('.stage').getBoundingClientRect();
  const columns = [width - size.width - margin, margin, (width - size.width) / 2];
  const rows = [88, Math.max(88, stage.top + 12)];
  let best, lowest = Infinity;
  for (const top of rows) {
    for (const left of columns) {
      if (top + size.height > height - margin || left < margin) continue;
      const overlap = protectedRects.reduce((total, rect) => total +
        Math.max(0, Math.min(left + size.width + 8, rect.right) - Math.max(left - 8, rect.left)) *
        Math.max(0, Math.min(top + size.height + 8, rect.bottom) - Math.max(top - 8, rect.top)), 0);
      if (overlap < lowest) { best = { left, top }; lowest = overlap; }
      if (overlap === 0) break;
    }
    if (lowest === 0) break;
  }
  if (best) { notice.style.left = `${best.left}px`; notice.style.top = `${best.top}px`; notice.style.right = 'auto'; }
}

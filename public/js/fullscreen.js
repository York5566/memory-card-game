// Match Chromium's default bubble: 350ms fade-in, fade-out at 3800ms for 700ms.
// The browser does not expose its own bubble's actual visibility to the page.
export function createFullscreenHint(notice, isActive, decorate = () => {}) {
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
    decorate();
    notice.dataset.state = 'visible';
    // Flush the hidden state so re-entry starts a fresh CSS fade-in.
    void notice.offsetWidth;
    notice.hidden = false;
    fade = setTimeout(() => {
      if (!isActive()) { cancel(); return; }
      notice.dataset.state = 'closing';
    }, 3800);
    dismiss = setTimeout(cancel, 4500);
  };
  return { schedule, cancel };
}

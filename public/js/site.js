import { t } from './i18n.js';
import config from './site-config.js';
export function navigateLanguage(href, language) {
  if (window.memoryGameLanguage) window.memoryGameLanguage.navigate(href, language);
  else window.location.assign(href);
}
document.querySelectorAll('[data-language-link]').forEach(link => link.addEventListener('click', event => {
  const language = link.lang;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
    window.memoryGameLanguage?.remember(language); return;
  }
  event.preventDefault();
  if (language === document.documentElement.lang) {
    window.memoryGameLanguage?.remember(language);
    link.closest('details')?.removeAttribute('open'); return;
  }
  const change = new CustomEvent('languagechange-request', { cancelable: true, detail: { href: link.href, language } });
  if (document.dispatchEvent(change)) navigateLanguage(link.href, language);
}));
const current = document.querySelector(`[data-nav="${document.body.dataset.page}"]`);
if (current) current.setAttribute('aria-current', 'page');
// An inactive ad configuration never contacts Google. Demo placements work fully offline.
for (const host of document.querySelectorAll('[data-ad-placement]')) {
  if (config.ads.demo) {
    host.className = 'ad-demo'; host.textContent = t('廣告版位示意（未載入真實廣告）');
  } else if (config.ads.enabled && config.ads.consentReady && /^ca-pub-\d{16}$/.test(config.ads.publisher) && /^\d+$/.test(config.ads.slot)) {
    const ad = document.createElement('ins'); ad.className = 'adsbygoogle'; ad.style.display = 'block';
    ad.dataset.adClient = config.ads.publisher; ad.dataset.adSlot = config.ads.slot; ad.dataset.adFormat = 'auto'; ad.dataset.fullWidthResponsive = 'true';
    host.className = 'ad-live'; host.append(ad);
    const script = document.createElement('script'); script.async = true; script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.ads.publisher}`;
    script.addEventListener('load', () => { try { (window.adsbygoogle ||= []).push({}); } catch { host.hidden = true; } });
    script.addEventListener('error', () => host.hidden = true); document.head.append(script);
  }
}
export function toast(text) { const box = document.querySelector('#toast'); box.textContent = text; box.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove('visible'), 4500); }
export function confirmAction(title, message, label = t('確定')) {
  return new Promise(resolve => {
    const dialog = document.querySelector('#confirm-dialog'); const prior = document.activeElement;
    dialog.querySelector('#confirm-title').textContent = title; dialog.querySelector('#confirm-message').textContent = message;
    dialog.querySelector('#confirm-ok').textContent = label;
    const finish = value => { dialog.close(); dialog.removeEventListener('cancel', cancel); dialog.querySelector('#confirm-ok').onclick = null; dialog.querySelector('#confirm-cancel').onclick = null; prior?.focus(); resolve(value); };
    const cancel = event => { event.preventDefault(); finish(false); };
    dialog.addEventListener('cancel', cancel); dialog.querySelector('#confirm-ok').onclick = () => finish(true); dialog.querySelector('#confirm-cancel').onclick = () => finish(false);
    dialog.showModal(); dialog.querySelector('#confirm-cancel').focus();
  });
}

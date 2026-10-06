import site from './site-config.js';
import { encodeProfile, decodeProfile, readLimited, LIMITS, sha256, normalizeCode, validCode } from './profile-format.js';
import { getImage, putImages } from './images.js';
export const cloudReady = () => Boolean(site.cloud?.apiURL && site.cloud?.siteKey && !site.cloud.preview && window.location.origin === site.cloud.origin);
const receiptKey = 'memory-cloud-receipts', pendingKey = 'memory-cloud-pending';
export function receipts() { try { return JSON.parse(localStorage.getItem(receiptKey) || '[]'); } catch { return []; } }
function remember(receipt) {
  const rows = receipts().filter(row => row.code !== receipt.code); rows.unshift(receipt);
  localStorage.setItem(receiptKey, JSON.stringify(rows));
}
let scriptPromise;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    const timeout = setTimeout(() => { script.remove(); scriptPromise = null; reject(new Error('驗證元件載入逾時，請稍後再試。')); }, 20000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); scriptPromise = null; reject(new Error('無法載入驗證元件，請檢查網路或內容阻擋設定。')); };
    document.head.append(script);
  });
  return scriptPromise;
}
async function challenge(host, action) {
  if (!cloudReady()) throw new Error('雲端代碼功能尚未啟用；目前仍可在此瀏覽器使用自訂圖片。');
  await loadTurnstile();
  host.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return new Promise((resolve, reject) => {
    let widget, done = false;
    const finish = (error, token) => { if (done) return; done = true; clearTimeout(timeout); if (widget !== undefined) window.turnstile.remove(widget); error ? reject(error) : resolve(token); };
    const timeout = setTimeout(() => finish(new Error('驗證逾時，請再試一次。')), 120000);
    widget = window.turnstile.render(host, { sitekey: site.cloud.siteKey, action, theme: 'light', language: 'zh-tw', callback: token => finish(null, token), 'error-callback': () => { finish(new Error('驗證未完成，請再試一次。')); return true; }, 'expired-callback': () => finish(new Error('驗證已過期，請重新操作。')) });
  });
}
async function call(path, options) {
  let response;
  try { response = await fetch(site.cloud.apiURL.replace(/\/$/, '') + path, { ...options, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000) }); }
  catch { throw new Error('無法連線到雲端。請檢查網路；若剛才正在保存，可按產生代碼重試，本機設定仍會保留。'); }
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || '雲端暫時無法使用，請稍後再試。'); }
  return response;
}
export async function saveCloud(config, host) {
  const bytes = await encodeProfile(config, getImage), digest = await sha256(bytes);
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(pendingKey) || 'null');
    if (!pending || pending.digest !== digest) pending = { digest, requestId: crypto.randomUUID(), owner: [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('') };
    localStorage.setItem(pendingKey, JSON.stringify(pending));
  } catch { throw new Error('瀏覽器無法保存管理憑證，請允許本機儲存後再產生代碼。'); }
  const token = await challenge(host, 'save');
  const response = await call('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Turnstile-Token': token, 'X-Request-Id': pending.requestId, 'X-Owner-Token': pending.owner }, body: bytes });
  const receipt = { ...await response.json(), owner: pending.owner };
  remember(receipt); localStorage.removeItem(pendingKey); return receipt;
}
export async function loadCloud(value, host) {
  if (!validCode(value)) throw new Error('請輸入完整的 12 位數字代碼。');
  const token = await challenge(host, 'load');
  const response = await call('/api/settings/load', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Turnstile-Token': token }, body: JSON.stringify({ code: normalizeCode(value) }) });
  const profile = await decodeProfile(await readLimited(response.body, LIMITS.packageBytes));
  await putImages(profile.images); return profile.config;
}
export async function deleteCloud(code, host) {
  const receipt = receipts().find(row => row.code === code); if (!receipt) throw new Error('此瀏覽器沒有這份設定的刪除憑證。');
  const token = await challenge(host, 'delete');
  await call(`/api/settings/${code}`, { method: 'DELETE', headers: { 'X-Owner-Token': receipt.owner, 'X-Turnstile-Token': token } });
  localStorage.setItem(receiptKey, JSON.stringify(receipts().filter(row => row.code !== code)));
}

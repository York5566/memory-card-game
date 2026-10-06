import { decodeProfile, readLimited, LIMITS, sha256, normalizeCode, validCode } from '../public/js/profile-format.js';

const DAY = 86400000;
export const QUOTA = Object.freeze({ bytes: 512 * 1024 * 1024, profiles: 1000, requests: 6000, saves: 100, loads: 2000, deletes: 1000, ipSaves: 5, ipLoads: 60, ipDeletes: 30 });
class HTTPError extends Error { constructor(status, message) { super(message); this.status = status; } }
function requireThat(condition, status, message) { if (!condition) throw new HTTPError(status, message); }
const json = (body, status = 200) => Response.json(body, { status });
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
async function counter(env, day, scope, limit) {
  const row = await statement(env, 'INSERT INTO mg_counters(day,scope,used) VALUES(?,?,1) ON CONFLICT(day,scope) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used', day, scope, limit).first();
  requireThat(row, 429, '今日雲端操作已達上限，請明天再試。本機遊戲與設定仍可使用。');
}
async function ipKey(env, request, day) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.IP_HASH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${day}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function verifyTurnstile(env, request, action) {
  const token = request.headers.get('X-Turnstile-Token');
  requireThat(token && token.length <= 2048, 403, '請完成驗證後再試一次。');
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
  });
  const result = await response.json();
  requireThat(result.success === true && result.hostname === new URL(request.headers.get('Origin')).hostname && result.action === action, 403, '驗證失敗或過期，請重新操作。');
}
function codeNumber() {
  let result = '';
  while (result.length < 12) for (const byte of crypto.getRandomValues(new Uint8Array(16))) { if (byte < 250) result += byte % 10; if (result.length === 12) break; }
  return result;
}
function owner(request) { const token = request.headers.get('X-Owner-Token') || ''; requireThat(/^[a-f0-9]{64}$/.test(token), 403, '缺少有效的管理憑證。'); return token; }
const hashText = text => sha256(new TextEncoder().encode(text));
const receipt = row => ({ code: row.code, expiresAt: row.expires_at, bytes: row.bytes });

async function save(request, env, now) {
  requireThat(request.headers.get('Content-Type')?.split(';')[0] === 'application/octet-stream', 415, '不支援此設定檔格式。');
  const requestId = request.headers.get('X-Request-Id') || '';
  requireThat(/^[a-f0-9-]{36}$/.test(requestId), 400, '缺少保存識別碼。');
  const ownerHash = await hashText(owner(request));
  let bytes, payload;
  try { bytes = await readLimited(request.body, LIMITS.packageBytes); payload = await decodeProfile(bytes); }
  catch { throw new HTTPError(400, '圖片或設定檔格式不正確，請重新選取圖片。'); }
  requireThat(payload.config.version === 1, 400, '請更新網站後再保存。');
  const payloadHash = await sha256(bytes);
  const prior = await statement(env, 'SELECT * FROM mg_profiles WHERE request_id=?', requestId).first();
  if (prior) {
    requireThat(prior.owner_hash === ownerHash && prior.payload_hash === payloadHash, 409, '保存識別碼已使用，請重新開啟設定。');
    requireThat(prior.status === 'ready' && prior.expires_at > now, 409, '這份設定仍在處理或已到期，請稍後再試。');
    return json(receipt(prior));
  }
  const expires = now + LIMITS.retentionDays * DAY;
  let row;
  for (let attempt = 0; attempt < 4 && !row; attempt++) {
    const code = codeNumber(), key = `profiles/${crypto.randomUUID()}.bin`;
    try {
      row = await statement(env, `INSERT INTO mg_profiles(code,object_key,request_id,owner_hash,payload_hash,bytes,status,created_at,last_used_at,expires_at)
        SELECT ?,?,?,?,?,?,'pending',?,?,? FROM mg_storage WHERE id=1 AND bytes+?<=? AND profiles+1<=? RETURNING *`,
      code, key, requestId, ownerHash, payloadHash, bytes.length, now, now, expires, bytes.length, QUOTA.bytes, QUOTA.profiles).first();
      requireThat(row, 507, '雲端容量已滿，請稍後再試，或刪除此瀏覽器之前建立的雲端檔。');
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed: mg_profiles.code')) continue;
      if (String(error.message).includes('UNIQUE constraint failed: mg_profiles.request_id')) throw new HTTPError(409, '同一份設定正在保存中，請稍後重試。');
      throw error;
    }
  }
  requireThat(row, 503, '暫時無法產生代碼，請重試。');
  try {
    await env.IMAGES.put(row.object_key, bytes, { httpMetadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' } });
    const ready = await statement(env, "UPDATE mg_profiles SET status='ready' WHERE code=? AND status='pending' RETURNING *", row.code).first();
    requireThat(ready, 503, '保存未完成，請重試。'); return json(receipt(ready), 201);
  } catch (error) {
    // Keep the reservation when deletion cannot be confirmed; cron retries it.
    try { await env.IMAGES.delete(row.object_key); await statement(env, 'DELETE FROM mg_profiles WHERE code=?', row.code).run(); } catch { /* bounded scheduled cleanup */ }
    throw error;
  }
}
async function load(request, env, now) {
  let code;
  try { code = normalizeCode(JSON.parse(new TextDecoder().decode(await readLimited(request.body, 256))).code); }
  catch { throw new HTTPError(400, '請輸入 12 位數字代碼。'); }
  requireThat(validCode(code), 400, '請輸入 12 位數字代碼。');
  const row = await statement(env, "UPDATE mg_profiles SET last_used_at=?,expires_at=? WHERE code=? AND status='ready' AND expires_at>? RETURNING object_key,expires_at,bytes", now, now + LIMITS.retentionDays * DAY, code, now).first();
  requireThat(row, 404, '找不到這組代碼，可能已到期或被刪除。');
  const object = await env.IMAGES.get(row.object_key);
  requireThat(object, 404, '這份圖片資料已無法讀取，請重新產生代碼。');
  return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(row.bytes), 'X-Expires-At': String(row.expires_at) } });
}
async function remove(request, env, code) {
  requireThat(validCode(code), 404, '找不到這組代碼。');
  const ownerHash = await hashText(owner(request));
  const row = await statement(env, "UPDATE mg_profiles SET status='deleting' WHERE code=? AND owner_hash=? AND status IN ('ready','deleting') RETURNING object_key", code, ownerHash).first();
  // Same response for missing codes and invalid credentials; expired receipts can be forgotten.
  if (row) { await env.IMAGES.delete(row.object_key); await statement(env, "DELETE FROM mg_profiles WHERE code=? AND status='deleting'", code).run(); }
  return json({ deleted: true });
}
export async function cleanup(env, now = Date.now()) {
  // Three indexed, bounded queries. No bucket listing or full-table scan.
  const rows = await env.DB.batch([
    statement(env, "SELECT code FROM mg_profiles WHERE status='ready' AND expires_at<=? ORDER BY expires_at LIMIT 20", now),
    statement(env, "SELECT code FROM mg_profiles WHERE status='pending' AND created_at<=? ORDER BY created_at LIMIT 20", now - 1800000),
    statement(env, "SELECT code FROM mg_profiles WHERE status='deleting' LIMIT 20"),
  ]);
  // Max 10 R2 deletes + D1 updates/deletes stays below 50 subrequests per invocation.
  for (const { code } of rows.flatMap(row => row.results).slice(0, 10)) {
    const row = await statement(env, "UPDATE mg_profiles SET status='deleting' WHERE code=? AND (status='deleting' OR (status='ready' AND expires_at<=?) OR (status='pending' AND created_at<=?)) RETURNING object_key", code, now, now - 1800000).first();
    if (!row) continue;
    try { await env.IMAGES.delete(row.object_key); await statement(env, "DELETE FROM mg_profiles WHERE code=? AND status='deleting'", code).run(); }
    catch { /* Retain row/reservation for the next hourly retry. */ }
  }
  await statement(env, 'DELETE FROM mg_counters WHERE rowid IN (SELECT rowid FROM mg_counters WHERE day<? LIMIT 500)', Math.floor(now / DAY) - 2).run();
}
export function createWorker({ verify = verifyTurnstile, now = () => Date.now() } = {}) {
  return {
    async fetch(request, env) {
      const origin = request.headers.get('Origin'), allowed = (env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim());
      let response;
      try {
        requireThat(origin && allowed.includes(origin), 403, '不允許此網站使用雲端服務。');
        const path = new URL(request.url).pathname;
        const action = request.method === 'POST' && path === '/api/settings' ? 'save' : request.method === 'POST' && path === '/api/settings/load' ? 'load' : request.method === 'DELETE' && /^\/api\/settings\/\d{12}$/.test(path) ? 'delete' : '';
        if (request.method === 'OPTIONS') {
          requireThat(path === '/api/settings' || path === '/api/settings/load' || /^\/api\/settings\/\d{12}$/.test(path), 404, '找不到此服務。');
          response = new Response(null, { status: 204 });
        } else {
          requireThat(action, 404, '找不到此服務。');
          requireThat(env.API_ENABLED === 'true' && env.DB && env.IMAGES && env.API_RATE_LIMITER && env.TURNSTILE_SECRET && env.IP_HASH_SECRET?.length >= 32, 503, '雲端功能尚未啟用或正在維護。本機遊戲仍可使用。');
          requireThat(Number(request.headers.get('Content-Length') || 0) <= (action === 'save' ? LIMITS.packageBytes : 256), 413, '資料超過容量上限。');
          const time = now(), day = Math.floor(time / DAY), ip = await ipKey(env, request, day);
          requireThat((await env.API_RATE_LIMITER.limit({ key: ip })).success, 429, '操作太頻繁，請稍等一分鐘再試。');
          await counter(env, day, 'requests', QUOTA.requests);
          await verify(env, request, action);
          await counter(env, day, `ip:${action}:${ip}`, action === 'save' ? QUOTA.ipSaves : action === 'load' ? QUOTA.ipLoads : QUOTA.ipDeletes);
          await counter(env, day, action, action === 'save' ? QUOTA.saves : action === 'load' ? QUOTA.loads : QUOTA.deletes);
          response = action === 'save' ? await save(request, env, time) : action === 'load' ? await load(request, env, time) : await remove(request, env, path.split('/').pop());
        }
      } catch (error) { response = json({ error: error instanceof HTTPError ? error.message : '雲端暫時無法使用，請稍後再試。本機資料仍會保留。' }, error instanceof HTTPError ? error.status : 503); }
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store'); headers.set('X-Content-Type-Options', 'nosniff'); headers.set('X-Robots-Tag', 'noindex, nofollow'); headers.set('Vary', 'Origin');
      if (origin && allowed.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin); headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Turnstile-Token, X-Request-Id, X-Owner-Token'); headers.set('Access-Control-Expose-Headers', 'X-Expires-At'); headers.set('Access-Control-Max-Age', '86400');
      }
      if (response.status === 429) headers.set('Retry-After', '60');
      return new Response(response.body, { status: response.status, headers });
    },
    async scheduled(_event, env, context) { context.waitUntil(cleanup(env)); },
  };
}
export default createWorker();

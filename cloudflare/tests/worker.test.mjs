import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { createWorker, cleanup, QUOTA } from '../worker.js';
import { defaults } from '../../public/js/core.js';
import { encodeProfile, decodeProfile } from '../../public/js/profile-format.js';
const migration = await readFile(new URL('../migrations/0001_profiles.sql', import.meta.url), 'utf8');
const owner = 'a'.repeat(64), origin = 'https://wwwne1198.party';
const packet = await encodeProfile(defaults(), () => null);
function fixture({ verify = async () => {} } = {}) {
  const sql = new DatabaseSync(':memory:'); sql.exec(migration);
  const objects = new Map(), ops = { get: 0, put: 0, delete: 0 }; let time = 1800000000000;
  const DB = { prepare(query) { const stmt = sql.prepare(query); let values = []; const bound = { bind(...args) { values = args; return bound; }, async first() { return stmt.get(...values) || null; }, async run() { return { success: true, meta: stmt.run(...values) }; }, async all() { return { results: stmt.all(...values) }; } }; return bound; }, async batch(rows) { return Promise.all(rows.map(row => row.all())); } };
  const env = { DB, IMAGES: { async put(key, value) { ops.put++; objects.set(key, value.slice()); }, async get(key) { ops.get++; const value = objects.get(key); return value ? { body: new Blob([value]).stream() } : null; }, async delete(key) { ops.delete++; objects.delete(key); } }, API_RATE_LIMITER: { async limit() { return { success: true }; } }, TURNSTILE_SECRET: 'test', IP_HASH_SECRET: 's'.repeat(32), API_ENABLED: 'true', ALLOWED_ORIGINS: origin };
  const worker = createWorker({ verify, now: () => time });
  const request = (path, method, body, extra = {}) => worker.fetch(new Request('https://api.example' + path, { method, body, headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.1', 'Content-Type': method === 'POST' && path === '/api/settings' ? 'application/octet-stream' : 'application/json', 'X-Owner-Token': owner, 'X-Request-Id': crypto.randomUUID(), 'X-Turnstile-Token': 'token', ...extra } }), env);
  return { env, sql, ops, objects, request, setTime: value => time = value, time: () => time, close: () => sql.close() };
}
test('保存、跨裝置載入、30 天續期與擁有者刪除走完整 SQL/R2 流程', async () => {
  const f = fixture(); try {
    const response = await f.request('/api/settings', 'POST', packet); assert.equal(response.status, 201);
    const row = await response.json(); assert.match(row.code, /^\d{12}$/); assert.equal(f.objects.size, 1);
    f.setTime(f.time() + 86400000 * 29);
    const load = await f.request('/api/settings/load', 'POST', JSON.stringify({ code: row.code })); assert.equal(load.status, 200);
    assert.deepEqual((await decodeProfile(new Uint8Array(await load.arrayBuffer()))).config, defaults());
    assert.equal(Number(load.headers.get('X-Expires-At')), f.time() + 86400000 * 30);
    await f.request(`/api/settings/${row.code}`, 'DELETE', undefined, { 'X-Owner-Token': 'b'.repeat(64) }); assert.equal(f.objects.size, 1);
    assert.equal((await f.request(`/api/settings/${row.code}`, 'DELETE')).status, 200); assert.equal(f.objects.size, 0);
    assert.equal(f.sql.prepare('SELECT bytes FROM mg_storage').get().bytes, 0);
  } finally { f.close(); }
});
test('相同請求重試取得相同代碼，R2 只寫一次', async () => {
  const f = fixture(); try {
    const headers = { 'X-Request-Id': crypto.randomUUID() };
    const a = await (await f.request('/api/settings', 'POST', packet, headers)).json();
    const b = await (await f.request('/api/settings', 'POST', packet, headers)).json();
    assert.equal(a.code, b.code); assert.equal(f.ops.put, 1);
    assert.equal((await f.request('/api/settings', 'POST', packet, { ...headers, 'X-Owner-Token': 'b'.repeat(64) })).status, 409);
  } finally { f.close(); }
});
test('同時保存遵守 1000 份容量預留，超額不寫 R2', async () => {
  const f = fixture(); try {
    f.sql.exec('UPDATE mg_storage SET profiles=999');
    const results = await Promise.all([f.request('/api/settings', 'POST', packet), f.request('/api/settings', 'POST', packet)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 507]); assert.equal(f.ops.put, 1);
  } finally { f.close(); }
});
test('512 MiB 硬上限拒絕新增，已有資料仍可讀取', async () => {
  const f = fixture(); try {
    const saved = await (await f.request('/api/settings', 'POST', packet)).json();
    f.sql.prepare('UPDATE mg_storage SET bytes=?').run(QUOTA.bytes);
    assert.equal((await f.request('/api/settings', 'POST', packet)).status, 507);
    assert.equal((await f.request('/api/settings/load', 'POST', JSON.stringify({ code: saved.code }))).status, 200);
  } finally { f.close(); }
});
test('IP 每日保存上限與次日重置；全站讀取上限擋在 R2 前', async () => {
  const f = fixture(); try {
    for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/settings', 'POST', packet)).status, 201);
    assert.equal((await f.request('/api/settings', 'POST', packet)).status, 429); assert.equal(f.ops.put, 5);
    f.setTime(f.time() + 86400000); assert.equal((await f.request('/api/settings', 'POST', packet)).status, 201);
    f.sql.prepare('INSERT INTO mg_counters VALUES(?,?,?)').run(Math.floor(f.time() / 86400000), 'load', QUOTA.loads);
    assert.equal((await f.request('/api/settings/load', 'POST', '{"code":"123456789012"}')).status, 429); assert.equal(f.ops.get, 0);
  } finally { f.close(); }
});
test('到期立即拒絕讀取，定時清理釋放 R2 及配额，不刪未到期資料', async () => {
  const f = fixture(); try {
    const first = await (await f.request('/api/settings', 'POST', packet)).json(); f.setTime(f.time() + 86400000 * 29);
    const second = await (await f.request('/api/settings', 'POST', packet)).json(); f.setTime(f.time() + 86400000);
    assert.equal((await f.request('/api/settings/load', 'POST', JSON.stringify({ code: first.code }))).status, 404);
    await cleanup(f.env, f.time()); assert.equal(f.objects.size, 1); assert.equal(f.sql.prepare('SELECT profiles FROM mg_storage').get().profiles, 1);
    assert.equal((await f.request('/api/settings/load', 'POST', JSON.stringify({ code: second.code }))).status, 200);
  } finally { f.close(); }
});
test('R2 寫入與刪除失敗保留預留容量，後續排程可回收', async () => {
  const f = fixture(); try {
    const realPut = f.env.IMAGES.put, realDelete = f.env.IMAGES.delete;
    f.env.IMAGES.put = async (key, bytes) => { await realPut(key, bytes); throw Error('network uncertain'); };
    f.env.IMAGES.delete = async () => { throw Error('offline'); };
    assert.equal((await f.request('/api/settings', 'POST', packet)).status, 503); assert.equal(f.objects.size, 1);
    assert.equal(f.sql.prepare('SELECT profiles FROM mg_storage').get().profiles, 1);
    f.setTime(f.time() + 3600000); await cleanup(f.env, f.time()); assert.equal(f.objects.size, 1);
    f.env.IMAGES.delete = realDelete; await cleanup(f.env, f.time()); assert.equal(f.objects.size, 0); assert.equal(f.sql.prepare('SELECT bytes FROM mg_storage').get().bytes, 0);
  } finally { f.close(); }
});
test('無驗證或錯誤來源無法存取；停用、突發限流、未知路徑不碰圖片', async () => {
  const f = fixture(); try {
    assert.equal((await f.request('/api/settings', 'POST', packet, { Origin: 'https://evil.example' })).status, 403);
    f.env.API_ENABLED = 'false'; assert.equal((await f.request('/api/settings', 'POST', packet)).status, 503); f.env.API_ENABLED = 'true';
    f.env.API_RATE_LIMITER.limit = async () => ({ success: false }); assert.equal((await f.request('/api/settings', 'POST', packet)).status, 429);
    assert.equal((await f.request('/nothing', 'GET')).status, 404); assert.equal(f.ops.put + f.ops.get, 0);
    const production = createWorker(); f.env.API_RATE_LIMITER.limit = async () => ({ success: true });
    assert.equal((await production.fetch(new Request('https://api.example/api/settings', { method: 'POST', headers: { Origin: origin }, body: packet }), f.env)).status, 403);
  } finally { f.close(); }
});
test('正式 Turnstile 校驗拒絕錯誤 hostname、action 與驗證結果', async () => {
  const f = fixture(), original = globalThis.fetch; try {
    const worker = createWorker();
    for (const result of [{ success: false }, { success: true, hostname: 'evil.example', action: 'save' }, { success: true, hostname: 'wwwne1198.party', action: 'load' }]) {
      globalThis.fetch = async () => Response.json(result);
      const response = await worker.fetch(new Request('https://api.example/api/settings', { method: 'POST', headers: { Origin: origin, 'X-Turnstile-Token': 'test' }, body: packet }), f.env); assert.equal(response.status, 403);
    }
    assert.equal(f.ops.put, 0);
  } finally { globalThis.fetch = original; f.close(); }
});

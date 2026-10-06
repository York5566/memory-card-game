// Local workerd + actual D1/R2 emulators. Only the external Turnstile service is stubbed.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { defaults } from '../../public/js/core.js';
import { sha256, encodeProfile, decodeProfile } from '../../public/js/profile-format.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const compiled = await build({ entryPoints: [root + 'worker.js'], bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022' });
const origin = 'https://wwwne1198.party', owner = 'e'.repeat(64);
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: compiled.outputFiles[0].text, compatibilityDate: '2026-10-01',
  bindings: { ALLOWED_ORIGINS: origin, API_ENABLED: 'true', TURNSTILE_SECRET: 'local-test-only', IP_HASH_SECRET: 'test'.repeat(16) },
  d1Databases: ['DB'], r2Buckets: ['IMAGES'], ratelimits: { API_RATE_LIMITER: { namespace_id: '1001', simple: { limit: 20, period: 60 } } },
  outboundService: async request => {
    assert.equal(new URL(request.url).hostname, 'challenges.cloudflare.com');
    const input = await request.json(); return Response.json({ success: true, hostname: 'wwwne1198.party', action: input.response });
  },
}));
try {
  const db = await mf.getD1Database('DB');
  const migration = await readFile(root + 'migrations/0001_profiles.sql', 'utf8');
  // D1 exec splits by line: flatten each SQL statement, preserving trigger bodies.
  const statements = migration.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/g);
  for (const sql of statements) await db.prepare(sql).run();
  const bytes = await readFile(new URL('../../tests/fixtures/alpha.webp', import.meta.url)), id = await sha256(bytes), config = defaults();
  config.background.upload = id; config.products[0].image.upload = id; config.products[0].label = '自訂透明圖案';
  const pack = await encodeProfile(config, () => new Blob([bytes]));
  const send = (path, method, body, action, extra = {}) => mf.dispatchFetch('https://api.local' + path, { method, body, headers: { Origin: origin, 'Content-Type': path === '/api/settings' ? 'application/octet-stream' : 'application/json', 'X-Owner-Token': owner, 'X-Request-Id': crypto.randomUUID(), 'X-Turnstile-Token': action, ...extra } });
  const requestId = crypto.randomUUID(), created = await send('/api/settings', 'POST', pack, 'save', { 'X-Request-Id': requestId });
  assert.equal(created.status, 201, await created.clone().text()); const receipt = await created.json();
  const repeated = await send('/api/settings', 'POST', pack, 'save', { 'X-Request-Id': requestId }); assert.equal((await repeated.json()).code, receipt.code);
  const loaded = await send('/api/settings/load', 'POST', JSON.stringify({ code: receipt.code }), 'load'); assert.equal(loaded.status, 200, await loaded.clone().text());
  const profile = await decodeProfile(new Uint8Array(await loaded.arrayBuffer())); assert.deepEqual(profile.config, config); assert.equal(profile.images.length, 1);
  const wrong = await send(`/api/settings/${receipt.code}`, 'DELETE', undefined, 'delete', { 'X-Owner-Token': 'f'.repeat(64) }); assert.equal(wrong.status, 200); assert.equal((await db.prepare('SELECT profiles FROM mg_storage').first()).profiles, 1);
  const deleted = await send(`/api/settings/${receipt.code}`, 'DELETE', undefined, 'delete'); assert.equal(deleted.status, 200);
  assert.equal((await db.prepare('SELECT profiles FROM mg_storage').first()).profiles, 0);
  const bucket = await mf.getR2Bucket('IMAGES'); assert.equal((await bucket.list()).objects.length, 0);
  console.log('PASS: local workerd + D1 + R2 save, idempotent retry, image download, owner-only delete, storage accounting. Turnstile response is a local stub; no production requests.');
} finally { await mf.dispose(); }

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults, sanitize, ruleKey } from '../public/js/core.js';
import { encodeProfile, decodeProfile, sha256, webpDimensions, stripWebpMetadata, imageIds, LIMITS, validCode, normalizeCode, readLimited } from '../public/js/profile-format.js';
import { inputDimensions } from '../public/js/image-input.js';
const bytes = new Uint8Array(await readFile(new URL('fixtures/sample.webp', import.meta.url)));
const id = await sha256(bytes), blob = new Blob([bytes]);
test('移除 Chrome Canvas WebP 的 ICCP 與附加資料後可通過驗證', () => {
  const extended = new Uint8Array(18); extended.set(new TextEncoder().encode('VP8X')); new DataView(extended.buffer).setUint32(4, 10, true); extended[8] = 0x20; extended[12] = 31; extended[15] = 23;
  const icc = new Uint8Array(12); icc.set(new TextEncoder().encode('ICCP')); new DataView(icc.buffer).setUint32(4, 4, true);
  const input = new Uint8Array(bytes.length + extended.length + icc.length); input.set(bytes.subarray(0, 12)); input.set(extended, 12); input.set(icc, 30); input.set(bytes.subarray(12), 42); new DataView(input.buffer).setUint32(4, input.length - 8, true);
  assert.throws(() => webpDimensions(input)); const clean = stripWebpMetadata(input); assert.deepEqual(webpDimensions(clean), { width: 32, height: 24 });
  assert.ok(!new TextDecoder().decode(clean).includes('ICCP'));
});
test('自訂圖案、構圖與名稱完整往返；共用圖片只裝入一次', async () => {
  const config = defaults(); config.back.upload = id; config.products[0].image.upload = id; config.products[0].label = '我的照片'; config.products[0].image.rotation = 45;
  const pack = await encodeProfile(config, async () => blob), decoded = await decodeProfile(pack);
  assert.deepEqual(decoded.config, config); assert.deepEqual(imageIds(config), [id]); assert.equal(decoded.images.length, 1);
  assert.equal(await sha256(await decoded.images[0].blob.arrayBuffer()), id);
});
test('無圖片的設定也能保存，未知 URL 與成績資料不被帶入', async () => {
  const config = defaults(); config.back.upload = 'https://example.org/a.jpg'; config.nickname = 'private'; config.rows = [{ nickname: 'private' }];
  const decoded = await decodeProfile(await encodeProfile(config, () => { throw Error('must not call'); }));
  assert.equal(decoded.config.back.upload, undefined); assert.equal(decoded.config.nickname, undefined); assert.equal(decoded.config.rows, undefined); assert.equal(decoded.images.length, 0);
});
test('自訂牌面與名稱影響排行分組，背景和卡背仍不影響', () => {
  const config = defaults(), before = ruleKey(config); config.back.upload = id; config.background.upload = id;
  assert.equal(ruleKey(config), before); config.products[0].image.upload = id; assert.notEqual(ruleKey(config), before);
  const changed = ruleKey(config); config.products[0].label = '新名稱'; assert.notEqual(ruleKey(config), changed);
  assert.equal(sanitize({ ...config, products: [{ id: 'everyday-1', label: 'x'.repeat(100) }] }).products[0].label.length, 30);
});
test('WebP 尺寸與透明圖可讀取；偽造、動畫與尾隨資料被拒絕', async () => {
  assert.deepEqual(webpDimensions(bytes), { width: 32, height: 24 });
  assert.deepEqual(inputDimensions(bytes), { width: 32, height: 24 });
  assert.deepEqual(webpDimensions(new Uint8Array(await readFile(new URL('fixtures/alpha.webp', import.meta.url)))), { width: 32, height: 24 });
  assert.throws(() => webpDimensions(new TextEncoder().encode('<svg onload="evil()"></svg>')));
  assert.throws(() => webpDimensions(new Uint8Array([...bytes, 1])));
  const animated = bytes.slice(); animated.set(new TextEncoder().encode('ANIM'), 12); assert.throws(() => webpDimensions(animated));
});
test('圖片缺失、圖片雜湊不符與過大圖片都拒絕保存', async () => {
  const config = defaults(); config.logo.upload = id;
  await assert.rejects(encodeProfile(config, () => null), /找不到/);
  await assert.rejects(encodeProfile(config, () => new Blob([new Uint8Array(LIMITS.imageBytes + 1)])));
  const changed = bytes.slice(); changed[changed.length - 2] ^= 1;
  await assert.rejects(encodeProfile(config, () => new Blob([changed])));
});
test('設定封包拒絕截斷、未知版本、過大資訊與修改後的圖片', async () => {
  const c = defaults(); c.back.upload = id; const pack = await encodeProfile(c, () => blob);
  for (const bad of [pack.subarray(0, 8), pack.subarray(0, pack.length - 1), new Uint8Array(LIMITS.packageBytes + 1)]) await assert.rejects(decodeProfile(bad));
  const changed = pack.slice(); changed[changed.length - 3] ^= 1; await assert.rejects(decodeProfile(changed));
  const oversized = pack.slice(); new DataView(oversized.buffer).setUint32(8, LIMITS.manifestBytes + 1); await assert.rejects(decodeProfile(oversized));
});
test('數字代碼保留前導零、允許空格分隔，不接受非數字與短代碼', () => {
  assert.equal(normalizeCode('0123 4567-8901'), '012345678901'); assert.ok(validCode('0123 4567 8901'));
  for (const value of ['123', '<script>', '１２３４５６７８９０１２', '1234567890123']) assert.ok(!validCode(value));
});
test('串流超過上限立即停止，不依賴 Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(11)); }, cancel() { cancelled = true; } });
  await assert.rejects(readLimited(stream, 10)); assert.ok(cancelled);
});

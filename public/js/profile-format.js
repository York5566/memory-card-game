import { sanitize, canonical } from './core.js';

export const LIMITS = Object.freeze({ imageBytes: 256 * 1024, packageBytes: 4 * 1024 * 1024, images: 15, manifestBytes: 64 * 1024, edge: 1536, retentionDays: 30 });
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const magic = encoder.encode('MCPACK01');
export const imageIds = config => [...new Set([config.back, config.background, config.logo, ...config.products.map(p => p.image)].map(p => p?.upload).filter(Boolean))].sort();
export const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
export const normalizeCode = value => String(value).replace(/[\s-]/g, '');
export const formatCode = value => normalizeCode(value).replace(/(\d{4})(?=\d)/g, '$1 ');
export function validCode(value) { return /^\d{12}$/.test(normalizeCode(value)); }
function assert(ok, message = '設定檔格式不正確或圖片已損壞。') { if (!ok) throw new Error(message); }

// Canvas may embed an ICC profile even after rasterization. Strip metadata before hashing/storage.
export function stripWebpMetadata(bytes) {
  assert(bytes.length >= 12);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), chunks = [];
  assert(String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP' && view.getUint32(4, true) + 8 === bytes.length);
  for (let offset = 12; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length);
    const size = view.getUint32(offset + 4, true), end = offset + 8 + size + size % 2;
    assert(end <= bytes.length);
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!['ICCP', 'EXIF', 'XMP '].includes(type)) {
      const chunk = bytes.slice(offset, end);
      if (type === 'VP8X') { assert(size === 10 && !(chunk[8] & 2)); chunk[8] &= 0x10; }
      chunks.push(chunk);
    }
    offset = end;
  }
  const out = new Uint8Array(12 + chunks.reduce((n, c) => n + c.length, 0)); out.set(bytes.subarray(0, 12)); new DataView(out.buffer).setUint32(4, out.length - 8, true);
  let offset = 12; for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; } return out;
}

// Only still, browser-encoded WebP is accepted. No SVG, metadata, animation or trailing data.
export function webpDimensions(bytes) {
  assert(bytes instanceof Uint8Array && bytes.length >= 30 && bytes.length <= LIMITS.imageBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = i => String.fromCharCode(...bytes.subarray(i, i + 4));
  assert(tag(0) === 'RIFF' && tag(8) === 'WEBP' && view.getUint32(4, true) + 8 === bytes.length);
  let width = 0, height = 0, frame = false, extended = false;
  const u24 = i => bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16;
  for (let offset = 12; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length);
    const type = tag(offset), size = view.getUint32(offset + 4, true), p = offset + 8, end = p + size;
    assert(end <= bytes.length && ['VP8X', 'ALPH', 'VP8 ', 'VP8L'].includes(type));
    if (type === 'VP8X') {
      assert(!extended && !frame && size === 10 && (bytes[p] & ~0x10) === 0);
      extended = true; width = u24(p + 4) + 1; height = u24(p + 7) + 1;
    }
    if (type === 'VP8 ' || type === 'VP8L') {
      assert(!frame); frame = true;
      let w, h;
      if (type === 'VP8 ') {
        assert(size >= 10 && bytes[p + 3] === 0x9d && bytes[p + 4] === 1 && bytes[p + 5] === 0x2a);
        w = view.getUint16(p + 6, true) & 0x3fff; h = view.getUint16(p + 8, true) & 0x3fff;
      } else {
        assert(size >= 5 && bytes[p] === 0x2f);
        const bits = view.getUint32(p + 1, true); w = (bits & 0x3fff) + 1; h = ((bits >>> 14) & 0x3fff) + 1;
      }
      assert(!extended || (width === w && height === h)); width = w; height = h;
    }
    offset = end + (size % 2); assert(offset <= bytes.length);
  }
  assert(frame && width > 0 && height > 0 && width <= LIMITS.edge && height <= LIMITS.edge, '圖片尺寸超過上限。');
  return { width, height };
}

export async function encodeProfile(config, getImage) {
  const clean = sanitize(config), images = [], payloads = [];
  for (const id of imageIds(clean)) {
    const blob = await getImage(id);
    assert(blob, '找不到自訂圖片，請重新選取圖片後再產生代碼。');
    const bytes = new Uint8Array(await blob.arrayBuffer()), dimensions = webpDimensions(bytes);
    assert(await sha256(bytes) === id);
    images.push({ id, bytes: bytes.length, ...dimensions }); payloads.push(bytes);
  }
  const manifest = encoder.encode(JSON.stringify({ version: 1, config: clean, images }));
  const length = 12 + manifest.length + payloads.reduce((n, p) => n + p.length, 0);
  assert(manifest.length <= LIMITS.manifestBytes && length <= LIMITS.packageBytes && images.length <= LIMITS.images, '設定檔超過 4 MiB 上限。');
  const out = new Uint8Array(length); out.set(magic); new DataView(out.buffer).setUint32(8, manifest.length); out.set(manifest, 12);
  let offset = 12 + manifest.length; for (const p of payloads) { out.set(p, offset); offset += p.length; }
  return out;
}

export async function decodeProfile(bytes) {
  assert(bytes instanceof Uint8Array && bytes.length >= 12 && bytes.length <= LIMITS.packageBytes);
  assert(magic.every((v, i) => v === bytes[i]));
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8);
  assert(size > 0 && size <= LIMITS.manifestBytes && size + 12 <= bytes.length);
  const manifest = JSON.parse(decoder.decode(bytes.subarray(12, 12 + size)));
  assert(manifest.version === 1 && Array.isArray(manifest.images) && manifest.images.length <= LIMITS.images);
  const config = sanitize(manifest.config);
  assert(canonical(config) === canonical(manifest.config));
  const expected = imageIds(config), seen = new Set(), images = [];
  let offset = size + 12;
  for (const item of manifest.images) {
    assert(expected.includes(item.id) && !seen.has(item.id) && Number.isInteger(item.bytes) && item.bytes > 0 && item.bytes <= LIMITS.imageBytes && offset + item.bytes <= bytes.length);
    const payload = bytes.subarray(offset, offset + item.bytes), dimensions = webpDimensions(payload);
    assert(dimensions.width === item.width && dimensions.height === item.height && await sha256(payload) === item.id);
    seen.add(item.id); images.push({ id: item.id, blob: new Blob([payload], { type: 'image/webp' }) }); offset += item.bytes;
  }
  assert(offset === bytes.length && seen.size === expected.length);
  return { config, images };
}

export async function readLimited(body, max) {
  assert(body, '請求內容為空。'); const reader = body.getReader(), parts = []; let length = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new Error('資料超過容量上限。'); } parts.push(value); }
  } finally { reader.releaseLock(); }
  const out = new Uint8Array(length); let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; } return out;
}

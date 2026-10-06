import { imageIds, sha256, webpDimensions, stripWebpMetadata, LIMITS } from './profile-format.js';
import { inputDimensions } from './image-input.js';

const urls = new Map(); let database;
function db() {
  if (!database) database = new Promise((resolve, reject) => {
    const open = indexedDB.open('memory-game-images', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('images', { keyPath: 'id' });
    open.onsuccess = () => resolve(open.result); open.onerror = () => reject(new Error('瀏覽器無法保存圖片，請檢查儲存權限。'));
  });
  return database;
}
function remember(id, blob) { if (!urls.has(id)) urls.set(id, URL.createObjectURL(blob)); }
export function imageURL(id) { return urls.get(id) || ''; }
export async function getImage(id) {
  const database = await db(); return new Promise((resolve, reject) => {
    const request = database.transaction('images').objectStore('images').get(id);
    request.onsuccess = () => resolve(request.result?.blob); request.onerror = () => reject(request.error);
  });
}
export async function putImages(images) {
  for (const { blob } of images) {
    try { const bitmap = await createImageBitmap(blob); bitmap.close(); }
    catch { throw new Error('有圖片無法解碼，設定尚未變更。請重新選取圖片並產生代碼。'); }
  }
  const database = await db();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('images', 'readwrite');
    for (const image of images) transaction.objectStore('images').put({ ...image, savedAt: Date.now() });
    transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(new Error('本機圖片保存失敗，可能儲存空間不足。'));
  });
  for (const { id, blob } of images) remember(id, blob);
}
export async function loadImages(config) {
  const missing = [];
  for (const id of imageIds(config)) {
    try { const blob = await getImage(id); if (blob) remember(id, blob); else missing.push(id); } catch { missing.push(id); }
  }
  return missing;
}
// Run only after the settings dialog closes: its undo history can still reference old images.
export async function pruneImages(config) {
  const keep = new Set(imageIds(config)), database = await db();
  try { for (const id of imageIds(JSON.parse(localStorage.getItem('slow-play-settings')).config)) keep.add(id); } catch { /* no other saved config */ }
  for (const id of urls.keys()) keep.add(id);
  await new Promise((resolve, reject) => {
    const tx = database.transaction('images', 'readwrite'), cursor = tx.objectStore('images').openCursor();
    cursor.onsuccess = () => { const row = cursor.result; if (!row) return; if (!keep.has(row.key) && row.value.savedAt < Date.now() - 86400000) { row.delete(); if (urls.has(row.key)) { URL.revokeObjectURL(urls.get(row.key)); urls.delete(row.key); } } row.continue(); };
    tx.oncomplete = resolve; tx.onabort = tx.onerror = reject;
  });
}
export async function importImage(file, background = false) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('請選擇 10 MiB 以內的 PNG、JPG 或 WebP 圖片。');
  const bounds = inputDimensions(new Uint8Array(await file.arrayBuffer()));
  if (!bounds.width || !bounds.height || bounds.width * bounds.height > 40_000_000 || bounds.width > 20000 || bounds.height > 20000) throw new Error('圖片過大，請先縮小至 4,000 萬像素、單邊 20,000 像素以內。');
  // Create a bounded canvas, then strip metadata by encoding its pixels to WebP.
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('圖片過大，請先縮小至 4,000 萬像素以內。');
    let edge = background ? LIMITS.edge : 1024;
    for (let attempt = 0; attempt < 7; attempt++) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', Math.max(.5, .86 - attempt * .06)));
      canvas.width = canvas.height = 1;
      if (!blob || blob.type !== 'image/webp') throw new Error('此瀏覽器不支援圖片壓縮，請使用新版 Chrome、Edge、Firefox 或 Safari。');
      blob = new Blob([stripWebpMetadata(new Uint8Array(await blob.arrayBuffer()))], { type: 'image/webp' });
      if (blob.size <= LIMITS.imageBytes) {
        const bytes = new Uint8Array(await blob.arrayBuffer()); webpDimensions(bytes); const id = await sha256(bytes);
        await putImages([{ id, blob }]); return { id, bytes: blob.size };
      }
      edge = Math.round(edge * .8);
    }
    throw new Error('圖片無法壓縮至 256 KiB，請換一張圖片。');
  } finally { bitmap.close(); }
}

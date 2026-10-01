import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
// URL decoding is needed for the Traditional Chinese checkout on Windows.
const { fileURLToPath } = await import('node:url');
const dir = fileURLToPath(new URL('..', import.meta.url));
async function files(path) { const entries = await readdir(path, { withFileTypes: true }); const result = []; for (const e of entries) { const p = resolve(path, e.name); if (e.isDirectory()) result.push(...await files(p)); else result.push(p); } return result; }
const all = await files(resolve(dir, 'dist')); let checked = 0;
const { PRODUCTS, ASSETS } = await import('../public/js/core.js');
for (const asset of [...PRODUCTS, ...Object.values(ASSETS).flat()]) {
  if (asset.path) { await access(resolve(dir, 'dist', asset.path)); checked++; }
}
for (const path of all) {
  if (extname(path) === '.js') { const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' }); if (check.status) throw Error(check.stderr); }
  if (extname(path) === '.html') {
    const html = await readFile(path, 'utf8');
    if (!html.includes('lang="zh-Hant"') || !html.includes('<title>') || /\{\{\w+\}\}/.test(html)) throw Error('頁面中繼資料或模板不完整：' + path);
    if (/type=["']file|contenteditable|<form[^>]*action=["']https?:/i.test(html)) throw Error('出現未授權的匯入或外部傳送入口');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url = match[1]; if (/^https?:|^data:/.test(url)) continue;
      const config = (await import('../site.config.mjs')).default;
      const base = config.basePath === '/' ? '/' : '/' + config.basePath.split('/').filter(Boolean).join('/') + '/';
      const rel = url.split('#')[0].slice(base.length);
      await access(resolve(dir, 'dist', rel.endsWith('/') || rel === '' ? rel + 'index.html' : rel)); checked++;
    }
  }
}
console.log(`通過：${all.length} 個靜態檔案、${checked} 個頁面連結與資產參照，JavaScript 語法與頁面中繼資料。`);

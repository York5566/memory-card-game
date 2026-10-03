import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import config from '../site.config.mjs';
import { siteAddress } from './seo.mjs';
// URL decoding is needed for the Traditional Chinese checkout on Windows.
const { fileURLToPath } = await import('node:url');
const dir = fileURLToPath(new URL('..', import.meta.url));
async function files(path) { const entries = await readdir(path, { withFileTypes: true }); const result = []; for (const e of entries) { const p = resolve(path, e.name); if (e.isDirectory()) result.push(...await files(p)); else result.push(p); } return result; }
const all = await files(resolve(dir, 'dist')); let checked = 0;
const { base, domain } = siteAddress(config), canonicalURLs = [], titles = new Set();
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
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    if (titles.has(title)) throw Error('頁面標題重複：' + path); titles.add(title);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1 || !/<meta name="description" content="[^"]+">/.test(html)) throw Error('頁面需要單一 H1 與摘要：' + path);
    const is404 = path.endsWith('404.html'), canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (is404 && (!html.includes('noindex, follow') || canonical)) throw Error('404 索引設定有誤');
    if (domain && !is404) {
      const relative = path.slice(resolve(dir, 'dist').length + 1).replaceAll('\\', '/').replace(/index\.html$/, '');
      if (canonical !== domain + base + relative) throw Error('canonical 未指向實際發布路徑：' + path);
      canonicalURLs.push(canonical);
      const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      if (!json || JSON.parse(json)['@graph'][1].url !== canonical) throw Error('結構化資料網址有誤');
    }
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url = match[1]; if (/^https?:|^data:|^mailto:/.test(url)) continue;
      const rel = url.split('#')[0].slice(base.length);
      await access(resolve(dir, 'dist', rel.endsWith('/') || rel === '' ? rel + 'index.html' : rel)); checked++;
    }
  }
}
if (domain) {
  const sitemap = await readFile(resolve(dir, 'dist/sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]).sort();
  if (JSON.stringify(urls) !== JSON.stringify(canonicalURLs.sort())) throw Error('sitemap 與正式頁面網址不一致');
  const robots = await readFile(resolve(dir, 'dist/robots.txt'), 'utf8');
  if (!robots.includes(`Sitemap: ${domain}${base}sitemap.xml`)) throw Error('robots 的 sitemap 網址有誤');
}
console.log(`通過：${all.length} 個靜態檔案、${checked} 個頁面連結與資產參照，JavaScript 語法與頁面中繼資料。`);

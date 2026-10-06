import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import config from '../site.config.mjs';
import { siteAddress } from './seo.mjs';
import { analyticsMarkup } from './analytics.mjs';
// URL decoding is needed for the Traditional Chinese checkout on Windows.
const { fileURLToPath } = await import('node:url');
const dir = fileURLToPath(new URL('..', import.meta.url));
async function files(path) { const entries = await readdir(path, { withFileTypes: true }); const result = []; for (const e of entries) { const p = resolve(path, e.name); if (e.isDirectory()) result.push(...await files(p)); else result.push(p); } return result; }
const all = await files(resolve(dir, 'dist')); let checked = 0;
const { base, domain } = siteAddress({ ...config, domain: process.argv.includes('--preview') ? '' : config.domain }), canonicalURLs = [], titles = new Set();
const { PRODUCTS, ASSETS } = await import('../public/js/core.js');
for (const asset of [...PRODUCTS, ...Object.values(ASSETS).flat()]) {
  if (asset.path) { await access(resolve(dir, 'dist', asset.path)); checked++; }
}
for (const path of all) {
  if (extname(path) === '.js') { const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' }); if (check.status) throw Error(check.stderr); }
  if (extname(path) === '.html') {
    const html = await readFile(path, 'utf8');
    if (!html.includes('lang="zh-Hant"') || !html.includes('<title>') || /\{\{\w+\}\}/.test(html)) throw Error('頁面中繼資料或模板不完整：' + path);
    if (/contenteditable|<form[^>]*action=["']https?:/i.test(html)) throw Error('出現未授權的外部表單傳送入口');
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    if (titles.has(title)) throw Error('頁面標題重複：' + path); titles.add(title);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1 || !/<meta name="description" content="[^"]+">/.test(html)) throw Error('頁面需要單一 H1 與摘要：' + path);
    const is404 = path.endsWith('404.html'), isRedirect = html.includes('data-redirect="true"'), canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    const analytics = html.match(/<script data-site-analytics="ga4">[\s\S]*?<\/script>/g) || [];
    const expectedAnalytics = analyticsMarkup(config, { domain }, is404 || isRedirect ? '404' : 'content');
    if (analytics.length !== (expectedAnalytics ? 1 : 0) || (expectedAnalytics && !html.includes(expectedAnalytics))) throw Error('GA4 代碼重複、ID 不一致或不應出現在預覽／錯誤頁：' + path);
    if (is404 && (!html.includes('noindex, follow') || canonical)) throw Error('404 索引設定有誤');
    if (isRedirect) {
      const relative = path.slice(resolve(dir, 'dist').length + 1).replaceAll('\\', '/').replace(/^memory-card-game\//, '').replace(/index\.html$/, '');
      if (canonical !== `${domain}/${relative}` || !html.includes(`content="0; url=${canonical}"`) || !html.includes('noindex, follow')) throw Error('舊網址轉址有誤：' + path);
      await access(resolve(dir, 'dist', relative, 'index.html'));
    }
    if (domain && !is404 && !isRedirect) {
      const relative = path.slice(resolve(dir, 'dist').length + 1).replaceAll('\\', '/').replace(/index\.html$/, '');
      if (canonical !== domain + base + relative) throw Error('canonical 未指向實際發布路徑：' + path);
      canonicalURLs.push(canonical);
      const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      if (!json || JSON.parse(json)['@graph'][1].url !== canonical) throw Error('結構化資料網址有誤');
      if (html.includes('noindex') || !html.includes('max-image-preview:large')) throw Error('正式頁面索引設定有誤');
      const meta = key => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)">`))?.[1];
      if (meta('og:url') !== canonical || meta('og:site_name') !== config.name || meta('twitter:card') !== 'summary_large_image') throw Error('社群分享網址或站名有誤');
      const image = meta('og:image');
      if (!image?.startsWith(domain + base) || meta('twitter:image') !== image || meta('og:image:secure_url') !== image || meta('og:image:type') !== 'image/png' || !meta('og:image:alt') || !meta('twitter:image:alt')) throw Error('社群圖片中繼資料不完整');
      const bytes = await readFile(resolve(dir, 'dist', image.slice((domain + base).length)));
      if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) !== 1200 || bytes.readUInt32BE(20) !== 630 || meta('og:image:width') !== '1200' || meta('og:image:height') !== '630') throw Error('社群圖片必須為 1200×630 PNG');
      checked++;
    }
    if (!domain && (canonical || !html.includes('noindex, follow'))) throw Error('本機預覽不應宣告正式網址或允許索引');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      const url = match[1]; if (/^https?:|^data:|^mailto:/.test(url)) continue;
      if (!url.startsWith(base)) throw Error('資產或內部連結不在部署根路徑：' + url);
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
  if (domain === 'https://wwwne1198.party' && base === '/') {
    if ((await readFile(resolve(dir, 'dist/CNAME'), 'utf8')).trim() !== 'wwwne1198.party') throw Error('CNAME 不一致');
    const home = await readFile(resolve(dir, 'dist/index.html'), 'utf8');
    if (!home.includes('href="/style.css"') || !home.includes('src="/js/site.js"') || /(?:href|src)="\/memory-card-game\//.test(home)) throw Error('自訂網域仍使用舊子路徑');
  }
} else {
  const robots = await readFile(resolve(dir, 'dist/robots.txt'), 'utf8');
  if (!robots.includes('Disallow: /') || robots.includes('Sitemap:')) throw Error('預覽 robots 有誤');
}
console.log(`通過：${all.length} 個靜態檔案、${checked} 個頁面連結與資產參照，JavaScript 語法與頁面中繼資料。`);

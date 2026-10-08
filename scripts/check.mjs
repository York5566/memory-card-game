import { t, LOCALES, localeBase } from '../public/js/i18n.js';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import config from '../site.config.mjs';
import { siteAddress, SEARCH_PREVIEW } from './seo.mjs';
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
    const language = html.match(/<html lang="([^"]+)"/)?.[1];
    if (!Object.hasOwn(LOCALES, language) || !html.includes('<title>') || /\{\{\w+\}\}/.test(html)) throw Error('頁面中繼資料或模板不完整：' + path);
    if (/contenteditable|<form[^>]*action=["']https?:/i.test(html)) throw Error('出現未授權的外部表單傳送入口');
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    if (titles.has(title)) throw Error('頁面標題重複：' + path); titles.add(title);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1 || !/<meta name="description" content="[^"]+">/.test(html)) throw Error('頁面需要單一 H1 與摘要：' + path);
    const is404 = path.endsWith('404.html'), isRedirect = html.includes('data-redirect="true"'), canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
    if (!isRedirect) {
      if (!html.includes(`<link rel="icon" type="image/png" sizes="96x96" href="${base}assets/favicon-96.png">`) || !html.includes(`href="${base}favicon.ico"`) || /rel="icon" type="image\/svg\+xml"/.test(html)) throw Error('favicon 必須明確提供可爬取的 PNG 與 ICO');
      const icon = await readFile(resolve(dir, 'dist/assets/favicon-96.png')), ico = await readFile(resolve(dir, 'dist/favicon.ico'));
      if (icon.length < 24 || icon.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || icon.readUInt32BE(16) !== 96 || icon.readUInt32BE(20) !== 96) throw Error('PNG favicon 必須為 96×96');
      if (ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) < 1 || 6 + 16 * ico.readUInt16LE(4) > ico.length) throw Error('favicon.ico 格式不完整');
      let has96 = false;
      for (let i = 0; i < ico.readUInt16LE(4); i++) {
        const offset = 6 + i * 16, width = ico[offset] || 256, height = ico[offset + 1] || 256;
        const size = ico.readUInt32LE(offset + 8), start = ico.readUInt32LE(offset + 12);
        if (width !== height || !size || start < 6 + 16 * ico.readUInt16LE(4) || start + size > ico.length) throw Error('favicon.ico 的圖層不完整');
        if (width === 96) has96 = true;
      }
      if (!has96) throw Error('favicon.ico 缺少 96×96 圖層');
    }
    if (!is404 && !isRedirect && !new RegExp(`<img[^>]+src="${base}${SEARCH_PREVIEW.path}"[^>]+alt="[^"]+"`).test(html)) throw Error('頁面缺少可直接爬取且有替代文字的主要圖片');
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
      const pagePath = relative.slice(LOCALES[language].prefix.length);
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
      if (alternates.length !== 5 || new Set(alternates.map(m => m[1])).size !== 5) throw Error('Every content page needs four language alternates and x-default');
      for (const id of [...Object.keys(LOCALES), 'x-default']) {
        const other = id === 'x-default' ? 'zh-Hant' : id;
        if (!alternates.some(m => m[1] === id && m[2] === domain + localeBase(base, other) + pagePath)) throw Error('Incorrect language alternate: ' + path);
        await access(resolve(dir, 'dist', LOCALES[other].prefix + pagePath + 'index.html'));
      }

      const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      if (!json || JSON.parse(json)['@graph'][1].url !== canonical) throw Error('結構化資料網址有誤');
      const graph = JSON.parse(json)['@graph'], primary = graph[2];
      if (graph[0].inLanguage !== language || graph[1].inLanguage !== language || graph[1].mainEntity && graph[1].mainEntity.inLanguage !== language) throw Error('Structured-data language mismatch');
      if (primary.url !== domain + base + SEARCH_PREVIEW.path || primary.contentUrl !== primary.url || graph[1].primaryImageOfPage['@id'] !== primary['@id'] || primary.width !== SEARCH_PREVIEW.width || primary.height !== SEARCH_PREVIEW.height) throw Error('搜尋主要圖片標記有誤');
      const preview = await readFile(resolve(dir, 'dist', SEARCH_PREVIEW.path));
      if (preview.length < 24 || preview.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || preview.readUInt32BE(16) !== SEARCH_PREVIEW.width || preview.readUInt32BE(20) !== SEARCH_PREVIEW.height) throw Error('搜尋主要圖片格式或尺寸有誤');
      checked++;
      if (html.includes('noindex') || !html.includes('max-image-preview:large')) throw Error('正式頁面索引設定有誤');
      const meta = key => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)">`))?.[1];
      if (meta('og:url') !== canonical || meta('og:site_name') !== t(config.name, language) || meta('twitter:card') !== 'summary_large_image') throw Error('社群分享網址或站名有誤');
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
  for (const entry of sitemap.matchAll(/<url>(.*?)<\/url>/g)) {
    const loc = entry[1].match(/<loc>(.*?)<\/loc>/)[1];
    const relative = loc.slice((domain + base).length);
    const page = await readFile(resolve(dir, 'dist', relative, 'index.html'), 'utf8');
    const htmlLinks = [...page.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => m[1] + ' ' + m[2]).sort();
    const xmlLinks = [...entry[1].matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map(m => m[1] + ' ' + m[2]).sort();
    if (JSON.stringify(htmlLinks) !== JSON.stringify(xmlLinks)) throw Error('Sitemap language alternatives differ from HTML');
  }

  const images = [...sitemap.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map(m => m[1]);
  if (!sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"') || images.length !== canonicalURLs.length || images.some(url => url !== domain + base + SEARCH_PREVIEW.path)) throw Error('圖片 sitemap 與可見主要圖片不一致');
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

import { t, LOCALES, localeBase, localizeMarkup } from '../public/js/i18n.js';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { siteAddress, pageMetadata, SEARCH_PREVIEW, escapeHTML as escape } from './seo.mjs';
import { analyticsMarkup } from './analytics.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
if (dirname(output) !== root || !output.endsWith('dist')) throw Error('不安全的建置路徑');
export async function build({ preview = false } = {}) {
  const { base, domain } = siteAddress({ ...config, domain: preview ? '' : config.domain });
  const cloud = { ...config.cloud, preview, origin: domain };
  if (cloud.apiURL) { const url = new URL(cloud.apiURL); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('雲端 API 必須是 HTTPS 網域根網址'); }
  if (preview) cloud.siteKey = ''; // Local previews never upload to the production account.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(join(root, 'public'), output, { recursive: true });
  const template = await readFile(join(root, 'src/layout.html'), 'utf8');
  const routes = [
    ['home', '', '首頁', config.description],
    ['game', 'games/memory', '上傳照片，自訂記憶配對卡牌', '上傳自己的照片或圖片，免費製作線上記憶配對卡牌。可替換 12 種圖案、卡背、背景與 LOGO，調整縮放、位置、旋轉及裁切，選擇 2 至 12 對卡牌與限時挑戰。成績預設保存在目前瀏覽器。'],
    ['help', 'help', '圖片上傳與玩法設定教學', '學習如何上傳 PNG、JPG、WebP 圖片，自訂翻牌遊戲的配對圖案、卡背、背景與 LOGO，調整圖片構圖、使用數字代碼載入設定，以及查看成績紀錄與匯出 CSV。'],
    ['404', null, '找不到這一頁', '這個網址目前沒有內容，回到首頁繼續玩。'],
  ];
  for (const language of Object.keys(LOCALES)) for (const [page, route, sourceTitle, sourceDescription] of routes) {
    const title = t(sourceTitle, language), description = t(sourceDescription, language);
    const prefix = LOCALES[language].prefix;
    const switcher = `<details class="language-menu"><summary aria-label="${escape(t('語言', language))}"><svg class="language-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg><span>${LOCALES[language].label}</span></summary><nav aria-label="${escape(t('切換語言', language))}">${Object.entries(LOCALES).map(([id, info]) => `<a href="${localeBase(base, id)}${route ? route + '/' : ''}" lang="${id}" hreflang="${id}" data-language-link ${id === language ? 'aria-current="true"' : ''}>${info.label}</a>`).join('')}</nav></details>`;
    let body = await readFile(join(root, `src/pages/${page}.html`), 'utf8');
    const { documentTitle, meta } = pageMetadata({ page, route, title, description }, config, { base, domain }, language);
    const html = localizeMarkup(template.replace('{{BODY}}', body), language).replace('{{META}}', meta).replace('{{ANALYTICS}}', analyticsMarkup(config, { domain }, page)).replaceAll('{{NAME}}', escape(t(config.name, language)))
      .replaceAll('{{LANG}}', language).replaceAll('{{LOCALE_BASE}}', localeBase(base, language)).replace('{{LANGUAGE_SWITCH}}', switcher)
      .replaceAll('{{DOCUMENT_TITLE}}', escape(documentTitle)).replaceAll('{{TITLE}}', escape(title)).replaceAll('{{DESCRIPTION}}', escape(description))
      .replaceAll('{{BASE}}', base).replaceAll('{{PAGE}}', page);
    const dest = route === null ? join(output, prefix, '404.html') : join(output, prefix, route, 'index.html');
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }
  await writeFile(join(output, 'js/site-config.js'), `export default ${JSON.stringify({ name: config.name, basePath: base, ads: config.ads, cloud })};\n`);
  if (domain) {
    const urls = Object.keys(LOCALES).flatMap(language => routes.filter(([, route]) => route !== null).map(([, route]) => {
      const path = route ? route + '/' : '';
      const alternates = [...Object.keys(LOCALES), 'x-default'].map(id => `<xhtml:link rel="alternate" hreflang="${id}" href="${escape(domain + localeBase(base, id === 'x-default' ? 'zh-Hant' : id) + path)}"/>`).join('');
      return `<url><loc>${escape(domain + localeBase(base, language) + path)}</loc>${alternates}<image:image><image:loc>${escape(domain + base + SEARCH_PREVIEW.path)}</image:loc></image:image></url>`;
    })).join('');
    await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`);
    await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${domain}${base}sitemap.xml\n`);
    if (base === '/' && new URL(domain).hostname === 'wwwne1198.party') {
      await writeFile(join(output, 'CNAME'), 'wwwne1198.party\n');
      // 保留搬到自訂網域後曾公開的舊子目錄網址，不將未知網址導回首頁。
      for (const [, route, title] of routes.filter(([, route]) => route !== null)) {
        const target = `${domain}/${route ? route + '/' : ''}`;
        const dest = join(output, 'memory-card-game', route, 'index.html');
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}網址已更新｜${escape(config.name)}</title><meta name="description" content="翻牌遊戲已更新網址，請前往對應頁面。"><meta name="robots" content="noindex, follow"><link rel="canonical" href="${target}"><meta http-equiv="refresh" content="0; url=${target}"></head><body data-redirect="true"><h1>網址已更新</h1><a href="${target}">前往${escape(title)}</a></body></html>`);
      }
    }
  } else {
    await writeFile(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
  await writeFile(join(output, '.nojekyll'), '');
  console.log('靜態建置完成：dist/（HTML、CSS、JavaScript 與內建素材）');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build({ preview: process.argv.includes('--preview') });

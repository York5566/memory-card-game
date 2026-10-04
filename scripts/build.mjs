import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
import { siteAddress, pageMetadata, escapeHTML as escape } from './seo.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
if (dirname(output) !== root || !output.endsWith('dist')) throw Error('不安全的建置路徑');
export async function build({ preview = false } = {}) {
  const { base, domain } = siteAddress({ ...config, domain: preview ? '' : config.domain });
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(join(root, 'public'), output, { recursive: true });
  const template = await readFile(join(root, 'src/layout.html'), 'utf8');
  const routes = [
    ['home', '', '首頁', config.description],
    ['game', 'games/memory', '記憶配對挑戰', '免費線上翻牌遊戲，免登入即可挑戰記憶配對。選擇 2 至 12 對內建圖案，自訂限時、卡背與背景；支援手機、排行榜及本機成績紀錄。'],
    ['help', 'help', '玩法與設定教學', '了解翻牌遊戲的配對規則、計時、暫停、內建圖庫、即時畫面預覽、排行榜與本機成績保存，並學習匯出 CSV 與鍵盤操作。'],
    ['404', null, '找不到這一頁', '這個網址目前沒有內容，回到首頁繼續玩。'],
  ];
  for (const [page, route, title, description] of routes) {
    let body = await readFile(join(root, `src/pages/${page}.html`), 'utf8');
    const { documentTitle, meta } = pageMetadata({ page, route, title, description }, config, { base, domain });
    const html = template.replace('{{BODY}}', body).replace('{{META}}', meta).replaceAll('{{NAME}}', escape(config.name))
      .replaceAll('{{DOCUMENT_TITLE}}', escape(documentTitle)).replaceAll('{{TITLE}}', escape(title)).replaceAll('{{DESCRIPTION}}', escape(description))
      .replaceAll('{{BASE}}', base).replaceAll('{{PAGE}}', page);
    const dest = route === null ? join(output, '404.html') : join(output, route, 'index.html');
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }
  await writeFile(join(output, 'js/site-config.js'), `export default ${JSON.stringify({ name: config.name, basePath: base, ads: config.ads })};\n`);
  if (domain) {
    const urls = routes.filter(([, route]) => route !== null).map(([, route]) => `<url><loc>${escape(domain + base + (route ? route + '/' : ''))}</loc></url>`).join('');
    await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
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

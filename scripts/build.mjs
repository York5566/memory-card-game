import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
if (dirname(output) !== root || !output.endsWith('dist')) throw Error('不安全的建置路徑');
const base = `/${config.basePath.split('/').filter(Boolean).join('/')}${config.basePath === '/' ? '' : '/'}`;
if (!/^\/[a-zA-Z0-9\u3400-\u9fff_.\-/]*$/.test(base)) throw Error('basePath 格式不正確');
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
let domain = '';
if (config.domain) {
  const url = new URL(config.domain);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('正式網域請使用 https://你的網域（不含子路徑）');
  domain = url.origin;
}
export async function build() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(join(root, 'public'), output, { recursive: true });
  const template = await readFile(join(root, 'src/layout.html'), 'utf8');
  const routes = [
    ['home', '', '首頁', config.description],
    ['game', 'games/memory', '翻牌遊戲', '翻開兩張相同圖案，配對完成一場小挑戰。可設定玩法、調整畫面與保留本次排行榜。'],
    ['help', 'help', '使用說明', '翻牌遊戲的玩法、設定、排行榜與本機成績保存方式。'],
    ['about', 'about', '關於網站', '慢慢玩是一個逐步增加小工具與小遊戲的網站，目前提供翻牌遊戲。'],
    ['privacy', 'privacy', '隱私權說明', '了解瀏覽器本機設定、成績紀錄與目前的廣告狀態。'],
    ['404', null, '找不到這一頁', '這個網址目前沒有內容，回到首頁繼續玩。'],
  ];
  for (const [page, route, title, description] of routes) {
    let body = await readFile(join(root, `src/pages/${page}.html`), 'utf8');
    const canonical = domain && route !== null ? `${domain}${base}${route ? route + '/' : ''}` : '';
    const meta = canonical ? `<link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title + ' · ' + config.name)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}">` : '';
    const html = template.replace('{{BODY}}', body).replace('{{META}}', meta).replaceAll('{{NAME}}', escape(config.name))
      .replaceAll('{{TITLE}}', escape(title)).replaceAll('{{DESCRIPTION}}', escape(description))
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
  }
  console.log('靜態建置完成：dist/（HTML、CSS、JavaScript 與內建素材）');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();

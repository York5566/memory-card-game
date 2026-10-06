import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
const source = new URL('../', import.meta.url);
test('正式自訂網域、舊網址、子目錄與本機預覽的完整建置', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-site-build-'));
  try {
    for (const item of ['scripts', 'src', 'public', 'site.config.mjs', 'package.json']) await cp(new URL(item, source), join(directory, item), { recursive: true });
    const env = { ...process.env }; delete env.SITE_ORIGIN; delete env.SITE_BASE_PATH; delete env.GA4_MEASUREMENT_ID;
    const run = (file, extra = {}, args = []) => spawnSync(process.execPath, [file, ...args], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8' });
    const success = result => assert.equal(result.status, 0, result.stderr || result.stdout);
    const read = path => readFile(join(directory, 'dist', path), 'utf8');
    await t.test('預設正式建置的 CSS、SEO、sitemap 全部使用自訂網域根路徑', async () => {
      success(run('scripts/build.mjs')); success(run('scripts/check.mjs'));
      const html = await read('index.html');
      const cloud = JSON.parse((await read('js/site-config.js')).replace(/^export default /, '').trim().replace(/;$/, '')).cloud;
      assert.equal(cloud.origin, 'https://wwwne1198.party'); assert.equal(cloud.preview, false); assert.ok(cloud.siteKey);
      assert.match(html, /href="\/style\.css"/); assert.match(html, /src="\/js\/site\.js"/);
      assert.match(html, /rel="canonical" href="https:\/\/wwwne1198\.party\/"/);
      assert.ok(!html.includes('york5566.github.io')); assert.ok(!html.includes('/memory-card-game/'));
      assert.match(await read('memory-card-game/games/memory/index.html'), /content="0; url=https:\/\/wwwne1198\.party\/games\/memory\/"/);
      const sitemap = await read('sitemap.xml'); assert.equal((sitemap.match(/<loc>/g) || []).length, 3);
      assert.ok(!sitemap.includes('memory-card-game')); assert.ok(!sitemap.includes('404'));
    });
    await t.test('檢查會拒絕回歸舊的 CSS 子目錄', async () => {
      const original = await read('index.html');
      await writeFile(join(directory, 'dist/index.html'), original.replace('href="/style.css"', 'href="/memory-card-game/style.css"'));
      assert.notEqual(run('scripts/check.mjs').status, 0);
      await writeFile(join(directory, 'dist/index.html'), original);
    });
    await t.test('搜尋與分享標籤、可爬取的本文共同描述自訂圖片，教學連結有對應錨點', async () => {
      const titles = new Set();
      for (const path of ['index.html', 'games/memory/index.html', 'help/index.html']) {
        const html = await read(path), title = html.match(/<title>(.*?)<\/title>/s)[1]; titles.add(title);
        assert.match(title, /上傳/);
        assert.match(html.match(/<h1[^>]*>(.*?)<\/h1>/s)[1], /圖片/);
        assert.match(html.match(/<meta name="description" content="([^"]+)"/)[1], /上傳/);
        assert.ok(html.includes(`property="og:title" content="${title}"`));
        assert.ok(html.includes(`name="twitter:title" content="${title}"`));
        assert.match(html, /PNG、JPG/); assert.match(html, /背景與 LOGO/);
      }
      assert.equal(titles.size, 3);
      assert.ok((await read('help/index.html')).includes('id="upload-images"'));
      const gameHTML = await read('games/memory/index.html');
      const graph = JSON.parse(gameHTML.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
      assert.ok(graph[1].mainEntity.featureList.some(feature => feature.includes('上傳照片')));
      assert.match(gameHTML, /成績紀錄預設開啟/);
    });
    await t.test('三個正式內容頁都有 GA4，404 與舊轉址不追蹤，重複標籤會被攔截', async () => {
      for (const path of ['index.html', 'games/memory/index.html', 'help/index.html']) {
        const html = await read(path);
        assert.equal((html.match(/data-site-analytics="ga4"/g) || []).length, 1);
        assert.ok(html.includes('G-VXMTJFXBHE'));
      }
      for (const path of ['404.html', 'memory-card-game/index.html', 'memory-card-game/games/memory/index.html', 'memory-card-game/help/index.html']) assert.ok(!(await read(path)).includes('G-VXMTJFXBHE'));
      const original = await read('index.html'), tag = original.match(/<script data-site-analytics="ga4">[\s\S]*?<\/script>/)[0];
      await writeFile(join(directory, 'dist/index.html'), original.replace('</head>', tag + '</head>'));
      assert.notEqual(run('scripts/check.mjs').status, 0);
      await writeFile(join(directory, 'dist/index.html'), original);
    });
    await t.test('保留明確指定 GitHub Pages 子目錄的建置能力', async () => {
      const variables = { SITE_ORIGIN: 'https://york5566.github.io', SITE_BASE_PATH: '/memory-card-game/' };
      success(run('scripts/build.mjs', variables)); success(run('scripts/check.mjs', variables));
      assert.match(await read('index.html'), /href="\/memory-card-game\/style\.css"/);
    });
    await t.test('預覽不洩漏正式 canonical、驗證碼或可索引 sitemap', async () => {
      success(run('scripts/build.mjs', { GOOGLE_SITE_VERIFICATION: 'test-token' }, ['--preview']));
      success(run('scripts/check.mjs', {}, ['--preview']));
      const html = await read('index.html');
      assert.match(html, /noindex, follow/); assert.ok(!html.includes('rel="canonical"')); assert.ok(!html.includes('test-token'));
      assert.ok(!html.includes('G-VXMTJFXBHE')); assert.ok(!html.includes('googletagmanager.com'));
      assert.equal(await read('robots.txt'), 'User-agent: *\nDisallow: /\n');
      await assert.rejects(read('sitemap.xml'), { code: 'ENOENT' });
      await assert.rejects(read('CNAME'), { code: 'ENOENT' });
    });
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('memory-site-build-')) throw Error('不安全的測試清理路徑');
    await rm(directory, { recursive: true, force: true });
  }
});

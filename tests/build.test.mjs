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
      const sitemap = await read('sitemap.xml'); assert.equal((sitemap.match(/<loc>/g) || []).length, 16);
      assert.ok(!sitemap.includes('/memory-card-game/')); assert.ok(!sitemap.includes('404'));
    });
    await t.test('檢查會拒絕回歸舊的 CSS 子目錄', async () => {
      const original = await read('index.html');
      await writeFile(join(directory, 'dist/index.html'), original.replace('href="/style.css"', 'href="/memory-card-game/style.css"'));
      assert.notEqual(run('scripts/check.mjs').status, 0);
      await writeFile(join(directory, 'dist/index.html'), original);
    });
    await t.test('四種語言直接輸出完整 HTML，語言選單保留頁面位置，SEO 互相對應', async () => {
      for (const [lang, prefix] of [['zh-Hant',''],['en','en/'],['ja','ja/'],['ko','ko/']]) for (const route of ['', 'games/memory/', 'help/', 'privacy/']) {
        const html = await read(prefix + route + 'index.html');
        assert.ok(html.includes(`<html lang="${lang}">`));
        assert.ok(html.includes(`rel="canonical" href="https://wwwne1198.party/${prefix}${route}"`));
        assert.equal((html.match(/<link rel="alternate" hreflang=/g) || []).length, 5);
        for(const other of ['','en/','ja/','ko/']) assert.ok(html.includes(`href="/${other}${route}" lang=`));
        assert.match(html,/href="\/style.css"/);assert.match(html,/src="\/js\/site.js"/);
        assert.ok(html.includes(`src="/js/language.js" data-base="/" data-page="${route === '' ? 'home' : route.startsWith('help') ? 'help' : route.startsWith('privacy') ? 'privacy' : 'game'}"`));
        assert.ok(html.indexOf('src="/js/language.js"') < html.indexOf('data-site-analytics="ga4"'), 'Detect before analytics initializes');
        assert.equal((html.match(/data-language-link/g) || []).length, 4, 'Current language is also selectable and can be remembered');
        if(lang==='en') {
          const article = html.split('<main id="main">')[1].split('</main>')[0];
          assert.ok(!/[\u3400-\u9fff]/.test(article),'English main content must not fall back to Chinese');
        }
        assert.equal((html.match(/data-site-analytics="ga4"/g) || []).length,1);
      }
      for(const prefix of ['en/','ja/','ko/']) assert.ok((await read(prefix+'404.html')).includes('noindex, follow'));
      const path=join(directory,'dist/ja/games/memory/index.html'), original=await read('ja/games/memory/index.html');
      await writeFile(path,original.replace('hreflang="en" href="https://wwwne1198.party/en/games/memory/"','hreflang="en" href="https://wwwne1198.party/en/"'));
      assert.notEqual(run('scripts/check.mjs').status,0,'Wrong-page hreflang must fail validation');
      await writeFile(path,original);
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
    await t.test('四語政策頁與所有頁尾互相連結，目錄可使用且不誤標遊戲圖片', async () => {
      const sitemap = await read('sitemap.xml');
      for (const prefix of ['', 'en/', 'ja/', 'ko/']) {
        const policy = await read(prefix + 'privacy/index.html');
        assert.match(policy, /<time datetime="2026-10-09">2026-10-09<\/time>/);
        assert.ok(policy.includes('https://policies.google.com/technologies/partner-sites'));
        assert.ok(policy.includes('https://www.cloudflare.com/turnstile-privacy-policy/'));
        assert.ok(policy.includes('mailto:wwwne1198@gmail.com'));
        assert.ok(!policy.includes('assets/previews/memory-card-game.png'));
        for (const [, id] of policy.matchAll(/href="#([^"]+)"/g)) assert.ok(policy.includes(`id="${id}"`), 'Policy contents target exists: ' + id);
        for (const route of ['', 'games/memory/', 'help/', 'privacy/', '404.html']) {
          const html = await read(prefix + (route.endsWith('.html') ? route : route + 'index.html'));
          assert.ok(html.includes(`class="privacy-link" href="/${prefix}privacy/"`));
        }
        const entry = [...sitemap.matchAll(/<url>(.*?)<\/url>/g)].find(m => m[1].includes(`<loc>https://wwwne1198.party/${prefix}privacy/</loc>`));
        assert.ok(entry && !entry[1].includes('<image:image>'));
      }
      const path = join(directory, 'dist/en/index.html'), original = await read('en/index.html');
      await writeFile(path, original.replace(/<a class="privacy-link"[^>]*>.*?<\/a>/, ''));
      assert.notEqual(run('scripts/check.mjs').status, 0, 'Missing policy entry must fail publishing validation');
      await writeFile(path, original);
    });
    await t.test('搜尋圖示與縮圖提供真實檔案、可見 HTML、主要圖片及圖片 sitemap', async () => {
      const imageURL = 'https://wwwne1198.party/assets/previews/memory-card-game.png';
      for (const path of ['index.html', 'games/memory/index.html', 'help/index.html']) {
        const html = await read(path);
        assert.ok(!html.includes('rel="icon" type="image/svg+xml"'));
        assert.match(html, /rel="icon" type="image\/png" sizes="96x96" href="\/assets\/favicon-96.png"/);
        assert.ok(html.includes('href="/favicon.ico"'));
        assert.match(html, /<img[^>]+src="\/assets\/previews\/memory-card-game.png"[^>]+alt="[^"]+"/);
        const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
        assert.equal(graph[2].contentUrl, imageURL);
        assert.equal(graph[1].primaryImageOfPage['@id'], graph[2]['@id']);
        assert.equal(graph[2].height, 900);
      }
      const sitemap = await read('sitemap.xml');
      assert.equal((sitemap.match(/<image:loc>/g) || []).length, 12);
      assert.ok(sitemap.includes(`<image:loc>${imageURL}</image:loc>`));
    });
    await t.test('損毀 ICO、移除可見縮圖或圖片 sitemap 都會被發布檢查攔截', async () => {
      const icoPath = join(directory, 'dist/favicon.ico'), ico = await readFile(icoPath);
      await writeFile(icoPath, Buffer.from('broken icon'));
      assert.notEqual(run('scripts/check.mjs').status, 0);
      await writeFile(icoPath, ico);
      for (const [path, alter] of [
        ['index.html', html => html.replace('src="/assets/previews/memory-card-game.png"', 'src="/assets/products/02.svg"')],
        ['sitemap.xml', xml => xml.replace(/<image:image>.*?<\/image:image>/g, '')],
      ]) {
        const original = await read(path);
        await writeFile(join(directory, 'dist', path), alter(original));
        assert.notEqual(run('scripts/check.mjs').status, 0);
        await writeFile(join(directory, 'dist', path), original);
      }
      success(run('scripts/check.mjs'));
    });
    await t.test('四個正式內容頁都有 GA4，404 與舊轉址不追蹤，重複標籤會被攔截', async () => {
      for (const path of ['index.html', 'games/memory/index.html', 'help/index.html', 'privacy/index.html']) {
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

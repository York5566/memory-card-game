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
    const env = { ...process.env }; delete env.SITE_ORIGIN; delete env.SITE_BASE_PATH;
    const run = (file, extra = {}, args = []) => spawnSync(process.execPath, [file, ...args], { cwd: directory, env: { ...env, ...extra }, encoding: 'utf8' });
    const success = result => assert.equal(result.status, 0, result.stderr || result.stdout);
    const read = path => readFile(join(directory, 'dist', path), 'utf8');
    await t.test('預設正式建置的 CSS、SEO、sitemap 全部使用自訂網域根路徑', async () => {
      success(run('scripts/build.mjs')); success(run('scripts/check.mjs'));
      const html = await read('index.html');
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
      assert.equal(await read('robots.txt'), 'User-agent: *\nDisallow: /\n');
      await assert.rejects(read('sitemap.xml'), { code: 'ENOENT' });
      await assert.rejects(read('CNAME'), { code: 'ENOENT' });
    });
  } finally {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('memory-site-build-')) throw Error('不安全的測試清理路徑');
    await rm(directory, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { siteAddress, pageMetadata } from '../scripts/seo.mjs';
const config = { name: '翻牌遊戲', domain: 'https://york5566.github.io', basePath: '/memory-card-game/' };
const game = { page: 'game', route: 'games/memory', title: '記憶配對挑戰', description: '免費線上記憶配對' };
test('Pages 子目錄、根網域及多餘斜線都產生一致正式網址', () => {
  for (const basePath of ['/', '//', '/memory-card-game/', 'memory-card-game']) {
    const address = siteAddress({ ...config, basePath });
    const output = pageMetadata(game, config, address);
    assert.equal(output.canonical, config.domain + address.base + 'games/memory/');
    assert.ok(output.meta.includes(`"url":"${output.canonical}"`));
    assert.ok(!output.canonical.includes('io//'));
  }
});
test('本機不宣告 canonical；404 不索引且無正式網址與結構化資料', () => {
  const local = pageMetadata(game, config, { base: '/', domain: '' }); assert.equal(local.canonical, ''); assert.ok(!local.meta.includes('rel="canonical"'));
  const error = pageMetadata({ ...game, page: '404', route: null }, config, siteAddress(config));
  assert.ok(error.meta.includes('noindex, follow')); assert.equal(error.canonical, ''); assert.ok(!error.meta.includes('ld+json'));
});
test('標題及 JSON-LD 正確跳脫，不能中斷 script 或注入標籤', () => {
  const unsafe = { ...config, name: '</script><img src=x onerror=alert(1)>' };
  const output = pageMetadata(game, unsafe, siteAddress(config));
  const json = output.meta.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.equal(JSON.parse(json)['@graph'][0].name, unsafe.name); assert.ok(!json.includes('<')); assert.ok(!output.meta.includes('<img'));
});
test('拒絕不安全的 base 路徑與帶驗證資訊或子路徑的正式網域', () => {
  for (const basePath of ['/../', '/./foo', '/bad?path']) assert.throws(() => siteAddress({ ...config, basePath }));
  for (const domain of ['http://example.com', 'https://name:secret@example.com', 'https://example.com/path']) assert.throws(() => siteAddress({ ...config, domain }));
});

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

test('每個正式頁面提供絕對 PNG 分享圖、尺寸、替代文字與一致網址', () => {
  for (const [page, route] of [['home', ''], ['game', 'games/memory'], ['help', 'help']]) {
    const current = { ...config, domain: 'https://wwwne1198.party', basePath: '/' };
    const output = pageMetadata({ ...game, page, route }, current, siteAddress(current));
    assert.ok(output.meta.includes(`property="og:image" content="https://wwwne1198.party/assets/social/${page}.png"`));
    assert.ok(output.meta.includes('name="twitter:card" content="summary_large_image"'));
    assert.ok(output.meta.includes('property="og:image:width" content="1200"'));
    assert.ok(output.meta.includes('property="og:image:height" content="630"'));
    assert.ok(output.meta.includes('property="og:image:alt"'));
    const graph = JSON.parse(output.meta.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
    assert.equal(graph[0].name, '翻牌遊戲'); assert.equal(graph[0].url, 'https://wwwne1198.party/');
    assert.equal(graph[2].url, `https://wwwne1198.party/assets/social/${page}.png`);
    assert.equal(graph[1].primaryImageOfPage['@id'], graph[2]['@id']);
  }
});

test('只有提供真實驗證碼時，正式首頁輸出 Search Console 驗證標籤', () => {
  const current = { ...config, googleSiteVerification: 'token"<&' };
  const home = { ...game, page: 'home', route: '' };
  const output = pageMetadata(home, current, siteAddress(current));
  assert.ok(output.meta.includes('content="token&quot;&lt;&amp;"'));
  assert.ok(!pageMetadata(game, current, siteAddress(current)).meta.includes('google-site-verification'));
  assert.ok(!pageMetadata(home, config, siteAddress(config)).meta.includes('google-site-verification'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { analyticsMarkup } from '../scripts/analytics.mjs';

const source = readFileSync(new URL('../public/js/language.js', import.meta.url), 'utf8');
const key = 'memory-game-language';
function browser(options = {}) {
  const stored = new Map(Object.entries(options.stored || {}));
  if (options.preferred) stored.set(key, options.preferred);
  const redirects = [], navigations = [];
  const here = new URL(options.url || 'https://example.test/games/memory/');
  const storage = {
    getItem(name) { if (options.blocked) throw Error('blocked'); return stored.get(name) ?? null; },
    setItem(name, value) { if (options.blocked) throw Error('blocked'); stored.set(name, value); }
  };
  const window = { localStorage: storage, location: { href: here.href, origin: here.origin, replace: href => redirects.push(href), assign: href => navigations.push(href) } };
  const document = { currentScript: { dataset: { base: options.base || '/', page: options.page || 'game' } }, referrer: options.referrer || '' };
  const navigator = { languages: options.languages ?? ['en-US'], language: options.language, userAgent: options.userAgent || 'Mozilla/5.0 Chrome/140.0' };
  const context = { window, document, navigator, URL };
  runInNewContext(source, context);
  return { context, stored, redirects, navigations, api: window.memoryGameLanguage };
}

test('瀏覽器語言依優先順序匹配繁中、英文、日文與韓文及地區變體', () => {
  for (const [languages, expected] of [
    [['zh-TW'], null], [['zh-CN'], null], [['zh-Hant-HK'], null],
    [['EN-gb'], 'en'], [['ja-JP'], 'ja'], [['ko-KR'], 'ko'],
    [['fr-FR', 'ja-JP', 'en'], 'ja'], [['ko', 'en'], 'ko']
  ]) {
    const result = browser({ languages });
    assert.deepEqual(result.redirects, expected ? [`https://example.test/${expected}/games/memory/`] : []);
    assert.equal(result.stored.has(key), false, 'Detection is not a manual preference');
  }
});
test('未支援語言回退英文；缺少語言資料保留繁中，language 可作備援', () => {
  assert.equal(browser({ languages: ['fr-FR'] }).redirects[0], 'https://example.test/en/games/memory/');
  assert.equal(browser({ languages: [], language: 'ja-JP' }).redirects[0], 'https://example.test/ja/games/memory/');
  assert.deepEqual(browser({ languages: [] }).redirects, []);
});
test('手動保存的語言優先於瀏覽器，無效資料不會當作路徑', () => {
  assert.equal(browser({ preferred: 'ko', languages: ['ja'] }).redirects[0], 'https://example.test/ko/games/memory/');
  assert.deepEqual(browser({ preferred: 'zh-Hant', languages: ['en'] }).redirects, []);
  assert.equal(browser({ preferred: '../../evil', languages: ['ja'] }).redirects[0], 'https://example.test/ja/games/memory/');
});
test('指定語言網址不受瀏覽器或記憶設定覆蓋，重新載入不會循環轉址', () => {
  for (const prefix of ['en/', 'ja/', 'ko/']) assert.deepEqual(browser({ url: 'https://example.test/' + prefix + 'games/memory/', preferred: 'zh-Hant', languages: ['ko'] }).redirects, []);
  const target = browser({ languages: ['ja'] }).redirects[0];
  assert.deepEqual(browser({ url: target, languages: ['ja'] }).redirects, []);
});
test('首頁、遊戲、教學、隱私權政策與子目錄保留查詢參數及錨點，轉址使用 replace', () => {
  for (const [route, page] of [['', 'home'], ['games/memory/', 'game'], ['help/', 'help'], ['help/index.html', 'help'], ['privacy/', 'privacy'], ['privacy/index.html', 'privacy']]) {
    const result = browser({ base: '/nested/', page, url: 'https://example.test/nested/' + route + '?utm_source=line#upload-images', languages: ['ja'] });
    assert.equal(result.redirects[0], 'https://example.test/nested/ja/' + route.replace(/index\.html$/, '') + '?utm_source=line#upload-images');
    assert.deepEqual(result.navigations, []);
    assert.equal(result.api.redirecting, true);
  }
});
test('內部導覽、404、未知路徑及部署根目錄外不會被改到另一頁', () => {
  for (const options of [{ referrer: 'https://example.test/' }, { page: '404' }, { url: 'https://example.test/unknown/' }, { base: '/nested/', url: 'https://example.test/help/' }]) assert.deepEqual(browser(options).redirects, []);
  assert.equal(browser({ referrer: 'https://google.com/' }).redirects.length, 1);
});
test('已知搜尋及分享爬蟲保留要求的完整靜態 HTML', () => {
  for (const userAgent of ['Googlebot', 'Google-InspectionTool/1.0', 'GoogleOther', 'Mediapartners-Google', 'APIs-Google', 'bingbot', 'Discordbot/2.0', 'facebookexternalhit/1.1', 'Twitterbot', 'Slackbot']) assert.deepEqual(browser({ userAgent }).redirects, []);
});
test('儲存空間被拒絕仍能偵測語言，且不會拋錯或阻擋遊戲', () => {
  const result = browser({ blocked: true, languages: ['ko'] });
  assert.equal(result.redirects[0], 'https://example.test/ko/games/memory/');
  assert.equal(result.api.remember('en'), false);
});
test('語言記憶獨立保存，不清除設定、圖片或成績，拒絕未知語言', () => {
  const result = browser({ languages: ['zh'], stored: { 'slow-play-settings': 'settings', 'slow-play-records': 'scores' } });
  assert.equal(result.api.remember('ja'), true);
  assert.equal(result.api.remember('bad'), false);
  assert.equal(result.stored.get(key), 'ja');
  assert.equal(result.stored.get('slow-play-settings'), 'settings');
  assert.equal(result.stored.get('slow-play-records'), 'scores');
});
test('正常手動導覽先保存語言，再開同一頁；不導往外部網址', () => {
  const result = browser({ languages: ['zh'] });
  result.api.navigate('/ja/games/memory/', 'ja');
  assert.equal(result.stored.get(key), 'ja');
  assert.equal(result.navigations[0], 'https://example.test/ja/games/memory/');
  result.api.navigate('https://external.test/', 'en');
  assert.equal(result.navigations.length, 1);
  assert.equal(result.stored.get(key), 'ja');
});
test('儲存被拒絕時手動選繁中加明確語言參數，避免被偵測轉回外文', () => {
  const result = browser({ url: 'https://example.test/ja/games/memory/', blocked: true, languages: ['ja'] });
  result.api.navigate('/games/memory/?utm_source=line#cards', 'zh-Hant');
  assert.equal(result.navigations[0], 'https://example.test/games/memory/?utm_source=line&lang=zh-Hant#cards');
  assert.deepEqual(browser({ url: result.navigations[0], blocked: true, languages: ['ja'] }).redirects, []);
});
test('明確語言參數可覆蓋一般入口偵測，無效參數不影響正常路由', () => {
  assert.deepEqual(browser({ url: 'https://example.test/?lang=zh-Hant', page: 'home', preferred: 'ja' }).redirects, []);
  assert.equal(browser({ url: 'https://example.test/help/?lang=ko', page: 'help' }).redirects[0], 'https://example.test/ko/help/?lang=ko');
  assert.equal(browser({ url: 'https://example.test/?lang=../../evil', page: 'home', languages: ['ja'] }).redirects[0], 'https://example.test/ja/?lang=../../evil');
});

// Execute the actual menu handler with a small DOM adapter; the game cancels this event while asking for confirmation.
function menu({ language = 'ja', current = 'en', cancel = false, ...options } = {}) {
  const result = browser({ url: 'https://example.test/en/games/memory/', ...options });
  let handler, closed = false, requested = 0;
  const link = { lang: language, href: 'https://example.test/' + (language === 'zh-Hant' ? '' : language + '/') + 'games/memory/', addEventListener: (_, fn) => { handler = fn; }, closest: () => ({ removeAttribute: () => { closed = true; } }) };
  Object.assign(result.context.document, {
    documentElement: { lang: current }, body: { dataset: { page: 'game' } },
    querySelectorAll: selector => selector === '[data-language-link]' ? [link] : [], querySelector: () => null,
    dispatchEvent(event) { requested++; if (cancel) event.preventDefault(); return !event.defaultPrevented; }
  });
  result.context.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } };
  result.context.config = { ads: { demo: false, enabled: false } };
  result.context.t = value => value;
  const site = readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/gm, '').replaceAll('export function', 'function');
  runInNewContext(site, result.context);
  let prevented = false;
  handler({ button: 0, preventDefault: () => { prevented = true; } });
  return { ...result, closed, requested, prevented };
}
test('切換尚未確認或被取消時，不保存新的語言也不離開目前頁面', () => {
  const result = menu({ cancel: true, preferred: 'en' });
  assert.equal(result.stored.get(key), 'en');
  assert.deepEqual(result.navigations, []);
  assert.equal(result.requested, 1);
  assert.equal(result.prevented, true);
});
test('手動切換獲准時保存偏好，後續一般入口會套用該語言', () => {
  const result = menu({ preferred: 'en' });
  assert.equal(result.stored.get(key), 'ja');
  assert.deepEqual(result.navigations, ['https://example.test/ja/games/memory/']);
  assert.equal(browser({ preferred: 'ja' }).redirects[0], result.navigations[0]);
});
test('選取目前語言也能記住偏好，關閉選單並保留當局進度', () => {
  const result = menu({ language: 'en', preferred: 'ja' });
  assert.equal(result.stored.get(key), 'en');
  assert.deepEqual(result.navigations, []);
  assert.equal(result.requested, 0);
  assert.equal(result.closed, true);
});
test('自動跳轉入口不產生 GA4 重複 page_view，目的頁才開始追蹤', () => {
  const markup = analyticsMarkup({ ga4MeasurementId: 'G-TEST123' }, { domain: 'https://example.test' }, 'home');
  const script = markup.match(/<script data-site-analytics="ga4">([\s\S]*?)<\/script>/)[1];
  const result = browser({ page: 'home', url: 'https://example.test/', languages: ['ja'] });
  let loads = 0;
  result.context.document.getElementById = () => null;
  result.context.document.createElement = () => ({});
  result.context.document.head = { appendChild: () => { loads++; } };
  runInNewContext(script, result.context);
  assert.equal(loads, 0); assert.equal(result.context.window.dataLayer, undefined);
  result.api.redirecting = false;
  runInNewContext(script, result.context);
  assert.equal(loads, 1); assert.equal(result.context.window.dataLayer.length, 2);
});

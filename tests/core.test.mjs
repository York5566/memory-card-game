import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Game, defaults, sanitize, PRODUCTS, History, LocalStore, ruleKey, ruleSnapshot, rankRows, historicalRecord, toCSV, elapsedText, MAX_RECORDS } from '../public/js/core.js';
function fixture(overrides = {}) {
  const c = { ...defaults(), previewSeconds: 0, pairs: 2, ...overrides }; let now = 0;
  const g = new Game(c, () => now, () => .3); return { g, advance: ms => { now += ms; g.tick(); }, at: ms => { now = ms; g.tick(); } };
}
function pairs(g) { const map = new Map(); g.cards.forEach((id, i) => { if (!map.has(id)) map.set(id, []); map.get(id).push(i); }); return [...map.values()]; }
function win(g) { for (const [a, b] of pairs(g)) { g.flip(a); g.flip(b); } }
class Storage { constructor() { this.data = new Map(); } getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, value); } }

test('新瀏覽器及缺少保存欄位的舊設定預設保存成績；明確關閉仍保留', () => {
  assert.equal(new LocalStore(new Storage()).settings().records.enabled, true);
  assert.equal(sanitize({ records: { leaderboard: true } }).records.enabled, true);
  for (const wrapped of [false, true]) {
    const c = defaults(); c.records.enabled = false;
    const raw = JSON.stringify(wrapped ? { version: 1, config: c } : c), storage = new Storage();
    storage.setItem('slow-play-settings', raw);
    assert.equal(new LocalStore(storage).settings().records.enabled, false);
    assert.equal(storage.getItem('slow-play-settings'), raw);
  }
});
test('恢復預設重新開啟成績保存，仍可復原回關閉狀態', () => {
  const c = defaults(); c.records.enabled = false; const history = new History(c);
  history.replace(defaults()); assert.equal(history.value.records.enabled, true);
  history.undo(); assert.equal(history.value.records.enabled, false);
});

test('預設 6 對為 12 張，所有图案恰好成對且來自內建圖庫', () => { const g = new Game(defaults()); assert.equal(g.cards.length, 12); for (const [id, n] of g.cards.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map())) { assert.equal(n, 2); assert.ok(PRODUCTS.some(p => p.id === id)); } });
test('圖庫數量限制配對選項；未知 ID 與外部路徑不進入設定', () => { const c = defaults(); c.pairs = 12; c.products.forEach((p, i) => p.enabled = i < 3); c.products.push({ id: 'foreign', enabled: true, image: { url: 'https://example.com/photo' } }); c.logo.asset = 'https://evil.com/logo'; const safe = sanitize(c); assert.equal(safe.pairs, 3); assert.equal(safe.products.length, 12); assert.equal(safe.logo.asset, 'none'); assert.ok(!JSON.stringify(safe).includes('https:')); });
test('非法數值、色碼與裁切安全回退，不产生空圖庫', () => { const c = defaults(); c.pairs = NaN; c.cardColor = 'url(javascript:alert(1))'; c.products.forEach(p => p.enabled = false); c.logo.opacity = Infinity; c.back.cropLeft = 99; const safe = sanitize(c); assert.equal(safe.pairs, 2); assert.equal(safe.products.filter(p => p.enabled).length, 2); assert.equal(safe.cardColor, defaults().cardColor); assert.equal(safe.logo.opacity, 100); assert.equal(safe.back.cropLeft, 45); });
test('開局預覽不計挑戰用時，且禁止翻牌', () => { const { g, at } = fixture({ previewSeconds: 3 }); g.start(); at(2999); assert.equal(g.state, 'preview'); assert.equal(g.elapsedMs, 0); assert.equal(g.flip(0), 'ignored'); at(3000); assert.equal(g.state, 'playing'); assert.equal(g.elapsedMs, 0); at(3123); assert.equal(g.elapsedMs, 123); });
test('同張牌連點及已配對牌不会重複計次', () => { const { g } = fixture(); g.start(); const [a, b] = pairs(g)[0]; g.flip(a); assert.equal(g.flip(a), 'ignored'); assert.equal(g.flips, 1); assert.equal(g.flip(b), 'match'); assert.equal(g.flips, 2); assert.equal(g.flip(a), 'ignored'); assert.equal(g.flips, 2); assert.equal(g.matched.size, 2); });
test('配對失敗禁止第三張，指定停留時間後再蓋牌', () => { const { g, advance } = fixture({ mismatchMs: 850 }); g.start(); const [p, q] = pairs(g); g.flip(p[0]); assert.equal(g.flip(q[0]), 'miss'); assert.equal(g.flip(p[1]), 'ignored'); advance(849); assert.equal(g.open.length, 2); advance(1); assert.equal(g.open.length, 0); assert.equal(g.flips, 2); assert.equal(g.flip(p[1]), 'flip'); });
test('暫停遮住牌面，暫停時間不計入挑戰', () => { const { g, advance } = fixture(); g.start(); g.flip(0); advance(432); assert.ok(g.isRevealed(0)); g.pause(); advance(9000); assert.equal(g.elapsedMs, 432); assert.equal(g.isRevealed(0), false); assert.equal(g.flip(1), 'ignored'); g.resume(); advance(100); assert.equal(g.elapsedMs, 532); assert.equal(g.isRevealed(0), true); });
test('預覽期間暫停，回來保留剩餘預覽時間', () => { const { g, advance } = fixture({ previewSeconds: 3 }); g.start(); advance(1000); g.pause(); advance(8000); g.resume(); advance(1999); assert.equal(g.state, 'preview'); advance(1); assert.equal(g.state, 'playing'); assert.equal(g.elapsedMs, 0); });
test('配對失敗停留期間暫停，回來保留停留時間', () => { const { g, advance } = fixture(); g.start(); const [p, q] = pairs(g); g.flip(p[0]); g.flip(q[0]); advance(200); g.pause(); advance(5000); g.resume(); advance(649); assert.equal(g.open.length, 2); advance(1); assert.equal(g.open.length, 0); });
test('計時使用單調時間差，少量 tick 仍正确', () => { const { g, at } = fixture(); g.start(); at(12345.9); assert.equal(g.elapsedMs, 12345); });
test('最後一對在時限之前完成算過關', () => { const { g, at } = fixture({ timed: true, limitSeconds: 5 }); g.start(); at(4999); win(g); assert.equal(g.state, 'won'); assert.equal(g.result.elapsedMs, 4999); at(9999); assert.equal(g.state, 'won'); });
test('最後一對與時限相同，時間到優先且禁止最後翻牌', () => { const { g, at } = fixture({ timed: true, limitSeconds: 5 }); g.start(); const ps = pairs(g); g.flip(ps[0][0]); g.flip(ps[0][1]); g.flip(ps[1][0]); at(5000); assert.equal(g.flip(ps[1][1]), 'ignored'); assert.equal(g.state, 'timeout'); assert.equal(g.result.elapsedMs, 5000); assert.equal(g.flips, 3); });
test('限時包含背景暫停的行為：暂停不扣時限', () => { const { g, advance } = fixture({ timed: true, limitSeconds: 5 }); g.start(); advance(2000); g.pause(); advance(60000); g.resume(); advance(2999); assert.equal(g.state, 'playing'); advance(1); assert.equal(g.state, 'timeout'); });
test('完成不重複生成結果，重新開始归零', () => { const { g } = fixture(); g.start(); win(g); const result = g.result; g.tick(); g.flip(0); assert.equal(g.result, result); assert.equal(g.flips, 4); g.reset(defaults()); assert.equal(g.state, 'ready'); assert.equal(g.flips, 0); assert.equal(g.result, null); });
test('非法卡牌索引与準備狀態不翻牌', () => { const { g } = fixture(); assert.equal(g.flip(0), 'ignored'); g.start(); for (const i of [-1, 4, NaN, .5]) assert.equal(g.flip(i), 'ignored'); assert.equal(g.flips, 0); });
test('純裝飾不拆分排行，圖案辨识性與玩法會分組', () => { const a = defaults(), b = defaults(); b.title.text = '新標題'; b.background.asset = 'none'; b.logo.asset = 'memory-v1'; b.event = '新活動'; b.matchColor = '#ff0000'; assert.equal(ruleKey(a), ruleKey(b)); b.products[0].image.zoom = 50; assert.notEqual(ruleKey(a), ruleKey(b)); });
test('不限時的未使用時長不拆分；限時時長與預覽等難度規則会分組', () => { const a = defaults(), b = defaults(); b.limitSeconds = 123; assert.equal(ruleKey(a), ruleKey(b)); for (const key of ['pairs', 'previewSeconds', 'mismatchMs', 'ratioW', 'columns']) { const c = defaults(); c[key] += 1; assert.notEqual(ruleKey(a), ruleKey(c)); } a.timed = b.timed = true; assert.notEqual(ruleKey(a), ruleKey(b)); });
test('完整規則 ID 固定排序，與对象建構顺序無關', () => { const a = defaults(); const b = Object.fromEntries(Object.entries(a).reverse()); b.products = [...a.products].reverse(); assert.equal(ruleKey(a), ruleKey(b)); assert.ok(ruleKey(a).includes('web-rules-v1')); });
test('只有過關可排名：整數毫秒、翻牌、完成時間，完全相同保持原順序', () => { const rows = [{ id: 'd', elapsedMs: 12346, flips: 2, completedAt: 1 }, { id: 'c', elapsedMs: 12345, flips: 12, completedAt: 1 }, { id: 'b', elapsedMs: 12345, flips: 10, completedAt: 2 }, { id: 'a', elapsedMs: 12345, flips: 10, completedAt: 1 }, { id: 'same', elapsedMs: 12345, flips: 10, completedAt: 1 }].map(r => ({ ...r, outcome: 'won', groupId: 'g' })); rows.push({ ...rows[0], outcome: 'timeout' }); rows.push({ ...rows[0], groupId: 'other' }); assert.deepEqual(rankRows(rows, 'g').map(r => r.id), ['a', 'same', 'b', 'c', 'd']); });
test('歷史保存遵守取消勾選，不因排行榜开啟额外寫入欄位', () => { const c = defaults(); c.records.fields = ['nickname']; const row = historicalRecord({ elapsedMs: 12345, flips: 12, outcome: 'won' }, c, 'id', 500, '=1+1'); assert.deepEqual(row.values, { nickname: '=1+1' }); assert.equal(row.id, 'id'); assert.equal(row.groupId, ruleKey(c)); assert.equal(row.rule.pairs, 6); c.pairs = 4; assert.equal(row.rule.pairs, 6); });
test('歷史明細与设置本機保存不载入會話排行榜', () => { const storage = new Storage(), store = new LocalStore(storage), c = defaults(); const row = historicalRecord({ outcome: 'won', elapsedMs: 10 }, c, 'test-id', 1, '測試'); store.saveRecords([row]); store.saveSettings(c); assert.equal(store.records().length, 1); assert.equal(storage.data.size, 2); assert.ok([...storage.data.keys()].every(key => !/rank|session/.test(key))); const freshSession = []; assert.deepEqual(rankRows(freshSession), []); });
test('滑桿多次 input 为一步复原，復原與重做正确', () => { const h = new History(defaults()); for (let n = 110; n <= 210; n++) h.update('logo.zoom', n); h.commit(); assert.equal(h.past.length, 1); assert.equal(h.value.logo.zoom, 210); h.update('logo.zoom', 200); h.commit(); assert.equal(h.past.length, 2); h.undo(); assert.equal(h.value.logo.zoom, 210); h.undo(); assert.equal(h.value.logo.zoom, 100); h.redo(); assert.equal(h.value.logo.zoom, 210); h.redo(); assert.equal(h.value.logo.zoom, 200); });
test('恢复默认是可复原草稿，不影响已套用值', () => { const applied = defaults(); applied.pairs = 4; const h = new History(applied); h.replace(defaults()); assert.equal(h.value.pairs, 6); assert.equal(applied.pairs, 4); h.undo(); assert.equal(h.value.pairs, 4); });
test('本機设置旧版直接对象迁移，未知素材安全回退', () => { const storage = new Storage(); storage.setItem('slow-play-settings', JSON.stringify({ ...defaults(), pairs: 8, back: { asset: 'removed', zoom: 120 } })); const store = new LocalStore(storage); const c = store.settings(); assert.equal(c.pairs, 8); assert.equal(c.back.asset, 'mint-v1'); assert.equal(c.back.zoom, 120); });
test('舊預設文案更新，保留自訂標題、其他設定與原始儲存內容', () => {
  for (const wrapped of [false, true]) {
    const storage = new Storage(), c = defaults();
    c.pairs = 8; c.title.text = '把每一對，慢慢找回來。'; c.title.subtitle = '記住小小的日常，翻開一點好心情。';
    const raw = JSON.stringify(wrapped ? { version: 1, config: c } : c);
    storage.setItem('slow-play-settings', raw);
    const loaded = new LocalStore(storage).settings();
    assert.equal(loaded.title.text, defaults().title.text); assert.equal(loaded.title.subtitle, defaults().title.subtitle);
    assert.equal(loaded.pairs, 8); assert.equal(storage.getItem('slow-play-settings'), raw);
    c.title.text = '活動自訂標題'; c.title.subtitle = '活動自訂說明';
    storage.setItem('slow-play-settings', JSON.stringify(wrapped ? { version: 1, config: c } : c));
    const custom = new LocalStore(storage).settings();
    assert.equal(custom.title.text, c.title.text); assert.equal(custom.title.subtitle, c.title.subtitle);
  }
});
test('较新设置版本不被旧版覆盖', () => { const storage = new Storage(); const raw = JSON.stringify({ version: 99, config: { future: true } }); storage.setItem('slow-play-settings', raw); const warnings = [], store = new LocalStore(storage, m => warnings.push(m)); assert.equal(store.settings().pairs, 6); assert.equal(store.saveSettings(defaults()), false); assert.equal(storage.getItem('slow-play-settings'), raw); assert.ok(warnings.length); });
test('資料損壞与存取限制均有提示，仍可使用預設遊戲', () => { const storage = new Storage(); storage.setItem('slow-play-settings', 'broken'); const warnings = [], store = new LocalStore(storage, m => warnings.push(m)); assert.equal(store.settings().pairs, 6); assert.ok(warnings.length); const blocked = new LocalStore({ getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); } }, m => warnings.push(m)); assert.equal(blocked.settings().pairs, 6); assert.equal(blocked.saveSettings(defaults()), false); assert.doesNotThrow(() => new Game(blocked.settings())); });
test('容量不足不宣称成功保存，旧资料維持', () => { const storage = new Storage(); storage.setItem('slow-play-settings', 'old'); storage.setItem = () => { throw Error('QuotaExceeded'); }; const warnings = []; const store = new LocalStore(storage, m => warnings.push(m)); assert.equal(store.saveSettings(defaults()), false); assert.equal(storage.getItem('slow-play-settings'), 'old'); assert.ok(warnings.length); });
test('500 笔容量上限，損壞或未知版成績不自动覆盖', () => { const storage = new Storage(), warnings = [], store = new LocalStore(storage, m => warnings.push(m)); const rows = Array.from({ length: 510 }, (_, i) => historicalRecord({}, defaults(), String(i), i, '測試')); store.saveRecords(rows); assert.equal(store.records().length, MAX_RECORDS); assert.equal(store.records()[0].id, '10'); const bad = JSON.stringify({ version: 99, rows: [] }); storage.setItem('slow-play-records', bad); assert.equal(store.records().length, 0); assert.equal(store.saveRecords(rows), false); assert.equal(storage.getItem('slow-play-records'), bad); assert.ok(store.clearRecords()); assert.deepEqual(store.records(), []); });
test('CSV 使用 BOM 与 CRLF，秒毫秒格式，标识码和限時欄位完整', () => { const c = defaults(); const row = historicalRecord({ elapsedMs: 12345, flips: 12, outcome: 'won' }, c, 'rid', 1, '繁體中文'); const csv = toCSV([row]); assert.ok(csv.startsWith('\uFEFF')); for (const s of ['成績識別碼', '完整組別識別碼', '是否限時', '限時時長（秒）', '12 秒 345 毫秒', '挑戰用時（毫秒）', '繁體中文', '否（不限時）']) assert.ok(csv.includes(s), s); assert.ok(csv.endsWith('\r\n')); assert.equal(elapsedText(undefined), '未記錄'); });
test('CSV 正确跳脫引號换行与公式注入；缺少欄位不假填为零', () => { const c = defaults(); c.records.fields = ['nickname']; const a = historicalRecord({}, c, 'a', 0, ' \t=HYPERLINK("x")\n第二行'); c.records.fields = ['elapsedMs']; const b = historicalRecord({ elapsedMs: 12345 }, c, 'b', 0, '其他'); const csv = toCSV([a, b]); assert.ok(csv.includes('"\' \t=HYPERLINK(""x"")\n第二行"')); assert.ok(csv.includes('未記錄')); assert.ok(csv.includes('12345')); });
test('CSV 不为取消保存的时长额外產生原始毫秒欄位', () => { const c = defaults(); c.records.fields = ['nickname']; const csv = toCSV([historicalRecord({ elapsedMs: 1 }, c, 'id', 0, '玩家')]); assert.ok(!csv.includes('挑戰用時（毫秒）')); });
test('損壞規則快照安全處理，不讓成績畫面當掉', () => { const storage = new Storage(), warnings = []; storage.setItem('slow-play-records', JSON.stringify({ version: 1, rows: [{ id: 'bad', groupId: 'bad', rule: {}, values: {} }] })); const store = new LocalStore(storage, m => warnings.push(m)); assert.deepEqual(store.records(), []); assert.equal(store.saveRecords([]), false); assert.ok(warnings.length); });
test('錯誤設定資料結構有提示並使用預設', () => { const storage = new Storage(), warnings = []; storage.setItem('slow-play-settings', JSON.stringify({ version: 1, config: [] })); const store = new LocalStore(storage, m => warnings.push(m)); assert.equal(store.settings().pairs, 6); assert.ok(warnings.length); });

// Run the actual placement module in an inert DOM: scripts never connect to a network.
function adFixture(ads) {
  const appended = []; const host = { className: '', textContent: '', hidden: false, children: [], append(node) { this.children.push(node); } };
  const document = { body: { dataset: { page: 'game' } }, querySelector() { return null; }, querySelectorAll(selector) { return selector === '[data-ad-placement]' ? [host] : []; }, head: { append(node) { appended.push(node); } }, createElement(tag) { return { tag, style: {}, dataset: {}, handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; } }; } };
  const source = readFileSync(new URL('../public/js/site.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/gm, '').replaceAll('export function', 'function');
  const window = {}; runInNewContext(source, { document, window, config: { ads }, t: text => text }); return { host, appended, window };
}
test('廣告預設關閉及不完整 ID 不建立外部程式請求', () => {
  const off = adFixture({ enabled: false, demo: false }); assert.equal(off.appended.length, 0); assert.equal(off.host.children.length, 0);
  const invalid = adFixture({ enabled: true, consentReady: true, publisher: '', slot: '' }); assert.equal(invalid.appended.length, 0);
});
test('廣告示意清楚標示且沒有真實廣告請求', () => { const mock = adFixture({ enabled: false, demo: true }); assert.equal(mock.appended.length, 0); assert.ok(mock.host.textContent.includes('未載入真實廣告')); assert.equal(mock.host.className, 'ad-demo'); });
test('廣告載入或執行失敗會隱藏版位，遊戲繼續運行', () => {
  // These syntax-only test IDs exist solely in this isolated VM, never in the built site.
  const mock = adFixture({ enabled: true, demo: false, consentReady: true, publisher: 'ca-pub-0000000000000000', slot: '0' });
  assert.equal(mock.appended.length, 1); mock.appended[0].handlers.error(); assert.equal(mock.host.hidden, true);
  mock.host.hidden = false; mock.window.adsbygoogle = { push() { throw Error('Blocked'); } }; mock.appended[0].handlers.load(); assert.equal(mock.host.hidden, true);
  const { g } = fixture(); g.start(); win(g); assert.equal(g.state, 'won');
});

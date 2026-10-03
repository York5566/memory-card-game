import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, canonical } from '../public/js/core.js';
import { previewCards, previewTarget } from '../public/js/preview.js';
test('選到圖庫最後一項仍會進入預覽，張數與配對數一致且不更改草稿', () => {
  const config = defaults(), before = canonical(config), selected = config.products.at(-1).id;
  const cards = previewCards(config, selected);
  assert.equal(cards.length, config.pairs * 2); assert.equal(cards.filter(id => id === selected).length, 2);
  assert.equal(canonical(config), before);
});
test('取消勾選的圖案不混入整體牌組，最小與最大圖庫皆成對', () => {
  for (const count of [2, 12]) {
    const config = defaults(); config.pairs = count;
    config.products.forEach((p, i) => { p.enabled = i < count; });
    const cards = previewCards(config, config.products.at(-1).id);
    assert.equal(cards.length, count * 2);
    for (const id of new Set(cards)) { assert.equal(cards.filter(x => x === id).length, 2); assert.ok(config.products.find(p => p.id === id).enabled); }
  }
});
test('調整卡背、圖案與成功提示時自動切到能看到效果的牌面', () => {
  const current = { view: 'board', face: 'front' };
  for (const path of ['back.asset', 'back.zoom', 'backColor']) assert.deepEqual(previewTarget(path, current), { view: 'card', face: 'back' });
  assert.deepEqual(previewTarget('products.11.image.zoom', { view: 'card', face: 'back' }), { view: 'card', face: 'front' });
  assert.deepEqual(previewTarget('matchColor', current), { view: 'card', face: 'matched' });
  assert.equal(previewTarget('logo.canvasW', { view: 'card', face: 'front' }).view, 'board');
});

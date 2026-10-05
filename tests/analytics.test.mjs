import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { analyticsMarkup } from '../scripts/analytics.mjs';
const config = { ga4MeasurementId: 'G-VXMTJFXBHE' }, address = { domain: 'https://wwwne1198.party' };
function browser(origin) {
  const nodes = [];
  const window = { location: { origin } };
  const document = { getElementById: id => nodes.find(node => node.id === id), createElement: () => ({}), head: { appendChild: node => nodes.push(node) } };
  return { window, document, nodes };
}
const script = () => analyticsMarkup(config, address, 'game').match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
test('正式網站只建立一次 Google tag 與預設 page_view 設定', () => {
  const context = browser(address.domain);
  vm.runInNewContext(script(), context); vm.runInNewContext(script(), context);
  assert.equal(context.nodes.length, 1);
  assert.equal(context.nodes[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-VXMTJFXBHE');
  assert.equal(context.nodes[0].async, true);
  const commands = context.window.dataLayer.map(args => Array.from(args));
  assert.equal(commands.length, 2); assert.equal(commands[0][0], 'js');
  assert.deepEqual(commands[1], ['config', 'G-VXMTJFXBHE']);
});
test('即使使用正式成品，本機或其他網域也不載入 GA4 或建立追蹤佇列', () => {
  for (const origin of ['http://127.0.0.1:4180', 'http://localhost:4173', 'null', 'https://other.example', 'http://wwwne1198.party']) {
    const context = browser(origin); vm.runInNewContext(script(), context);
    assert.equal(context.nodes.length, 0); assert.equal(context.window.dataLayer, undefined);
  }
});
test('預覽、404 或未設定 GA4 ID 不輸出任何追蹤碼', () => {
  assert.equal(analyticsMarkup(config, { domain: '' }, 'game'), '');
  assert.equal(analyticsMarkup(config, address, '404'), '');
  assert.equal(analyticsMarkup({ ga4MeasurementId: '' }, address, 'home'), '');
});
test('拒絕無效或可能注入 script 的 GA4 ID', () => {
  for (const ga4MeasurementId of ['UA-1234', 'G-"><script>', 'G-123?x=1']) assert.throws(() => analyticsMarkup({ ga4MeasurementId }, address, 'home'));
});

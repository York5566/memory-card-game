import test from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreenHint } from '../public/js/fullscreen.js';

test('全螢幕縮放提醒立即出現，依 Chrome 預設時長淡出及清除', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const notice = { hidden: true, textContent: '', dataset: {} }, hint = createFullscreenHint(notice, () => true);
  hint.schedule(); assert.equal(notice.hidden, false); assert.equal(notice.textContent, 'CTRL+滾輪可以調整畫面大小');
  t.mock.timers.tick(3799); assert.equal(notice.dataset.state, 'visible');
  t.mock.timers.tick(1); assert.equal(notice.dataset.state, 'closing');
  t.mock.timers.tick(699); assert.equal(notice.hidden, false);
  t.mock.timers.tick(1); assert.equal(notice.hidden, true); assert.equal(notice.textContent, ''); assert.equal(notice.dataset.state, undefined);
});
test('提早退出或不在全螢幕，不會留下通知或淡出計時', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let active = true;
  const notice = { hidden: true, textContent: '', dataset: {} }, hint = createFullscreenHint(notice, () => active);
  hint.schedule(); t.mock.timers.tick(2000); hint.cancel(); t.mock.timers.tick(6000);
  assert.equal(notice.hidden, true); assert.equal(notice.textContent, ''); assert.equal(notice.dataset.state, undefined);
  active = false; hint.schedule(); assert.equal(notice.hidden, true);
  active = true; hint.schedule(); active = false; t.mock.timers.tick(3800); assert.equal(notice.hidden, true);
});
test('重新進入全螢幕重新計時，舊的自動關閉不影響新通知', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const notice = { hidden: true, textContent: '', dataset: {} }, hint = createFullscreenHint(notice, () => true);
  hint.schedule(); t.mock.timers.tick(4000); assert.equal(notice.dataset.state, 'closing');
  hint.schedule(); assert.equal(notice.hidden, false); assert.equal(notice.dataset.state, 'visible');
  t.mock.timers.tick(500); assert.equal(notice.hidden, false); assert.equal(notice.dataset.state, 'visible');
  t.mock.timers.tick(3300); assert.equal(notice.dataset.state, 'closing');
  t.mock.timers.tick(700); assert.equal(notice.hidden, true);
});

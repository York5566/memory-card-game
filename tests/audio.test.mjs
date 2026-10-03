import test from 'node:test';
import assert from 'node:assert/strict';
import { createSounds } from '../public/js/audio.js';
function fixture() {
  const events = []; let release;
  const pending = new Promise(resolve => { release = resolve; });
  class Context {
    state = 'suspended'; destination = {};
    resume() { events.push('resume'); this.state = 'running'; return Promise.resolve(); }
    async decodeAudioData() { events.push('decode'); await pending; return { pcm: true }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { events.push('start'); } }; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  }
  const player = createSounds('/memory-card-game/', { Context, fetchAudio: async url => { events.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; } });
  return { player, events, release, Context };
}
test('開局在等待下載前同步恢復 AudioContext，第一次翻牌等待解碼後播放', async () => {
  const { player, events, release } = fixture();
  const ready = player.prepare(); assert.equal(events[0], 'resume'); await ready;
  const played = player.play('flip'); assert.ok(!events.includes('start'));
  release(); assert.equal(await played, true); assert.equal(events.filter(e => e === 'start').length, 1);
  assert.ok(events.includes('/memory-card-game/assets/flip.wav'));
});
test('解碼途中關閉音效取消待播放音符，再次開啟可播放', async () => {
  const { player, events, release } = fixture();
  const played = player.play('flip'); player.setEnabled(false); release();
  assert.equal(await played, false); assert.ok(!events.includes('start'));
  player.setEnabled(true); assert.equal(await player.play('flip'), true);
});
test('連續翻牌各自建立音源，靜音及未知音效不播放', async () => {
  const { player, events, release } = fixture(); release();
  assert.deepEqual(await Promise.all([player.play('flip'), player.play('flip'), player.play('match')]), [true, true, true]);
  assert.equal(events.filter(e => e === 'start').length, 3);
  player.setEnabled(false); assert.equal(await player.play('win'), false); assert.equal(await player.play('unknown'), false);
});
test('音檔下載失敗可重試，不永久快取失敗結果', async () => {
  const { Context, release } = fixture(); release(); let failing = true, warnings = 0;
  const player = createSounds('/', { Context, onError: () => warnings++, fetchAudio: async () => ({ ok: !failing, status: 503, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await player.play('flip'), false); assert.equal(warnings, 1);
  failing = false; assert.equal(await player.play('flip'), true);
});
test('瀏覽器拒絕音效時回報一次且不拋出未處理錯誤', async () => {
  let warnings = 0;
  class Blocked { state = 'suspended'; resume() { return Promise.reject(Error('blocked')); } async decodeAudioData() { return {}; } }
  const player = createSounds('/', { Context: Blocked, onError: () => warnings++, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await player.play('flip'), false); assert.equal(await player.play('flip'), false); assert.equal(warnings, 1);
});

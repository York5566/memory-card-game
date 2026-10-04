import test from 'node:test';
import assert from 'node:assert/strict';
import { createSounds } from '../public/js/audio.js';
function fixture({ manualWarmup = false } = {}) {
  const events = []; let release, finishWarmup;
  const pending = new Promise(resolve => { release = resolve; });
  class Context {
    state = 'suspended'; destination = {}; sampleRate = 48000;
    resume() { events.push('resume'); this.state = 'running'; return Promise.resolve(); }
    async decodeAudioData() { events.push('decode'); await pending; return { pcm: true }; }
    createBuffer() { return { silent: true }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {
      if (this.buffer.silent) {
        events.push('warmup'); finishWarmup = () => this.onended();
        if (!manualWarmup) queueMicrotask(finishWarmup);
      } else events.push('start');
    } }; }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
  }
  const player = createSounds('/memory-card-game/', { Context, fetchAudio: async url => { events.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; } });
  return { player, events, release, Context, finishWarmup: () => finishWarmup() };
}
test('開局在等待下載前同步恢復 AudioContext，第一次翻牌等待解碼後播放', async () => {
  const { player, events, release } = fixture();
  const ready = player.prepare(); assert.deepEqual(events.slice(0, 2), ['resume', 'warmup']);
  const played = player.play('flip'); assert.ok(!events.includes('start'));
  release(); assert.equal(await ready, true); assert.equal(await played, true); assert.equal(events.filter(e => e === 'start').length, 1);
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
  const { Context, release } = fixture(); release();
  class Blocked extends Context { resume() { return Promise.reject(Error('blocked')); } }
  const player = createSounds('/', { Context: Blocked, onError: () => warnings++, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await player.play('flip'), false); assert.equal(await player.play('flip'), false); assert.equal(warnings, 1);
});

test('下載解碼已完成仍須等無聲輸出暖機，第一張牌才可發聲', async () => {
  const { player, events, release, finishWarmup } = fixture({ manualWarmup: true });
  release();
  const played = player.play('flip');
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.ok(events.includes('decode')); assert.ok(!events.includes('start'));
  finishWarmup();
  assert.equal(await played, true); assert.equal(events.filter(e => e === 'start').length, 1);
});

test('重複準備共用暖機，恢復中斷的音訊則重新暖機', async () => {
  const { Context, release } = fixture(); release(); let context, warmups = 0;
  class Probe extends Context {
    constructor() { super(); context = this; }
    createBufferSource() {
      const source = super.createBufferSource(), start = source.start;
      source.start = function() { if (this.buffer.silent) warmups++; start.call(this); };
      return source;
    }
  }
  const player = createSounds('/', { Context: Probe, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.deepEqual(await Promise.all([player.prepare(), player.prepare()]), [true, true]);
  assert.equal(warmups, 1);
  context.state = 'interrupted';
  assert.equal(await player.prepare(), true); assert.equal(warmups, 2);
});

test('已關閉的 AudioContext 可重新建立，靜音時不進行暖機', async () => {
  const { Context, release } = fixture(); release(); let context, created = 0;
  class Probe extends Context { constructor() { super(); context = this; created++; } }
  const player = createSounds('/', { Context: Probe, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  assert.equal(await player.prepare(), true);
  context.state = 'closed';
  assert.equal(await player.play('flip'), true); assert.equal(created, 2);
  player.setEnabled(false); assert.equal(await player.prepare(), false);
});

test('音訊恢復一直未完成時會結束等待，不讓開始按鈕永久卡住', async t => {
  const { Context, release } = fixture(); release();
  class Pending extends Context { resume() { return new Promise(() => {}); } }
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const player = createSounds('/', { Context: Pending, fetchAudio: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) });
  const ready = player.prepare();
  t.mock.timers.tick(4000);
  assert.equal(await ready, false);
});

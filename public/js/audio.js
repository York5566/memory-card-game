import { createFlipBuffer } from './flip-sound.js';
const NAMES = ['flip', 'match', 'miss', 'win'];

// Start an actual silent source inside the gesture, not only an empty context.
// Wait for that source and the flip buffer before exposing the first playable card.
export function createSounds(base, { Context = globalThis.AudioContext || globalThis.webkitAudioContext, getContext, fetchAudio = globalThis.fetch, onError = () => {} } = {}) {
  let context, warmup, warming = false, enabled = true, generation = 0, warned = false;
  const bytes = new Map(), buffers = new Map(), decoded = new Map();
  const voices = new Set();
  const load = name => {
    if (!bytes.has(name)) bytes.set(name, Promise.resolve().then(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetchAudio(`${base}assets/${name}.wav`, { signal: controller.signal });
        if (!response.ok) throw Error(`Audio HTTP ${response.status}`);
        return await response.arrayBuffer();
      }
      finally { clearTimeout(timer); }
    })
      .catch(() => { bytes.delete(name); return null; }));
    return bytes.get(name);
  };
  NAMES.filter(name => name !== 'flip').forEach(load);
  function buffer(name) {
    if (name === 'flip' && !decoded.has(name)) decoded.set(name, createFlipBuffer(context));
    if (decoded.has(name)) return Promise.resolve(decoded.get(name));
    if (!buffers.has(name)) buffers.set(name, load(name).then(data => {
      if (!data) throw Error('Audio unavailable');
      return context.decodeAudioData(data.slice(0));
    }).then(value => { decoded.set(name, value); return value; }).catch(error => { buffers.delete(name); throw error; }));
    return buffers.get(name);
  }
  function prepare() {
    if (!enabled) return Promise.resolve(false);
    try {
      if (!context || context.state === 'closed') {
        context = getContext ? getContext() : new Context({ latencyHint: 'interactive' });
        buffers.clear(); decoded.clear(); warmup = null;
      }
      const needsResume = context.state !== 'running';
      // Both resume and source.start must run before awaiting anything.
      const resumed = needsResume ? context.resume() : Promise.resolve();
      if (!warmup || (needsResume && !warming)) {
        const source = context.createBufferSource();
        const lead = Math.min(.5, Math.max(.18, (context.baseLatency || 0) + (context.outputLatency || 0) + .04));
        source.buffer = context.createBuffer(1, Math.ceil(context.sampleRate * lead), context.sampleRate);
        source.connect(context.destination);
        warming = true;
        warmup = new Promise(resolve => {
          source.onended = () => { source.disconnect(); warming = false; resolve(); };
        });
        source.start(0);
      }
      NAMES.forEach(name => { buffer(name).catch(() => {}); });
      const prepared = Promise.all([resumed, warmup, buffer('flip')]).then(() => context.state === 'running').catch(() => false);
      return new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), 4000);
        prepared.then(ready => { clearTimeout(timer); resolve(ready); });
      });
    } catch { return Promise.resolve(false); }
  }
  return {
    prepare,
    setEnabled(value) { enabled = Boolean(value); generation++; if (!enabled) { for (const source of voices) source.stop(); voices.clear(); } },
    async play(name) {
      if (!enabled || !NAMES.includes(name)) return false;
      const requested = generation;
      try {
        // A prepared first flip starts inside the card gesture with no fetch/await.
        if (!context || context.state !== 'running' || warming || !decoded.has(name)) {
          if (!await prepare()) throw Error('Audio context unavailable');
          await buffer(name);
        }
        if (!enabled || requested !== generation) return false;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = decoded.get(name); gain.gain.value = .24;
        source.connect(gain); gain.connect(context.destination);
        voices.add(source);
        source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        source.start(context.currentTime + .02); warned = false; return true;
      } catch {
        if (!warned && enabled) { warned = true; onError(); }
        return false;
      }
    },
  };
}

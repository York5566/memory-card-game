const NAMES = ['flip', 'match', 'miss', 'win'];

// Start an actual silent source inside the gesture, not only an empty context.
// Wait for that source and the flip buffer before exposing the first playable card.
export function createSounds(base, { Context = globalThis.AudioContext || globalThis.webkitAudioContext, fetchAudio = globalThis.fetch, onError = () => {} } = {}) {
  let context, warmup, warming = false, enabled = true, generation = 0, warned = false;
  const bytes = new Map(), buffers = new Map();
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
  NAMES.forEach(load);
  function buffer(name) {
    if (!buffers.has(name)) buffers.set(name, load(name).then(data => {
      if (!data) throw Error('Audio unavailable');
      return context.decodeAudioData(data.slice(0));
    }).catch(error => { buffers.delete(name); throw error; }));
    return buffers.get(name);
  }
  function prepare() {
    if (!enabled) return Promise.resolve(false);
    try {
      if (!context || context.state === 'closed') {
        context = new Context({ latencyHint: 'interactive' });
        buffers.clear(); warmup = null;
      }
      const needsResume = context.state !== 'running';
      // Both resume and source.start must run before awaiting anything.
      const resumed = needsResume ? context.resume() : Promise.resolve();
      if (!warmup || (needsResume && !warming)) {
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .12), context.sampleRate);
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
    setEnabled(value) { enabled = Boolean(value); generation++; },
    async play(name) {
      if (!enabled || !NAMES.includes(name)) return false;
      const requested = generation;
      try {
        if (!await prepare()) throw Error('Audio context unavailable');
        const decoded = await buffer(name);
        if (!enabled || requested !== generation) return false;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = decoded; gain.gain.value = .24;
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
        source.start(); warned = false; return true;
      } catch {
        if (!warned && enabled) { warned = true; onError(); }
        return false;
      }
    },
  };
}

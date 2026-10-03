const NAMES = ['flip', 'match', 'miss', 'win'];

// Fetch early; create/resume the audio context synchronously inside a user gesture.
// A first flip waits for decoding instead of silently losing the sound.
export function createSounds(base, { Context = globalThis.AudioContext || globalThis.webkitAudioContext, fetchAudio = globalThis.fetch, onError = () => {} } = {}) {
  let context, enabled = true, generation = 0, warned = false;
  const bytes = new Map(), buffers = new Map();
  const load = name => {
    if (!bytes.has(name)) bytes.set(name, Promise.resolve().then(() => fetchAudio(`${base}assets/${name}.wav`))
      .then(response => { if (!response.ok) throw Error(`Audio HTTP ${response.status}`); return response.arrayBuffer(); })
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
      context ||= new Context();
      // Do not await network or decoding before resume: activation would be lost.
      const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      NAMES.forEach(name => { buffer(name).catch(() => {}); });
      return Promise.resolve(resumed).then(() => true).catch(() => false);
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

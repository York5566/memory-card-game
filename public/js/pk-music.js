// Original, locally synthesized music: no media downloads or third-party tracks.
// A sparse pentatonic marimba/bass loop leaves room for the brighter card effects.
export function composeLoop(sampleRate = 22050) {
  const beat = 60 / 96, length = 32 * beat, data = new Float32Array(Math.ceil(length * sampleRate));
  const melody = [64,null,67,69,null,67,62,null,60,null,64,67,null,64,62,null,62,null,67,69,null,72,69,null,67,null,64,62,null,60,null,null];
  function note(midi, at, duration, volume, woody) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    for (let i = 0, n = Math.floor(duration * sampleRate); i < n; i++) {
      const t = i / sampleRate, env = Math.min(1, t / .012) * Math.exp(-t / (woody ? .19 : .38)) * Math.min(1, (duration - t) / .06);
      const wave = Math.sin(2 * Math.PI * hz * t) + (woody ? .16 * Math.sin(2 * Math.PI * hz * 2 * t) : 0);
      data[(Math.floor(at * sampleRate) + i) % data.length] += wave * env * volume;
    }
  }
  melody.forEach((midi, i) => { if (midi !== null) note(midi, i * beat, .7, .18, true); });
  [48,45,41,43].forEach((root, bar) => {
    note(root, bar * 8 * beat, 1.25, .17, false);
    note(root + 7, (bar * 8 + 4) * beat, 1.1, .12, false);
  });
  return data;
}
export function createPKMusic({ Context = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let context, gain, buffer, source, phase = 'off', enabled = true, visible = true, failed = false;
  const volume = () => phase === 'playing' ? .10 : .13;
  function stop() { if (source) { source.stop(); source.disconnect(); source = null; } }
  function sync() {
    if (!enabled || !visible || phase === 'off' || !context || context.state !== 'running') { stop(); return; }
    if (!source) {
      source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(gain); gain.gain.setValueAtTime(0, context.currentTime); source.start();
    }
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setTargetAtTime(volume(), context.currentTime, .25);
  }
  return {
    // Called synchronously from a click so Chrome can unlock the context.
    async unlock() {
      if (!enabled || !Context) return false;
      try {
        if (!context || context.state === 'closed') {
          context = new Context({ latencyHint: 'playback' }); gain = context.createGain(); gain.connect(context.destination);
          const samples = composeLoop(); buffer = context.createBuffer(1, samples.length, 22050); buffer.copyToChannel(samples, 0);
        }
        await context.resume(); failed = false; sync(); return true;
      } catch { failed = true; stop(); return false; }
    },
    setPhase(value) { if (phase !== value) { phase = value; sync(); } },
    setEnabled(value) { enabled = Boolean(value); sync(); },
    setVisible(value) { visible = Boolean(value); sync(); },
    duck() {
      if (!source) return;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(.025, now, .025);
      gain.gain.setTargetAtTime(volume(), now + .3, .18);
    },
    get failed() { return failed; },
    stop() { phase = 'off'; stop(); },
  };
}

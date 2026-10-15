// Original local arcade-pop loop: bouncy major-key plucks, bass, kick and soft shakers.
// Deterministic synthesis avoids media downloads and additional cloud traffic.
function addTone(data, sampleRate, midi, at, duration, volume, bright = true) {
  const hz = 440 * 2 ** ((midi - 69) / 12), n = Math.floor(duration * sampleRate);
  for (let i = 0; i < n; i++) {
    const time = i / sampleRate;
    const envelope = Math.min(1,time/.008) * Math.exp(-time/(bright?.11:.18)) * Math.min(1,(duration-time)/.035);
    const wave = Math.sin(2*Math.PI*hz*time) + (bright ? .22*Math.sin(4*Math.PI*hz*time) : 0);
    const offset = Math.floor(at*sampleRate)+i;
    if(offset < data.length) data[offset] += wave * envelope * volume;
  }
}
export function composeLoop(sampleRate = 22050) {
  const beat = 60 / 126, data = new Float32Array(Math.ceil(32 * beat * sampleRate));
  const tune=[64,67,72,null,69,67,64,67, 65,69,72,69,67,null,64,null,
    64,67,71,74,72,71,67,null, 62,67,69,67,64,62,60,null];
  const roots=[48,53,45,43];
  for(let bar=0;bar<8;bar++) {
    const root=roots[bar%4];
    for(let step=0;step<8;step++) {
      const midi=tune[(bar*8+step)%tune.length], at=(bar*4+step*.5)*beat;
      if(midi!==null)addTone(data,sampleRate,midi,at,.25,step%2?.14:.19);
      if(step%2===0)addTone(data,sampleRate,root+(step===4?7:0),at,.3,.19,false);
      // Quiet deterministic percussion, kept below the card effects.
      for(let i=0,n=Math.floor(.09*sampleRate);i<n;i++) {
        const time=i/sampleRate, offset=Math.floor(at*sampleRate)+i;
        const shaker=Math.sin(i*12.9898+step*78.233)*Math.exp(-time*80)*.025;
        const kick=step%4===0?Math.sin(2*Math.PI*(85*time-220*time*time))*Math.exp(-time*35)*.14:0;
        if(offset<data.length)data[offset]+=shaker+kick;
      }
    }
  }
  data[0]=0;data[data.length-1]=0;
  return data;
}
export function composeCue(name, sampleRate=22050) {
  const patterns={found:[[72,0],[76,.14],[79,.28]],start:[[72,0],[72,.2],[84,.4],[79,.4]],turn:[[79,0],[84,.12]],rematch:[[76,0],[79,.12],[76,.3],[79,.42]],notice:[[74,0],[69,.22]]};
  const notes=patterns[name]; if(!notes)return null;
  const data=new Float32Array(Math.ceil(.95*sampleRate));
  for(const [note,at] of notes)addTone(data,sampleRate,note,at,.4,.35);
  return data;
}
// Shared by solo and PK. A hidden tab is still allowed to play music and cues.
export function createGameMusic({ Context = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let context, gain, buffer, source, phase = 'off', enabled = true, failed = false;
  const cues = new Set(), cueBuffers = new Map();
  const volume = () => phase === 'playing' ? .16 : .20;
  function stop() { if (source) { source.stop(); source.disconnect(); source = null; } }
  function stopCues() { for (const voice of cues) voice.stop(); cues.clear(); }
  function sync() {
    if (!enabled || phase === 'off' || !context || context.state !== 'running') { stop(); return; }
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
      if (!Context) return false;
      try {
        if (!context || context.state === 'closed') {
          context = new Context({ latencyHint: 'playback' }); gain = context.createGain(); gain.connect(context.destination);
          const samples = composeLoop(); buffer = context.createBuffer(1, samples.length, 22050); buffer.copyToChannel(samples, 0);
        }
        await context.resume(); failed = false; sync(); return true;
      } catch { failed = true; stop(); return false; }
    },
    setPhase(value) { if (phase !== value) { phase = value; sync(); } },
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stopCues(); sync(); },
    duck() {
      if (!source) return;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(.025, now, .025);
      gain.gain.setTargetAtTime(volume(), now + .3, .18);
    },
    cue(name) {
      if (!enabled || !context || context.state !== 'running') return false;
      if (!cueBuffers.has(name)) {
        const samples=composeCue(name); if(!samples)return false;
        const decoded=context.createBuffer(1,samples.length,22050);decoded.copyToChannel(samples,0);cueBuffers.set(name,decoded);
      }
      this.duck();
      const voice=context.createBufferSource(), volume=context.createGain();
      voice.buffer=cueBuffers.get(name);volume.gain.value=.25;voice.connect(volume);volume.connect(context.destination);cues.add(voice);
      voice.onended=()=>{cues.delete(voice);voice.disconnect();volume.disconnect();};voice.start();return true;
    },
    get failed() { return failed; },
    stop() { phase = 'off'; stop(); stopCues(); },
  };
}
export { createGameMusic as createPKMusic };

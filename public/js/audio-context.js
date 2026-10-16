// One output device/context for music and effects, created inside a user gesture.
export function createAudioContextProvider({ Context = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let context;
  return () => {
    if (!context || context.state === 'closed') {
      if (!Context) throw new Error('Audio unavailable');
      context = new Context({ latencyHint: 'interactive' });
    }
    return context;
  };
}

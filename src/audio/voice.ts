import { FORMANTS, type Tone } from "./music";

export function noiseBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.04) / 1.02;
    data[i] = brown * 3.5;
  }
  return buffer;
}

/**
 * Click-free envelopes. Each voice releases and disconnects its nodes on completion. A cue is a plain `Note`; music's
 * `Tone`s may also swell in slowly (`attack`), detune, pick the noise filter, or sing a vowel through two formant filters.
 */
export function voice(ctx: BaseAudioContext, bus: AudioNode, n: Tone, at: number, noise: AudioBuffer) {
  const start = at + n.at;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), start + (n.attack === undefined ? 0.008 : Math.min(Math.max(0.008, n.attack), n.duration * 0.92)));
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + n.duration);
  envelope.connect(bus);
  if (n.wave === "noise") {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    source.buffer = noise;
    filter.type = n.filter ?? "lowpass";
    if (n.q !== undefined) filter.Q.value = n.q;
    filter.frequency.setValueAtTime(n.hz, start);
    filter.frequency.exponentialRampToValueAtTime(n.endHz ?? n.hz, start + n.duration);
    source.connect(filter).connect(envelope);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + n.duration + 0.02);
  } else {
    const source = ctx.createOscillator();
    source.type = n.wave;
    if (n.detune) source.detune.value = n.detune;
    source.frequency.setValueAtTime(n.hz, start);
    source.frequency.exponentialRampToValueAtTime(n.endHz ?? n.hz, start + n.duration);
    const formants = n.vowel ? FORMANTS[n.vowel].map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = hz; filter.Q.value = i ? 7 : 5;
      source.connect(filter).connect(envelope);
      return filter;
    }) : [];
    if (!n.vowel) source.connect(envelope);
    source.onended = () => { source.disconnect(); formants.forEach((f) => f.disconnect()); envelope.disconnect(); };
    source.start(start); source.stop(start + n.duration + 0.02);
  }
}

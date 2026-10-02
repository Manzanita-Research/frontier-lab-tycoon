import { formant, type Tone } from "./music";

/** A 25% pulse wave (a "custom" oscillator): every harmonic but each fourth, so formants have something to shape. */
const pulses = new WeakMap<BaseAudioContext, PeriodicWave>();
function pulse(ctx: BaseAudioContext) {
  let wave = pulses.get(ctx);
  if (!wave) {
    const real = new Float32Array(48); const imag = new Float32Array(48);
    for (let n = 1; n < 48; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    wave = ctx.createPeriodicWave(real, imag);
    pulses.set(ctx, wave);
  }
  return wave;
}

/** F1 is broad, F2 and F3 narrower, like a voice's. */
const FORMANT_Q = [4, 8, 10] as const;

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

/** White noise for the band's hats, snares and consonants: the brown `noiseBuffer` has almost nothing above 5 kHz. */
export function whiteNoise(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Click-free envelopes. Each voice releases and disconnects its nodes on completion. A cue is a plain `Note`; music's
 * `Tone`s may also swell in slowly (`attack`), hold (`hold`), detune, pick the noise filter, or sing a vowel through three formant
 * filters that glide through the tone's `to` vowels (FLT-80: that glide is what makes "o-kay" a word).
 */
export function voice(ctx: BaseAudioContext, bus: AudioNode, n: Tone, at: number, noise: AudioBuffer) {
  const start = at + n.at;
  const envelope = ctx.createGain();
  // A gain starts at 1: a source that starts between two samples can leak one loud sample before `start`, so close it now.
  envelope.gain.value = 0;
  envelope.gain.setValueAtTime(0.0001, start);
  const peak = start + (n.attack === undefined ? 0.008 : Math.min(Math.max(0.008, n.attack), n.duration * 0.92));
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), peak);
  // A held tone (a sung vowel) stays up until its release; anything else decays from the peak, like a pluck.
  if (n.hold) envelope.gain.setValueAtTime(Math.max(0.0002, n.gain), Math.max(peak, start + n.duration * n.hold));
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
    if (n.wave === "custom") source.setPeriodicWave(pulse(ctx)); else source.type = n.wave;
    if (n.detune) source.detune.value = n.detune;
    source.frequency.setValueAtTime(n.hz, start);
    source.frequency.exponentialRampToValueAtTime(n.endHz ?? n.hz, start + n.duration);
    const vowels = n.vowel ? [n.vowel, ...(n.to ?? [])] : [];
    const formants = n.vowel ? FORMANT_Q.map((q, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass"; filter.Q.value = q;
      filter.frequency.setValueAtTime(formant(n.vowel!, i), start);
      // Hold the first vowel a moment, then glide through the rest, arriving at the last one at 80% of the note.
      if (vowels.length > 1) filter.frequency.setValueAtTime(formant(n.vowel!, i), start + n.duration * 0.2);
      vowels.slice(1).forEach((v, k, rest) => filter.frequency.linearRampToValueAtTime(formant(v, i), start + n.duration * (0.2 + (0.6 * (k + 1)) / rest.length)));
      source.connect(filter).connect(envelope);
      return filter;
    }) : [];
    if (!n.vowel) source.connect(envelope);
    source.onended = () => { source.disconnect(); formants.forEach((f) => f.disconnect()); envelope.disconnect(); };
    source.start(start); source.stop(start + n.duration + 0.02);
  }
}

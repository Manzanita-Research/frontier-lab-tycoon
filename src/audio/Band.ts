// FLT-66: the band. One gain bus per mode under the music bus, so a switch is two gain ramps at the bar line, and a
// queue of planned tones that become voices a fraction of a second before they sound (a few nodes per frame, no bursts).
import { MODES, conduct, meter, plan, type Conductor, type Cue, type Mode, type Tone, type Want } from "./music";
import { voice, whiteNoise } from "./voice";

/** Main-thread cost per mode: time spent planning and building voices, and how many voices. */
export interface ModeCost { frames: number; ms: number; maxMs: number; voices: number; seconds: number }
const zero = (): ModeCost => ({ frames: 0, ms: 0, maxMs: 0, voices: 0, seconds: 0 });
const VOICES_PER_PUMP = 6;
const clock = () => (typeof performance === "undefined" ? Date.now() : performance.now());

export class Band {
  private buses: Record<Mode | "fx", GainNode>;
  private conductor: Conductor;
  private queue: Cue[] = [];
  private last = -1;
  readonly cost: Record<Mode, ModeCost> = { nap: zero(), walkies: zero(), fetch: zero(), zoomies: zero() };
  /** FLT-105: cents every new voice is bent by (a trip's slow warble). 0: in tune. */
  bend = 0;
  /** `solo`: voice only that part of the band (an offline stem, e.g. the choir for the words check). */
  constructor(private ctx: BaseAudioContext, out: AudioNode, want: Want, private noise = whiteNoise(ctx), private solo?: Tone["part"]) {
    const bus = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(out); return g; };
    this.buses = { nap: bus(), walkies: bus(), fetch: bus(), zoomies: bus(), fx: bus() };
    this.buses.fx.gain.value = 1;
    this.conductor = conduct(want);
  }
  get want() { return this.conductor.want; }
  /** What is playing now: the mode of the bar in progress, which is the old one until the bar line. */
  get playing(): Mode { return this.conductor.lane?.mode ?? this.conductor.want.mode; }
  get bar() { return this.conductor.lane?.bar ?? 0; }
  get bpm() { return meter(this.playing, this.conductor.lane?.era ?? this.want.era).bpm; }
  get pending() { return this.queue.length; }
  /** Ask for a mode, flavour or key. Nothing changes until the next bar line. */
  set(want: Want) {
    const w = this.conductor.want;
    if (w.mode !== want.mode || w.flavour !== want.flavour || w.era !== want.era) this.conductor = { ...this.conductor, want };
  }
  /** Muted or hidden: drop what is planned. The next `pump` starts the wanted band afresh, with no catch-up. */
  hold() { this.queue = []; this.conductor = { ...this.conductor, lane: this.conductor.lane && { ...this.conductor.lane, start: -Infinity } }; this.last = -1; }
  /** Plan the bars that start within `horizon` and voice the tones that do. Call it every frame (or in a loop, offline). */
  pump(now: number, horizon = 0.2) {
    const t0 = clock();
    const mode = this.playing;
    const p = plan(this.conductor, now, horizon);
    this.conductor = p.conductor;
    for (const f of p.fades) {
      const g = this.buses[f.bus].gain;
      g.cancelScheduledValues(f.at);
      g.setValueAtTime(f.from, f.at);
      if (f.over > 0) g.linearRampToValueAtTime(f.to, f.at + f.over);
    }
    if (p.cues.length) { this.queue.push(...p.cues); this.queue.sort((a, b) => a.tone.at - b.tone.at); }
    let voiced = 0;
    // At most a few voices a frame, so a downbeat's dozen is spread over the frames before it; one due soon goes now.
    while (this.queue.length && this.queue[0]!.tone.at < now + horizon && (voiced < VOICES_PER_PUMP || this.queue[0]!.tone.at < now + 0.1)) {
      const cue = this.queue.shift()!;
      // A tone whose moment passed while the page stalled is skipped, not crammed in late.
      if (cue.tone.at < now - 0.05 || (this.solo && cue.tone.part !== this.solo)) continue;
      voice(this.ctx, this.buses[cue.bus], this.bend ? { ...cue.tone, at: 0, detune: (cue.tone.detune ?? 0) + this.bend } : { ...cue.tone, at: 0 }, cue.tone.at, this.noise);
      voiced++;
    }
    const cost = this.cost[mode];
    const ms = clock() - t0;
    cost.frames++; cost.ms += ms; cost.maxMs = Math.max(cost.maxMs, ms); cost.voices += voiced;
    if (this.last >= 0) cost.seconds += Math.max(0, Math.min(0.5, now - this.last));
    this.last = now;
  }
  /** Per mode: mean and worst main-thread milliseconds per frame, and voices started per second of music. */
  costReport() {
    return Object.fromEntries(MODES.map((m) => {
      const c = this.cost[m];
      return [m, { frames: c.frames, meanMs: c.frames ? c.ms / c.frames : 0, maxMs: c.maxMs, voicesPerSecond: c.seconds ? c.voices / c.seconds : 0, seconds: c.seconds }];
    }));
  }
}

/** The master chain both realtime and offline playback use: a gentle limiter before the speakers. */
export function limiter(ctx: BaseAudioContext) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 8;
  return limiter;
}

/** A score for an offline clip: from `at` seconds on, play `mode`. */
export interface Take { at: number; mode: Mode }
/**
 * Render the band to a buffer with an OfflineAudioContext, through the same buses, voices and limiter as the game,
 * at the given mixer levels. The show-and-tell clips and the bar-sync evidence come from here.
 */
export async function renderMusic(takes: readonly Take[], seconds: number, want: Omit<Want, "mode">, levels = { master: 0.7, music: 0.3 }, sampleRate = 48000, solo?: Tone["part"]) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const music = ctx.createGain(); const master = ctx.createGain();
  music.gain.value = levels.music; master.gain.value = levels.master;
  music.connect(master).connect(limiter(ctx)).connect(ctx.destination);
  const band = new Band(ctx, music, { ...want, mode: takes[0]?.mode ?? "walkies" }, undefined, solo);
  // The same 60 Hz pump the game runs, so the clip hears exactly when a press would have been heard.
  for (let t = 0; t < seconds; t += 1 / 60) {
    for (const take of takes) if (take.at <= t) band.set({ ...want, mode: take.mode });
    band.pump(t, 0.2);
  }
  return ctx.startRendering();
}

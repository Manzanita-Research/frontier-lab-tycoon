import { CHORDS, CUES, HOOKS, cueNotes, eraScore, hookNotes, midi, type Cue, type Hook, type Note } from "./score";

export interface Mixer { master: number; music: number; sfx: number; muted: boolean }
export const DEFAULT_MIXER: Mixer = { master: 0.7, music: 0.3, sfx: 0.65, muted: false };
export interface Beds { crowd: number; protesters: number; training: number | null; night: number; era: string }
const SILENT: Beds = { crowd: 0, protesters: 0, training: null, night: 0, era: "seed" };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function readMixer(raw: string | null): Mixer {
  try {
    const v: unknown = JSON.parse(raw ?? "null");
    if (!v || typeof v !== "object") return { ...DEFAULT_MIXER };
    const o = v as Record<string, unknown>;
    const level = (key: "master" | "music" | "sfx") => typeof o[key] === "number" && Number.isFinite(o[key]) ? clamp(o[key]) : DEFAULT_MIXER[key];
    return { master: level("master"), music: level("music"), sfx: level("sfx"), muted: typeof o.muted === "boolean" ? o.muted : false };
  } catch { return { ...DEFAULT_MIXER }; }
}

function noiseBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    brown = (brown + (Math.random() * 2 - 1) * 0.04) / 1.02;
    data[i] = brown * 3.5;
  }
  return buffer;
}

/** Click-free envelopes. Each voice releases and disconnects its nodes on completion. */
function voice(ctx: BaseAudioContext, bus: AudioNode, n: Note, at: number, noise: AudioBuffer) {
  const start = at + n.at;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + n.duration);
  envelope.connect(bus);
  if (n.wave === "noise") {
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    source.buffer = noise;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(n.hz, start);
    filter.frequency.exponentialRampToValueAtTime(n.endHz ?? n.hz, start + n.duration);
    source.connect(filter).connect(envelope);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + n.duration + 0.02);
  } else {
    const source = ctx.createOscillator();
    source.type = n.wave;
    source.frequency.setValueAtTime(n.hz, start);
    source.frequency.exponentialRampToValueAtTime(n.endHz ?? n.hz, start + n.duration);
    source.connect(envelope);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
    source.start(start); source.stop(start + n.duration + 0.02);
  }
}
export function synthCue(ctx: BaseAudioContext, bus: AudioNode, cue: Cue, variation = 0, noise = noiseBuffer(ctx)) {
  synthNotes(ctx, bus, cueNotes(cue, variation), noise);
}
export function synthNotes(ctx: BaseAudioContext, bus: AudioNode, notes: readonly Note[], noise = noiseBuffer(ctx)) {
  for (const n of notes) voice(ctx, bus, n, ctx.currentTime + 0.005, noise);
}

/** A cue's notes: a mod's version (FLT-55) if it has one, else the base cue or hook, else null (an unknown name is silent). */
export function notesFor(name: string, overrides: Readonly<Record<string, readonly Note[]>>, variation = 0): readonly Note[] | null {
  if (Object.hasOwn(overrides, name)) return overrides[name]!;
  if ((CUES as readonly string[]).includes(name)) return cueNotes(name as Cue, variation);
  if ((HOOKS as readonly string[]).includes(name)) return hookNotes(name as Hook);
  return null;
}

/** One lazy WebAudio graph, owned by SoundLayer. No audio files, no sim RNG and no timer/watchers. */
export class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private crowd: GainNode | null = null;
  private training: GainNode | null = null;
  private hum: OscillatorNode | null = null;
  private noise: AudioBuffer | null = null;
  private continuous: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private nextBeat = 0;
  private beat = 0;
  private nextBed = 0;
  private variation = 0;
  private lastCue = new Map<string, number>();
  private overrides: Readonly<Record<string, readonly Note[]>> = {};
  private beds: Beds = SILENT;
  private hidden = false;
  private disposed = false;
  mixer: Mixer;
  constructor(mixer = DEFAULT_MIXER) { this.mixer = { ...mixer }; }
  get status() { return this.ctx?.state ?? "locked"; }

  async unlock(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      if (!this.ctx) {
        const ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!ctor) return false;
        const ctx = this.ctx = new ctor();
        this.master = ctx.createGain(); this.music = ctx.createGain(); this.sfx = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 8;
        this.music.connect(this.master); this.sfx.connect(this.master);
        this.master.connect(limiter).connect(ctx.destination);
        this.noise = noiseBuffer(ctx);
        const source = ctx.createBufferSource();
        source.buffer = this.noise; source.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 480; filter.Q.value = 0.8;
        this.crowd = ctx.createGain(); this.crowd.gain.value = 0;
        source.connect(filter).connect(this.crowd).connect(this.sfx); source.start();
        this.hum = ctx.createOscillator(); this.hum.type = "triangle";
        this.training = ctx.createGain(); this.training.gain.value = 0;
        this.hum.connect(this.training).connect(this.sfx); this.hum.start();
        this.continuous = [source, this.hum];
        this.nextBeat = ctx.currentTime; this.nextBed = ctx.currentTime;
        this.setMixer(this.mixer);
      }
      if (this.ctx.state === "suspended" && !this.hidden) await this.ctx.resume();
      return this.ctx.state === "running";
    } catch { return false; }
  }

  setMixer(mixer: Mixer) {
    this.mixer = { ...mixer };
    const ctx = this.ctx;
    if (!ctx) return;
    this.master?.gain.setTargetAtTime(mixer.muted || this.hidden ? 0 : mixer.master, ctx.currentTime, 0.025);
    this.music?.gain.setTargetAtTime(mixer.music, ctx.currentTime, 0.04);
    this.sfx?.gain.setTargetAtTime(mixer.sfx, ctx.currentTime, 0.04);
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.setMixer(this.mixer);
    if (hidden) void this.ctx?.suspend().catch(() => {});
    else if (this.ctx) void this.ctx.resume().catch(() => {});
  }
  /** FLT-55: the mods' cues (new names, or the base's replaced). They play through the same sfx bus, mute and volume. */
  setCues(cues: Readonly<Record<string, readonly Note[]>>) { this.overrides = cues; }
  has(cue: string) { return notesFor(cue, this.overrides) !== null; }
  notes(cue: string, variation = 0) { return notesFor(cue, this.overrides, variation); }
  cue(cue: string) {
    const ctx = this.ctx;
    if (!ctx || !this.sfx || ctx.state !== "running" || this.hidden || this.mixer.muted) return;
    const last = this.lastCue.get(cue) ?? -10;
    // Painting paths or a packed gateway must not make hundreds of simultaneous voices.
    if (ctx.currentTime - last < (cue === "coin" ? 0.18 : 0.065)) return;
    const notes = notesFor(cue, this.overrides, this.variation);
    if (!notes) return;
    this.lastCue.set(cue, ctx.currentTime);
    this.variation++;
    for (const n of notes) voice(ctx, this.sfx, n, ctx.currentTime + 0.005, this.noise ?? noiseBuffer(ctx));
  }
  update(beds: Beds) {
    this.beds = beds;
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.sfx || !this.noise || ctx.state !== "running") return;
    const now = ctx.currentTime;
    this.crowd?.gain.setTargetAtTime(clamp(beds.crowd) * 0.18, now, 0.25);
    this.training?.gain.setTargetAtTime(beds.training === null ? 0 : 0.028, now, 0.2);
    this.hum?.frequency.setTargetAtTime(80 + clamp(beds.training ?? 0) * 220, now, 0.2);
    if (this.mixer.muted || this.hidden) { this.nextBeat = now; this.nextBed = now; return; }
    const score = eraScore(beds.era);
    const beatLength = 60 / score.bpm;
    if (this.nextBeat < now - 0.25) this.nextBeat = now; // No catch-up burst after a background tab.
    while (this.nextBeat < now + 0.22) {
      const chord = CHORDS[Math.floor(this.beat / 4) % 4]!;
      const root = score.root;
      if (this.beat % 4 === 0) {
        for (const n of chord) voice(ctx, this.music, { at: 0, hz: midi(root + n), duration: beatLength * 3.8, gain: 0.045, wave: "triangle" }, this.nextBeat, this.noise);
      }
      const step = chord[this.beat % 3]!;
      voice(ctx, this.music, { at: 0, hz: midi(root + step + 12), duration: beatLength * 0.6, gain: 0.03, wave: "square" }, this.nextBeat, this.noise);
      this.nextBeat += beatLength; this.beat++;
    }
    if (now >= this.nextBed) {
      this.nextBed = now + 0.7;
      if (beds.protesters > 10) {
        // Three syllables and a foot-stomp (score.ts `protest.chant`, or a mod's); no recorded speech.
        for (const n of notesFor("protest.chant", this.overrides) ?? []) voice(ctx, this.sfx, n, now + 0.01, this.noise);
      }
      if (beds.night > 0.1) for (let i = 0; i < 3; i++) voice(ctx, this.sfx, { at: i * 0.055, hz: 4200 + i * 120, duration: 0.035, gain: beds.night * 0.014, wave: "sine" }, now + 0.01, this.noise);
      // Short pitched noise syllables make the crowd more than a static hiss.
      if (beds.crowd > 0.02) voice(ctx, this.sfx, { at: 0, hz: 350 + (this.beat % 3) * 120, duration: 0.22, gain: clamp(beds.crowd) * 0.06, wave: "noise" }, now + 0.01, this.noise);
    }
  }
  get diagnostics() { return { status: this.status, mixer: this.mixer, beds: this.beds, beat: this.beat, cues: Object.fromEntries(this.lastCue), humHz: this.hum?.frequency.value, crowdGain: this.crowd?.gain.value, masterGain: this.master?.gain.value }; }
  dispose() {
    this.disposed = true;
    this.continuous.forEach((s) => { s.stop(); s.disconnect(); });
    this.continuous = [];
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

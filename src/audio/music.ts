// FLT-66: the music follows the game speed. A dog's day, in four moods: paused is a nap, 1× is walkies (the
// first pass's music, note for note), 3× is fetch, top speed is zoomies (996-style hyperpop: a chipmunk choir
// sings "ship it", the drums glitch, the chords pump and the inbox pings). Pure data and arithmetic: the
// conductor plans bars and fades, `Band` turns them into WebAudio voices, and the tests read them directly.
import { CHORDS, eraScore, midi, type Note } from "./score";

export const MODES = ["nap", "walkies", "fetch", "zoomies"] as const;
export type Mode = (typeof MODES)[number];
const ENERGY: Record<Mode, number> = { nap: 0, walkies: 1, fetch: 2, zoomies: 3 };

/** Paused (by the player, a card or a menu) naps; 1× walks; anything faster fetches; the top speed has the zoomies. */
export function modeFor(speed: number, paused: boolean, top = 10): Mode {
  if (paused || speed <= 0) return "nap";
  if (speed >= top) return "zoomies";
  return speed > 1 ? "fetch" : "walkies";
}

export type Vowel = "a" | "e" | "i" | "o" | "u";
/** A note with the extras music needs: a slow attack (the sidechain swell), detune, a noise filter, a sung vowel. */
export interface Tone extends Note {
  attack?: number;
  detune?: number;
  filter?: BiquadFilterType;
  q?: number;
  vowel?: Vowel;
}
/** Formants (Hz) of a voice that has inhaled helium: real F1/F2 scaled up, so the chops sound pitched-up, not just high. */
export const FORMANTS: Record<Vowel, readonly [number, number]> = { a: [1080, 1620], e: [540, 2700], i: [400, 3100], o: [610, 1080], u: [440, 950] };

// ---- Flavours: each skin keeps its own instruments. ----

export const FLAVOURS = ["classic", "midi", "disco", "folk"] as const;
export type Flavour = (typeof FLAVOURS)[number];
export interface Palette { pad: OscillatorType; lead: OscillatorType; bass: OscillatorType; saw: OscillatorType; chop: OscillatorType; detune: number; ping: "ping" | "ding" | "chime"; drums: number }
export const PALETTES: Record<Flavour, Palette> = {
  // The first pass: triangle chords and a square arpeggio. Zoomies gets detuned saws.
  classic: { pad: "triangle", lead: "square", bass: "triangle", saw: "sawtooth", chop: "sawtooth", detune: 14, ping: "ping", drums: 1 },
  // A General MIDI card from 1995: everything is a pulse wave, nothing is detuned, and the inbox goes *ding*.
  midi: { pad: "square", lead: "square", bass: "square", saw: "square", chop: "square", detune: 0, ping: "ding", drums: 0.75 },
  // Karaoke night: saws everywhere, a wide chorus, a bright kit.
  disco: { pad: "sawtooth", lead: "sawtooth", bass: "sawtooth", saw: "sawtooth", chop: "sawtooth", detune: 22, ping: "ping", drums: 1.2 },
  // The field guide: soft sines and a kalimba for the inbox.
  folk: { pad: "sine", lead: "triangle", bass: "sine", saw: "triangle", chop: "triangle", detune: 6, ping: "chime", drums: 0.6 },
};
const SKIN_FLAVOURS: Readonly<Record<string, Flavour>> = { "frontier-95": "midi", "homepage-98": "midi", "discovery-disc-96": "midi", "karaoke-night": "disco", "field-almanac": "folk" };
/** A skin's flavour of music; a mod's skin, or one nobody has scored, plays the classic band. */
export const flavourFor = (skin: string): Flavour => SKIN_FLAVOURS[skin] ?? "classic";

/** How loud a wave sounds next to a triangle, so a flavour that swaps instruments keeps the mix where it was. */
const LOUDNESS: Record<OscillatorType, number> = { sine: 0.8, triangle: 1, square: 1.7, sawtooth: 1.6, custom: 1 };
const level = (wave: OscillatorType, base: OscillatorType) => LOUDNESS[base] / LOUDNESS[wave];

// ---- Meters ----

export interface Meter { bpm: number; beats: number }
/** Tempo and bar length per mode. The era moves walkies and fetch (as the first pass did); a nap and the zoomies don't care. */
export function meter(mode: Mode, era: string): Meter {
  const { bpm } = eraScore(era);
  switch (mode) {
    case "nap": return { bpm: 60, beats: 2 };
    case "walkies": return { bpm, beats: 4 };
    case "fetch": return { bpm: Math.round(bpm * 1.3), beats: 4 };
    case "zoomies": return { bpm: 168, beats: 4 };
  }
}
export const barLength = (m: Meter) => (60 / m.bpm) * m.beats;

// ---- Bars ----

export interface BarSpec { mode: Mode; flavour: Flavour; era: string; bar: number }
const chordOf = (bar: number) => CHORDS[bar % CHORDS.length]!;
const tone = (at: number, hz: number, duration: number, gain: number, wave: Tone["wave"], extra: Partial<Tone> = {}): Tone => ({ at, hz, duration, gain, wave, ...extra });

// Drums are plain tones too: a kick is a sine that dives, a snare and hats are filtered noise.
const kick = (at: number, gain = 0.3): Tone => tone(at, 150, 0.22, gain, "sine", { endHz: 42 });
const snare = (at: number, p: Palette, gain = 0.09): Tone[] => [tone(at, 2200 * p.drums, 0.11, gain, "noise", { filter: "bandpass", q: 0.9, endHz: 1500 * p.drums }), tone(at, 230, 0.07, gain * 0.8, "triangle", { endHz: 170 })];
const hat = (at: number, p: Palette, gain = 0.03, duration = 0.035): Tone => tone(at, 7600 * p.drums, duration, gain, "noise", { filter: "highpass", q: 0.7 });

/** A syllable for the chipmunk choir: an optional consonant onset, a vowel, an optional consonant coda. */
interface Syllable { step: number; len: number; deg: number; vowel: Vowel; onset?: "sh" | "p" | "k"; coda?: "t" }
// Bar A: "ship it, ship it, ship-ship-ship it". Bar B: "o-kay! o-kay! ay-ay-ay-ay" (agreeable, as one is at 2 a.m.).
const HOOK_A: Syllable[] = [
  { step: 0, len: 2, deg: 3, vowel: "i", onset: "sh" }, { step: 2, len: 2, deg: 2, vowel: "i", onset: "p", coda: "t" },
  { step: 6, len: 2, deg: 3, vowel: "i", onset: "sh" }, { step: 8, len: 2, deg: 2, vowel: "i", onset: "p", coda: "t" },
  { step: 11, len: 1, deg: 2, vowel: "i", onset: "sh" }, { step: 12, len: 1, deg: 3, vowel: "i", onset: "sh" }, { step: 13, len: 1, deg: 4, vowel: "i", onset: "sh" },
  { step: 14, len: 2, deg: 5, vowel: "i", onset: "p", coda: "t" },
];
const HOOK_B: Syllable[] = [
  { step: 0, len: 1, deg: 2, vowel: "o" }, { step: 1, len: 3, deg: 4, vowel: "e", onset: "k" },
  { step: 4, len: 1, deg: 2, vowel: "o" }, { step: 5, len: 3, deg: 3, vowel: "e", onset: "k" },
  ...[12, 13, 14, 15].map((step, i): Syllable => ({ step, len: 1, deg: 1 + i, vowel: "a" })),
];
function sing(s: Syllable, step: number, chord: readonly number[], root: number, p: Palette): Tone[] {
  const tones = [...chord, ...chord.map((n) => n + 12)];
  const hz = midi(root + 24 + tones[s.deg % tones.length]!);
  const at = s.step * step;
  const duration = s.len * step * 0.9;
  const out: Tone[] = [];
  if (s.onset === "sh") out.push(tone(at, 3200, 0.055, 0.07, "noise", { filter: "highpass", q: 0.8 }));
  if (s.onset === "p") out.push(tone(at, 700, 0.018, 0.08, "noise", { filter: "lowpass" }));
  if (s.onset === "k") out.push(tone(at, 2600, 0.022, 0.06, "noise", { filter: "bandpass", q: 1.5 }));
  const vowelAt = at + (s.onset ? 0.03 : 0);
  // A pitch-corrected scoop up into the note: the hyperpop hiccup.
  out.push(tone(vowelAt, hz * 0.94, Math.max(0.05, duration - (vowelAt - at)), 0.16 * level(p.chop, "sawtooth"), p.chop, { endHz: hz, vowel: s.vowel }));
  if (s.coda === "t") out.push(tone(at + duration, 5200, 0.02, 0.05, "noise", { filter: "highpass" }));
  return out;
}
/** The inbox. Classic pings, Frontier 95 dings a little chord, the field guide plucks a kalimba. */
function ping(at: number, chord: readonly number[], root: number, p: Palette, gain = 0.05): Tone[] {
  const top = root + 36;
  if (p.ping === "ding") return [0, 1, 2].map((i) => tone(at + i * 0.045, midi(top + chord[i]!), 0.35, gain * 0.8, "triangle"));
  if (p.ping === "chime") return [tone(at, midi(top + chord[2]!), 0.4, gain, "sine"), tone(at, midi(top + chord[2]!) * 2.76, 0.12, gain * 0.35, "sine")];
  return [tone(at, midi(top + chord[1]!), 0.16, gain, "sine"), tone(at + 0.075, midi(top + chord[2]! + 5), 0.3, gain * 0.9, "sine")];
}

/** Every tone of one bar, `at` in seconds from the bar line. Deterministic: the same bar always sounds the same. */
export function barTones({ mode, flavour, era, bar }: BarSpec): Tone[] {
  const p = PALETTES[flavour];
  const m = meter(mode, era);
  const beat = 60 / m.bpm;
  const step = beat / 4;
  const { root } = eraScore(era);
  const chord = chordOf(bar);
  const out: Tone[] = [];
  switch (mode) {
    case "nap": {
      // A held pad that breathes in, and now and then one soft bell.
      for (const n of chord) out.push(tone(0, midi(root + n), beat * 2.4, 0.032 * level(p.pad === "square" ? "triangle" : "sine", "sine"), p.pad === "square" ? "triangle" : "sine", { attack: beat * 0.9 }));
      if (bar % 2 === 1) out.push(tone(beat, midi(root + 24 + chord[bar % 3]!), 1.6, 0.012, "sine"));
      break;
    }
    case "walkies": {
      // The first pass, exactly: a chord on the bar, an arpeggio on every beat.
      for (const n of chord) out.push(tone(0, midi(root + n), beat * 3.8, 0.045 * level(p.pad, "triangle"), p.pad));
      for (let i = 0; i < 4; i++) out.push(tone(i * beat, midi(root + chord[(bar * 4 + i) % 3]! + 12), beat * 0.6, 0.03 * level(p.lead, "square"), p.lead));
      break;
    }
    case "fetch": {
      // Same tune, now jogging: an eighth-note arpeggio, a bass, a soft kick, claps and hats.
      for (const n of chord) out.push(tone(0, midi(root + n), beat * 3.8, 0.034 * level(p.pad, "triangle"), p.pad));
      for (let i = 0; i < 8; i++) out.push(tone(i * step * 2, midi(root + chord[(bar * 8 + i) % 3]! + (i % 4 === 3 ? 24 : 12)), step * 1.4, 0.024 * level(p.lead, "square"), p.lead));
      for (let i = 0; i < 8; i++) out.push(tone(i * step * 2, midi(root - 12 + chord[0]!), step * 1.6, (i % 2 ? 0.05 : 0.075) * level(p.bass, "triangle"), p.bass));
      out.push(kick(0, 0.22), kick(beat * 2, 0.22));
      out.push(...snare(beat, p, 0.05), ...snare(beat * 3, p, 0.05));
      for (let i = 0; i < 16; i++) out.push(hat(i * step, p, i % 2 ? 0.026 : 0.011));
      break;
    }
    case "zoomies": {
      const glitch = bar % 4 === 3;
      // Four on the floor, except where the drummer's laptop crashes into a stutter.
      for (let b = 0; b < (glitch ? 3 : 4); b++) out.push(kick(b * beat, 0.32));
      if (bar % 2 === 1) out.push(kick(beat * 3.5, 0.2));
      out.push(...snare(beat, p), ...(glitch ? [] : snare(beat * 3, p)));
      if (glitch) for (let i = 0; i < 8; i++) out.push(...snare(beat * 3 + i * step / 2, p, 0.035 + i * 0.008).map((t) => ({ ...t, hz: t.hz * (1 + i * 0.12), duration: step / 2 })));
      for (let i = 0; i < 16; i++) out.push(hat(i * step, p, i % 4 === 2 ? 0.035 : 0.014, i % 4 === 2 ? 0.06 : 0.03));
      // Sidechain pumping: every beat the chord swells back in after the kick ducks it.
      for (let b = 0; b < 4; b++) for (const n of chord) for (const d of p.detune ? [-p.detune, p.detune] : [0]) {
        out.push(tone(b * beat + 0.012, midi(root + 12 + n), beat * 0.96, 0.02 * level(p.saw, "sawtooth"), p.saw, { attack: beat * 0.62, detune: d }));
      }
      // An off-beat bass that pumps by being off the beat.
      for (let b = 0; b < 4; b++) out.push(tone(b * beat + step * 2, midi(root - 12 + chord[0]!), step * 1.8, 0.07 * level(p.bass, "triangle"), p.bass, { attack: 0.01 }));
      for (const s of bar % 2 ? HOOK_B : HOOK_A) out.push(...sing(s, step, chord, root, p));
      // The inbox: a ping on the and-of-four every other bar, and a cascade every eighth bar.
      if (bar % 8 === 7) for (const [i, at] of [7, 9, 11, 12, 13, 14].entries()) out.push(...ping(at * step, chord, root + i, p, 0.03 + i * 0.004));
      else if (bar % 2 === 1) out.push(...ping(step * 14, chord, root, p));
      // A bit-crushed blip: the sound of a stack trace scrolling past.
      if (bar % 4 === 1) out.push(tone(step * 15, 3000, step, 0.025, "square", { endHz: 180 }));
      break;
    }
  }
  return out;
}

// ---- The conductor: bar-synced switching ----

/** What the band should play: the mode the speed asks for, the skin's flavour and the era's key. */
export interface Want { mode: Mode; flavour: Flavour; era: string }
/** The bar that is next to be planned, and when it starts. */
export interface Lane extends Want { bar: number; start: number }
export interface Conductor { want: Want; lane: Lane | null; announced: number }
export interface Fade { bus: Mode; at: number; from: number; to: number; over: number }
/** A tone at an absolute time on a mode's bus, or on the shared fx bus (risers and the drop's crash). */
export interface Cue { bus: Mode | "fx"; tone: Tone }
export interface Plan { conductor: Conductor; cues: Cue[]; fades: Fade[] }

export const conduct = (want: Want): Conductor => ({ want, lane: null, announced: -1 });

/**
 * How one mode hands over to the next at the bar line. Up: the incoming band is in within half a beat (a riser has
 * already announced it). Down: a slower, longer crossfade. Into a nap: the tape stops. The outgoing fade always ends
 * inside the incoming band's first bar, so two transitions never overlap.
 */
export function transition(from: Mode, to: Mode, era: string): { fadeIn: number; fadeOut: number; tape: boolean; riser: boolean } {
  const bar = barLength(meter(to, era));
  const beat = 60 / meter(to, era).bpm;
  if (to === "nap") return { fadeIn: bar * 0.75, fadeOut: Math.min(1.6, bar), tape: true, riser: false };
  if (ENERGY[to] > ENERGY[from]) return { fadeIn: beat * 0.5, fadeOut: Math.min(bar * 0.5, beat * 2), tape: false, riser: true };
  return { fadeIn: bar * 0.5, fadeOut: bar * 0.75, tape: false, riser: false };
}

/**
 * The tape stop: the outgoing bar plays on while the tape slows from full speed by `k` over `over` seconds, so a
 * tone at bar position `x` lands later and lower. Returns null for a tone the tape never reaches.
 */
export function tapeStop(t: Tone, over: number, k = 0.75): Tone | null {
  const a = k / (2 * over);
  const disc = 1 - 4 * a * t.at;
  if (disc < 0) return null;
  const at = (1 - Math.sqrt(disc)) / (2 * a);
  const rate = 1 - (k * at) / over;
  if (at >= over || rate <= 0.2) return null;
  return { ...t, at, hz: t.hz * rate, endHz: (t.endHz ?? t.hz) * rate * 0.85, duration: Math.min(t.duration / rate, over - at + 0.05) };
}

/** Plan every bar that starts before `now + horizon`. Pure: the same conductor and times always give the same plan. */
export function plan(c: Conductor, now: number, horizon: number): Plan {
  const cues: Cue[] = [];
  const fades: Fade[] = [];
  let { lane, announced } = c;
  const { want } = c;
  // First bar, or back from a mute or a hidden tab: start the wanted band now, without a catch-up burst.
  if (!lane || lane.start < now - 0.25) {
    const bar = lane?.bar ?? 0;
    lane = { ...want, bar, start: now };
    for (const bus of MODES) fades.push(bus === want.mode ? { bus, at: now, from: 0, to: 1, over: 0.3 } : { bus, at: now, from: 0, to: 0, over: 0 });
  }
  while (lane.start < now + horizon) {
    if (want.mode !== lane.mode) {
      const t = transition(lane.mode, want.mode, want.era);
      for (const tone of barTones(lane)) {
        const played = t.tape ? tapeStop(tone, t.fadeOut) : tone.at < t.fadeOut ? tone : null;
        if (played) cues.push({ bus: lane.mode, tone: { ...played, at: lane.start + played.at } });
      }
      fades.push({ bus: lane.mode, at: lane.start, from: 1, to: 0, over: t.fadeOut }, { bus: want.mode, at: lane.start, from: 0, to: 1, over: t.fadeIn });
      if (want.mode === "zoomies") cues.push({ bus: "fx", tone: tone(lane.start, 6400, 1.2, 0.08, "noise", { filter: "highpass", q: 0.5, endHz: 3000 }) });
    }
    lane = { ...want, bar: lane.bar, start: lane.start };
    for (const t of barTones(lane)) cues.push({ bus: lane.mode, tone: { ...t, at: lane.start + t.at } });
    lane = { ...lane, bar: lane.bar + 1, start: lane.start + barLength(meter(lane.mode, lane.era)) };
  }
  // A switch up is coming at the next bar line: a noise riser fills the wait, so the press is heard at once.
  if (want.mode !== lane.mode && announced !== lane.start && transition(lane.mode, want.mode, want.era).riser) {
    const length = Math.min(lane.start - now, (60 / meter(lane.mode, lane.era).bpm) * 2);
    cues.push({ bus: "fx", tone: tone(lane.start - length, 500, length, 0.06 + ENERGY[want.mode] * 0.015, "noise", { filter: "bandpass", q: 2, endHz: 7000, attack: length * 0.9 }) });
    announced = lane.start;
  }
  return { conductor: { want, lane, announced }, cues, fades };
}

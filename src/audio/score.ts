// Synth recipes are inspectable and shared by realtime playback and offline cue verification.
export const CUES = ["place", "coin", "bulldoze", "card", "choice", "release", "era", "breakdown", "conga", "drumroll", "shutter"] as const;
export type Cue = (typeof CUES)[number];
export interface Note { at: number; hz: number; endHz?: number; duration: number; gain: number; wave: OscillatorType | "noise" }
export const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
export function cueNotes(cue: Cue, variation = 0): Note[] {
  const note = (hz: number, duration: number, wave: Note["wave"], gain = 0.2, at = 0, endHz?: number): Note => ({ at, hz, duration, wave, gain, endHz });
  switch (cue) {
    case "place": return [note(180, 0.16, "sine", 0.42, 0, 55), note(650, 0.07, "noise", 0.12)];
    case "coin": return [note(midi(84 + (variation % 5) * 2), 0.18, "sine", 0.18), note(midi(96 + (variation % 5) * 2), 0.12, "triangle", 0.1, 0.025)];
    case "bulldoze": return [note(850, 0.32, "noise", 0.35, 0, 80), note(80, 0.25, "triangle", 0.2, 0, 25)];
    case "card": return [note(250, 0.11, "noise", 0.24), note(120, 0.12, "sine", 0.38, 0, 45)];
    case "choice": return [note(680, 0.065, "triangle", 0.15, 0, 1000)];
    case "release": return [60, 64, 67, 72, 76].map((n, i) => note(midi(n), 0.38, "triangle", 0.16, i * 0.12));
    case "era": return [48, 55, 60, 64, 67, 72].map((n, i) => note(midi(n), 0.65, "triangle", 0.13, i * 0.09));
    case "breakdown": return [0, 0.22, 0.44].map((at) => note(740, 0.16, "square", 0.075, at, 440));
    // FLT-56's beats. The walk-out: one-two-three-KICK on hand drums, twice.
    case "conga": return [0, 0.18, 0.36, 0.6, 0.96, 1.14, 1.32, 1.56].map((at, i) => note(i % 4 === 3 ? 150 : 220, 0.14, "sine", i % 4 === 3 ? 0.4 : 0.26, at, i % 4 === 3 ? 90 : 170));
    // The auditors confer: a snare roll that swells, and the cymbal.
    case "drumroll": return [...Array.from({ length: 26 }, (_, i) => note(1400, 0.05, "noise", 0.05 + i * 0.008, i * 0.06)), note(5200, 0.4, "noise", 0.2, 1.58, 3000)];
    // The hearing clip goes viral: a wall of camera shutters.
    case "shutter": return [0, 0.09, 0.15, 0.31, 0.38, 0.52, 0.6, 0.66, 0.84].map((at, i) => note(2600 + (i % 3) * 500, 0.05, "noise", 0.16, at, 900));
  }
}
export function eraScore(era: string): { root: number; bpm: number } {
  // Works with both named eras and future content ids, no dependency on a shared sim type.
  let hash = 0;
  for (const c of era) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return { root: [48, 50, 53, 55][hash % 4]!, bpm: 76 + (hash % 5) * 8 };
}
export const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] as const;

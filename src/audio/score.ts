// Synth recipes are inspectable and shared by realtime playback and offline cue verification.
export const CUES = ["place", "coin", "bulldoze", "card", "choice", "release", "era", "breakdown"] as const;
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
  }
}
/**
 * Named moments a mod can give a sound through the Audio service (FLT-55). The base game plays the chant (three
 * syllables and a foot-stomp, every 0.7 s while more than ten protesters stand at the gate); the others are silent
 * until a mod sets them: `protest.grow` when the crowd at the gate grows, `ui.click` on a HUD button.
 */
export const HOOKS = ["protest.chant", "protest.grow", "ui.click"] as const;
export type Hook = (typeof HOOKS)[number];
export function hookNotes(hook: Hook): Note[] {
  if (hook !== "protest.chant") return [];
  return [...[0, 1, 2].map((i): Note => ({ at: i * 0.16, hz: i === 1 ? 185 : 150, endHz: 120, duration: 0.12, gain: 0.045, wave: "sawtooth" })),
    { at: 0.5, hz: 80, endHz: 40, duration: 0.14, gain: 0.09, wave: "sine" }];
}
export function eraScore(era: string): { root: number; bpm: number } {
  // Works with both named eras and future content ids, no dependency on a shared sim type.
  let hash = 0;
  for (const c of era) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return { root: [48, 50, 53, 55][hash % 4]!, bpm: 76 + (hash % 5) * 8 };
}
export const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] as const;

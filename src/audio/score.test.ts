import { expect, it } from "vitest";
import { CUES, cueNotes, eraScore } from "./score";
import { DEFAULT_MIXER, readMixer } from "./SoundKit";
it("every cue has finite, bounded synth envelopes; coin pitches vary", () => {
  for (const cue of CUES) {
    expect(cueNotes(cue).length).toBeGreaterThan(0);
    for (const n of cueNotes(cue)) {
      expect(n.hz).toBeGreaterThan(0);
      expect(n.duration).toBeGreaterThan(0.02);
      expect(n.gain).toBeGreaterThan(0);
      expect(n.gain).toBeLessThan(0.5);
      expect(n.at + n.duration).toBeLessThan(2);
    }
  }
  expect(new Set(Array.from({ length: 5 }, (_, i) => cueNotes("coin", i)[0]?.hz)).size).toBe(5);
});
it("era music is stable but changes key or tempo; corrupt mixer data recovers", () => {
  expect(eraScore("seed")).toEqual(eraScore("seed"));
  expect(eraScore("seed")).not.toEqual(eraScore("takeoff"));
  expect(readMixer("garbage")).toEqual(DEFAULT_MIXER);
  expect(readMixer('{"master":9,"music":-4,"sfx":"loud","muted":true}')).toEqual({ master: 1, music: 0, sfx: DEFAULT_MIXER.sfx, muted: true });
});

it("gives a mod's cue first, then the base cue or hook, and silence for a name nobody defined (FLT-55)", async () => {
  const { notesFor } = await import("./SoundKit");
  const { hookNotes } = await import("./score");
  const bark = [{ at: 0, hz: 600, endHz: 300, duration: 0.12, gain: 0.3, wave: "square" as const }];
  expect(notesFor("gr.bark", { "gr.bark": bark })).toBe(bark);
  expect(notesFor("coin", { coin: bark })).toBe(bark);
  expect(notesFor("coin", {}, 3)).toEqual(cueNotes("coin", 3));
  expect(notesFor("protest.grow", {})).toEqual([]);
  expect(notesFor("gr.bark", {})).toBeNull();
  // The base chant is the one SoundKit always played: three syllables and a stomp.
  expect(hookNotes("protest.chant").map((n) => [n.at, n.hz, n.wave])).toEqual([[0, 150, "sawtooth"], [0.16, 185, "sawtooth"], [0.32, 150, "sawtooth"], [0.5, 80, "sine"]]);
});

import { expect, it } from "vitest";
import { CUES, cueNotes, eraScore } from "./score";
import { DEFAULT_MIXER, readMixer } from "./SoundKit";
it("all eight cues have finite, bounded synth envelopes; coin pitches vary", () => {
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

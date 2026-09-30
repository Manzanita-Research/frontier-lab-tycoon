import { createInitialState } from "../sim/state";
import { soundCues, soundSnapshot, worldEra } from "./world";
import { CUES, eraScore } from "./score";

describe("what the sound layer hears in the World", () => {
  it("reads the era from the era machine (FLT-9), not a placeholder", () => {
    const s = createInitialState(1);
    expect(worldEra(s)).toBe("1");
    s.race.era = { value: "era3", context: s.race.era.context };
    expect(worldEra(s)).toBe("3");
  });

  it("plays the era sting when the era moves on, and the key of the music changes with it", () => {
    const s = createInitialState(1);
    const before = soundSnapshot(s);
    s.race.era = { value: "era2", context: s.race.era.context };
    expect(soundCues(before, soundSnapshot(s))).toEqual(["era"]);
    expect(CUES).toContain("era");
    expect(eraScore(worldEra(s))).not.toEqual(eraScore("1"));
  });

  it("plays the breakdown alarm when a building breaks, once, and not when it is fixed", () => {
    const s = createInitialState(1);
    const calm = soundSnapshot(s);
    s.buildings[0]!.broken = true;
    const burning = soundSnapshot(s);
    expect(soundCues(calm, burning)).toEqual(["breakdown"]);
    expect(soundCues(burning, soundSnapshot(s))).toEqual([]);
    // A second one is a new alarm; a repair is silent.
    s.buildings[1]!.broken = true;
    expect(soundCues(burning, soundSnapshot(s))).toEqual(["breakdown"]);
    s.buildings[0]!.broken = false;
    s.buildings[1]!.broken = false;
    expect(soundCues(soundSnapshot(s), soundSnapshot(s))).toEqual([]);
    expect(CUES).toContain("breakdown");
  });
});

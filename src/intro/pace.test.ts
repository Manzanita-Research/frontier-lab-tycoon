import { describe, expect, it } from "vitest";
import { BOX_TIMES, DURATIONS, ease } from "./stage/rig";

// FLT-70's timings, before Jem's "I haven't even seen the back of it."
const FLT70 = { pulling: 1.8, unwrapping: 2.1, disc: 2.2 };

describe("FLT-95: the box takes its time", () => {
  it("runs the pull, the unwrap and the disc at 1.5 to 2 times FLT-70's timings", () => {
    for (const [beat, was] of Object.entries(FLT70)) {
      expect(DURATIONS[beat]! / was, beat).toBeGreaterThanOrEqual(1.5);
      expect(DURATIONS[beat]! / was, beat).toBeLessThanOrEqual(2);
    }
  });

  it("has no timer on the box in your hands, the flat lay or a held item: those wait for the player", () => {
    for (const beat of ["shelf", "held", "open", "focus"]) expect(DURATIONS[beat], beat).toBeUndefined();
  });

  it("keeps the unwrap's steps in order and inside the beat", () => {
    const steps = [BOX_TIMES.wrapTear, BOX_TIMES.lidOff, BOX_TIMES.itemsOut, BOX_TIMES.lidDown];
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(BOX_TIMES.itemsOut + 7 * BOX_TIMES.itemGap).toBeLessThan(DURATIONS.unwrapping!);
    expect(BOX_TIMES.disc[2]).toBeLessThan(DURATIONS.disc!);
    expect(BOX_TIMES.pullOut).toBeLessThan(DURATIONS.pulling!);
  });

  it("eases every move in: a crawl at the start, full speed once it's going", () => {
    expect(ease(0)).toBeLessThan(0.1);
    expect(ease(0.3)).toBeGreaterThan(ease(0.1));
    expect(ease(10)).toBe(1);
    expect(ease(-1)).toBe(ease(0));
  });
});

// The news tape's placement rules (FLT-31): a fresh headline joins just past the right edge, ahead of old filler.
import { describe, expect, it } from "vitest";
import { catchUp, makeRoom, MAX_QUEUED, type TapeItem } from "./Marquee";

const tape = (...spec: [number, "old" | "fresh"][]): TapeItem[] => spec.map(([left, kind]) => ({ left, replay: kind === "old" }));

describe("makeRoom", () => {
  it("leaves a tape alone when everything on it is still on screen", () => {
    expect(makeRoom(tape([0, "old"], [300, "old"], [700, "old"]), 0, 1000)).toEqual([]);
  });

  it("drops the replayed filler beyond the right edge so the new headline goes right after what is showing", () => {
    // Viewport 1000 wide; the first three items are on screen, the rest are filler waiting off to the right.
    const items = tape([0, "old"], [400, "old"], [900, "old"], [1300, "old"], [1700, "old"], [2100, "old"]);
    expect(makeRoom(items, 0, 1000)).toEqual([3, 4, 5]);
  });

  it("counts from the scroll offset, not from zero", () => {
    const items = tape([0, "old"], [400, "old"], [900, "old"], [1300, "old"], [1700, "old"]);
    // Scrolled 500 px: the window is 500..1500, so the item at 1700 is the first one out of sight.
    expect(makeRoom(items, 500, 1000)).toEqual([4]);
  });

  it("keeps headlines that arrived earlier and have not been shown yet, in order", () => {
    const items = tape([0, "old"], [900, "old"], [1300, "fresh"], [1700, "old"], [2100, "old"]);
    expect(makeRoom(items, 0, 1000)).toEqual([3, 4]);
  });

  it(`in a rush keeps only the newest ${MAX_QUEUED} unshown headlines, so the tape never falls minutes behind`, () => {
    const items = tape([0, "old"], [900, "old"], [1300, "fresh"], [1700, "fresh"], [2100, "fresh"], [2500, "fresh"]);
    // Four are waiting and one more is arriving: two of the oldest go.
    expect(makeRoom(items, 0, 1000, 1)).toEqual([2, 3, 4].slice(0, 2));
    expect(makeRoom(items, 0, 1000, 2)).toEqual([2, 3, 4]);
  });
});

describe("catchUp", () => {
  it("runs at full speed with nothing waiting, and up to twice as fast in a burst", () => {
    expect(catchUp(0)).toBe(1);
    expect(catchUp(1)).toBeCloseTo(1.4);
    expect(catchUp(10)).toBe(2);
  });
});

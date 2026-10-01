// The news tape's placement rules (FLT-31): a fresh headline joins just past the right edge, ahead of old filler.
import { describe, expect, it } from "vitest";
import { catchUp, makeRoom, MAX_QUEUED, Tape, type TapeItem } from "./Marquee";

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

describe("Tape (FLT-82: a new lab's ticker still read the old lab's news)", () => {
  const item = (id: number, text: string) => ({ id, text, tone: "neutral" as const });
  const oldLab = [item(40_101, "Old Lab offers a Stochastic Parrots Anonymous researcher $100M"), item(40_150, "Old Lab ships Frontier-9")];

  it("takes a lab's headlines as they come, each once", () => {
    const t = new Tape();
    expect(t.take(oldLab)).toEqual({ reset: false, fresh: oldLab });
    const next = [...oldLab, item(40_200, "Old Lab ships Frontier-10")];
    expect(t.take(next)).toEqual({ reset: false, fresh: [next[2]] });
    expect(t.take(next).fresh).toEqual([]);
  });

  it("starts over on another lab's news: its headlines are fresh, and the old lab's are no longer replayed", () => {
    const t = new Tape();
    t.take(oldLab);
    // A new lab's ids restart far below the old lab's last one.
    const newLab = [item(312, "New Lab opens its garage; the garage is unimpressed")];
    expect(t.take(newLab)).toEqual({ reset: true, fresh: newLab });
    expect(t.history).toEqual(newLab);
  });

  it("starts over when another lab reuses an id for a different headline, or has no news yet", () => {
    const reused = new Tape();
    reused.take(oldLab);
    expect(reused.take([item(40_101, "A different lab's first headline")]).reset).toBe(true);
    const empty = new Tape();
    empty.take(oldLab);
    expect(empty.take([])).toEqual({ reset: true, fresh: [] });
    expect(empty.history).toEqual([]);
  });
});

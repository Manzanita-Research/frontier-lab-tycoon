import { describe, expect, it } from "vitest";
import { CrtGovernor } from "./governor";

const o = { warmup: 2, window: 4 };
function feed(g: CrtGovernor, ms: number, frames: number) {
  for (let i = 0; i < frames; i++) g.frame(ms);
  return g.tier;
}

describe("CrtGovernor", () => {
  it("stays put while the game keeps up", () => {
    const g = new CrtGovernor("multi", o);
    expect(feed(g, 12, 100)).toBe("multi");
    expect(g.settled).toBe(false);
  });

  it("steps down while stepping down helps, then stops at flat", () => {
    const g = new CrtGovernor("multi", o);
    expect(feed(g, 30, 6)).toBe("lite");
    expect(feed(g, 24, 6)).toBe("flat");
    expect(feed(g, 21, 6)).toBe("flat");
    expect(g.settled).toBe(true);
  });

  it("undoes a step that did not help and stops watching", () => {
    const g = new CrtGovernor("multi", o);
    feed(g, 30, 6);
    expect(g.tier).toBe("lite");
    expect(feed(g, 29, 6)).toBe("multi");
    expect(g.settled).toBe(true);
    expect(feed(g, 60, 50)).toBe("multi");
  });

  it("keeps a helpful step once the game keeps up", () => {
    const g = new CrtGovernor("multi", o);
    feed(g, 30, 6);
    expect(feed(g, 14, 30)).toBe("lite");
    expect(g.settled).toBe(false);
  });

  it("ignores hidden-tab frames", () => {
    const g = new CrtGovernor("multi", o);
    expect(feed(g, 1000, 50)).toBe("multi");
    expect(feed(g, 0, 50)).toBe("multi");
  });

  it("has nothing to do on a flat canvas", () => {
    expect(new CrtGovernor("flat", o).settled).toBe(true);
  });
});

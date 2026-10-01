import { describe, expect, it } from "vitest";
import { DISC_LABEL } from "./content";
import { DISC_ZONES, discTurn } from "./stage/disc";

describe("FLT-95: the disc in your hand is a 1997 CD-ROM", () => {
  it("is laid out like a real 120 mm disc: hole, clear hub, silver ring, data, a clear lip at the edge", () => {
    const { hole, hub, ring, data } = DISC_ZONES;
    expect(hole * 120).toBeCloseTo(15, 0);
    expect(hole).toBeLessThan(hub);
    expect(hub).toBeLessThan(ring);
    expect(ring).toBeLessThan(data);
    expect(data).toBeLessThan(1);
    // The data starts at 46 mm across; the label is printed over it.
    expect(ring * 120).toBeCloseTo(46, 0);
  });

  it("turns slowly under the light on its own, never so far that the label stops being readable", () => {
    const still = { x: 0, y: 0 };
    let maxY = 0;
    let maxX = 0;
    for (let t = 0; t < 60; t += 0.05) {
      const turn = discTurn(t, still, false);
      maxY = Math.max(maxY, Math.abs(turn.y));
      maxX = Math.max(maxX, Math.abs(turn.x));
    }
    expect(maxY).toBeGreaterThan(0.3);
    expect(maxY).toBeLessThanOrEqual(0.6);
    expect(maxX).toBeLessThanOrEqual(0.25);
    // Slow: about a fifth of a radian in the first second, not a wobble.
    expect(Math.abs(discTurn(1, still, false).y - discTurn(0, still, false).y)).toBeLessThan(0.35);
  });

  it("follows your drag exactly while you hold it, and keeps within a tilt you could manage with one hand", () => {
    expect(discTurn(7.3, { x: 0.2, y: -0.4 }, true)).toEqual({ x: 0.2, y: -0.4 });
    const far = discTurn(3, { x: 0.6, y: 0.6 }, false);
    expect(Math.abs(far.x)).toBeLessThanOrEqual(0.75);
    expect(Math.abs(far.y)).toBeLessThanOrEqual(0.9);
  });

  it("prints the title, the platform and the warning on the label", () => {
    expect(DISC_LABEL.platform).toBe("CD-ROM for Frontier 95");
    expect(DISC_LABEL.warning).toBe("Do not microwave");
    expect(DISC_LABEL.title.join(" ")).toBe("FRONTIER LAB TYCOON");
  });
});

import { describe, expect, it } from "vitest";
import { PHONE_START, cameraStart } from "./cameraStart";

describe("cameraStart (FLT-87)", () => {
  it("starts a desktop at its base zoom, pulled back to show the lot (FLT-91)", () => {
    const { base, zoom, focus } = cameraStart(1440, 900);
    expect(base).toBeCloseTo(1440 / 34);
    expect(zoom).toBe(base);
    expect(focus).toEqual([11, 12.5]);
    // Further out than FLT-87's 48, but a tile edge still clears the journey's 32 px tap floor.
    expect(zoom).toBeLessThan(48);
    expect(zoom * Math.sqrt(2 / 3)).toBeGreaterThan(32);
  });

  it("starts a phone 1.6x in, keeping the base for the pinch limits", () => {
    const { base, zoom, focus } = cameraStart(390, 844);
    expect(base).toBeCloseTo(390 / 16);
    expect(zoom).toBeCloseTo(base * PHONE_START);
    expect(focus).not.toEqual(cameraStart(1440, 900).focus);
  });

  it("lets ?zoom= and ?focus= win", () => {
    expect(cameraStart(390, 844, { zoom: 30, focus: [1, 2] })).toEqual({ base: 30, zoom: 30, focus: [1, 2] });
  });
});

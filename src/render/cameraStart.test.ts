import { describe, expect, it } from "vitest";
import { PHONE_START, cameraStart } from "./cameraStart";

describe("cameraStart (FLT-87)", () => {
  it("starts a desktop at its base zoom, looking at the gate", () => {
    expect(cameraStart(1440, 900)).toEqual({ base: 48, zoom: 48, focus: [10.8, 16.2] });
  });

  it("starts a phone 1.6x in, keeping the base for the pinch limits", () => {
    const { base, zoom, focus } = cameraStart(390, 844);
    expect(base).toBeCloseTo(390 / 16);
    expect(zoom).toBeCloseTo(base * PHONE_START);
    expect(focus).not.toEqual([10.8, 16.2]);
  });

  it("lets ?zoom= and ?focus= win", () => {
    expect(cameraStart(390, 844, { zoom: 30, focus: [1, 2] })).toEqual({ base: 30, zoom: 30, focus: [1, 2] });
  });
});

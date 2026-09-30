import { describe, expect, it } from "vitest";
import { CRT_LOOKS, inputResolution, screenOptions, unwarp, warp } from "./looks";

describe("CRT looks", () => {
  it("unwarp undoes warp across the glass", () => {
    for (const curve of [CRT_LOOKS.subtle.curve, CRT_LOOKS.full.curve, 0.05]) {
      for (const [x, y] of [[0, 0], [1, 1], [-1, 0.5], [0.3, -0.9], [-0.7, -0.7]] as const) {
        const [sx, sy] = warp(curve, x, y);
        const [dx, dy] = unwarp(curve, sx, sy);
        expect(dx).toBeCloseTo(x, 4);
        expect(dy).toBeCloseTo(y, 4);
      }
    }
  });

  it("keeps the centre and the middle of each edge in place", () => {
    expect(warp(0.03, 0, 0)).toEqual([0, 0]);
    expect(warp(0.03, 1, 0)).toEqual([1, 0]);
    expect(warp(0.03, 0, -1)).toEqual([0, -1]);
    // A corner of the glass shows the scene beyond the corner (the picture is bowed out, so its corners are cut off).
    const [cx, cy] = warp(0.03, 1, 1);
    expect(cx).toBeGreaterThan(1);
    expect(cy).toBeGreaterThan(1);
  });

  it("gives the shader one row per pitch of CSS pixels", () => {
    expect(inputResolution(CRT_LOOKS.subtle, 1440, 900)).toBe(720);
    expect(inputResolution(CRT_LOOKS.full, 1440, 900)).toBe(480);
    expect(inputResolution(CRT_LOOKS.full, 40, 20)).toBe(32);
    expect(screenOptions(CRT_LOOKS.subtle, 1440, 900).tube?.corner).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { FIRST_NIGHT_LINE, NIGHT_THOUGHTS } from "../../content/night";
import { createTestCampus as createInitialState } from "../../sim/testkit";
import { lampSpots } from "./Night";

describe("night", () => {
  it("has the 2am line, short jokes, and no repeats", () => {
    expect(FIRST_NIGHT_LINE.text).toBe("It's 2am. Still shipping.");
    expect(NIGHT_THOUGHTS.map((l) => l.text)).toContain(FIRST_NIGHT_LINE.text);
    expect(new Set(NIGHT_THOUGHTS.map((l) => l.text)).size).toBe(NIGHT_THOUGHTS.length);
    for (const l of NIGHT_THOUGHTS) expect(l.text.length).toBeLessThan(80);
    for (const kind of ["researcher", "agent", "visitor"] as const) expect(NIGHT_THOUGHTS.some((l) => l.kind === kind)).toBe(true);
  });

  it("puts lamps beside the paths, a few tiles apart, never on a building, and follows new paths", () => {
    const w = createInitialState(1);
    const spots = lampSpots(w.grid);
    expect(spots.length).toBeGreaterThan(5);
    expect(spots.length).toBeLessThan(20);
    const pathAt = (x: number, z: number) => w.grid.paths[Math.floor(z) * w.grid.w + Math.floor(x)];
    for (const s of spots) {
      // On a path tile, pushed to its verge.
      expect(pathAt(s.x, s.z)).toBe(true);
      expect(w.buildings.some((b) => s.x >= b.x && s.x < b.x + b.w && s.z >= b.z && s.z < b.z + b.d)).toBe(false);
    }
    for (let i = 0; i < 12; i++) w.grid.paths[3 * w.grid.w + 2 + i] = true;
    expect(lampSpots(w.grid).length).toBeGreaterThan(spots.length);
  });
});

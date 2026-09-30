// FLT-39: `findSpot` skips footprints that cover a path, a building or the gate before it asks `canPlace`. It must still
// pick exactly the spot the plain scan picks, on an empty campus, a busy one and one the Takeover's autopilot has filled.
import type { BuildingKind } from "../../content/buildings";
import { canPlace } from "../commands";
import { defs } from "../defs";
import { busyLab } from "../perf/busyLab";
import { createRng } from "../rng";
import { createTestCampus } from "../testkit";
import type { GameState } from "../types";
import { findSpot } from "./actions";

/** The scan as it was: `canPlace` on every tile. */
function plainSpot(state: GameState, kind: BuildingKind): [number, number] | null {
  const [w, d] = defs().buildings[kind].size;
  let cx = state.grid.w / 2;
  let cz = state.grid.h / 2;
  if (state.buildings.length > 0) {
    cx = state.buildings.reduce((a, b) => a + b.x + b.w / 2, 0) / state.buildings.length;
    cz = state.buildings.reduce((a, b) => a + b.z + b.d / 2, 0) / state.buildings.length;
  }
  let best: [number, number] | null = null;
  let bestDist = Infinity;
  for (let z = 0; z <= state.grid.h - d; z++)
    for (let x = 0; x <= state.grid.w - w; x++) {
      if (!canPlace(state, kind, x, z).ok) continue;
      const dist = Math.hypot(x + w / 2 - cx, z + d / 2 - cz);
      if (dist < bestDist) {
        bestDist = dist;
        best = [x, z];
      }
    }
  return best;
}

function sameSpots(state: GameState): number {
  let found = 0;
  for (const kind of Object.keys(defs().buildings) as BuildingKind[]) {
    const want = plainSpot(state, kind);
    expect(findSpot(state, kind), kind).toEqual(want);
    if (want) found++;
  }
  return found;
}

describe("findSpot (FLT-39)", () => {
  it("picks the plain scan's spot as random paths and buildings go down", () => {
    const s = createTestCampus(3);
    s.cash = 1e12;
    for (const kind of Object.keys(defs().buildings)) s.flags[`unlocked:${kind}`] = 0;
    const rng = createRng(5);
    const kinds = Object.keys(defs().buildings) as BuildingKind[];
    let found = 0;
    for (let round = 0; round < 60; round++) {
      found += sameSpots(s);
      const x = rng.int(0, s.grid.w - 1);
      const z = rng.int(0, s.grid.h - 1);
      if (rng.chance(0.5) && canPlace(s, "path", x, z).ok) s.grid.paths[z * s.grid.w + x] = true;
      else {
        const kind = kinds[rng.int(0, kinds.length - 1)]!;
        const at = findSpot(s, kind);
        if (at) s.buildings.push({ id: s.nextId++, kind, x: at[0], z: at[1], w: defs().buildings[kind].size[0], d: defs().buildings[kind].size[1], placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
      }
    }
    expect(found).toBeGreaterThan(100); // it found spots, not just agreed on none
  });

  it("picks the plain scan's spot while the Takeover's autopilot fills the busy lab", () => {
    const { s, topUp, play } = busyLab(1, "race");
    for (let t = 0; t < 2000; t++) {
      if (t % 200 === 0) {
        topUp();
        sameSpots(s);
      }
      play();
    }
    expect(s.endings?.autopilot.placed).toBeGreaterThan(0);
    sameSpots(s);
  });
});

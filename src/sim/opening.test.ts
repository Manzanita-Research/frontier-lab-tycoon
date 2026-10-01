// FLT-91: the garage's front yard (an entrance plaza and a short walk), and the first minutes that still have to teach.
import { coachOf } from "./coach";
import { canPlace } from "./commands";
import { OPENING_TILES, PLAZA, STUB, WALK, onPlaza, openingPaths } from "./opening";
import { entranceConnected, gateAccessTiles, getReach, isReachable } from "./pathfind";
import { pathGaps } from "./pathgap";
import { createInitialState } from "./state";
import { createTestCampus } from "./testkit";
import { applyNow } from "./tick";

const SEEDS = [1, 2, 3, 42, 2027];

describe("the front yard", () => {
  it.each(SEEDS)("is paved, joined to the gate, and walks to the Cluster (seed %i)", (seed) => {
    const s = createInitialState(seed);
    const reach = getReach(s);
    expect(OPENING_TILES).toBeGreaterThanOrEqual(12); // Jem saw "two path tiles": this has to read as a place
    for (const [x, z] of openingPaths()) expect(reach.tiles[z * s.grid.w + x], `${x},${z}`).toBeTruthy();
    expect(reach.tiles.filter(Boolean)).toHaveLength(OPENING_TILES);
    for (const [x, z] of gateAccessTiles(s)) expect(onPlaza(x, z)).toBe(true);
    expect(entranceConnected(s)).toBe(true);
    expect(s.buildings.map((b) => b.kind)).toEqual(["cluster"]);
    expect(isReachable(s, s.buildings[0]!)).toBe(true);
    // People start out on it, not in the gate.
    for (const w of s.walkers) expect(s.grid.paths[Math.floor(w.z) * s.grid.w + Math.floor(w.x)]).toBe(true);
  });

  it("leaves the first Hall's and Gateway's spots free, and the walk ends where the coach's path begins", () => {
    const s = createInitialState(1);
    for (const r of PLAZA) for (let x = r.x; x < r.x + r.w; x++) expect(x >= 12 && r.z < 22).toBe(false);
    expect(canPlace(s, "hall", 12, 19).ok).toBe(true); // right of the walk, touching it and the plaza
    expect(WALK.z0).toBe(19);
    expect(s.grid.paths[18 * s.grid.w + 11]).toBe(false); // the coach's first suggested tile is still yours to lay
    expect(s.buildings.some((b) => b.x <= 11 && 11 < b.x + b.w && b.z <= 18 && 18 < b.z + b.d)).toBe(false);
  });

  it("the test campus still starts from the old five-tile stub, so pack fixtures don't move", () => {
    const stub = createInitialState(1, "stub");
    expect(stub.grid.paths.filter(Boolean)).toHaveLength(STUB.length);
    for (const w of stub.walkers) expect(STUB.some(([x, z]) => x === Math.floor(w.x) && z === Math.floor(w.z))).toBe(true);
    // Same lab, same dice as a plain garage up to the walkers: only where they stand differs.
    expect(stub.labName).toBe(createInitialState(1).labName);
    expect(createTestCampus(1).buildings.map((b) => b.kind)).toEqual(["cluster", "hall", "kombucha"]);
  });
});

describe("the first minutes still teach", () => {
  const open = () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "buildPanelOpened" }]);
    expect(coachOf(s)?.id).toBe("path");
    return s;
  };

  it("the coach's path step asks for three tiles of your own, joined to the gate", () => {
    const s = open();
    applyNow(s, [{ type: "placePath", x: 11, z: 18 }, { type: "placePath", x: 11, z: 17 }]);
    expect(coachOf(s)?.id).toBe("path");
    // Tiles off the network don't count, however many.
    applyNow(s, [3, 4, 5, 6].map((x) => ({ type: "placePath" as const, x, z: 3 })));
    expect(coachOf(s)?.id).toBe("path");
    applyNow(s, [{ type: "placePath", x: 11, z: 16 }]);
    expect(coachOf(s)?.id).toBe("hall");
    expect(coachOf(s)?.target).toBeDefined();
  });

  it("a Hall off the network still flags No path! and shows the gap back to the plaza (FLT-85)", () => {
    const s = open();
    // A path tile beside the Hall's spot, but nothing between it and the walk.
    applyNow(s, [{ type: "placePath", x: 11, z: 16 }, { type: "placeBuilding", kind: "hall", x: 12, z: 15, confirmed: true }]);
    const hall = s.buildings.find((b) => b.kind === "hall")!;
    expect(isReachable(s, hall)).toBe(false);
    const gap = pathGaps(s).get(hall.id)!;
    expect(gap.join).toEqual([[11, 17], [11, 18]]);
    for (const [x, z] of gap.join) applyNow(s, [{ type: "placePath", x, z }]);
    expect(isReachable(s, hall)).toBe(true);
    expect(pathGaps(s).has(hall.id)).toBe(false);
  });
});

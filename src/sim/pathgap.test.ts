// FLT-85: where a stranded building's path breaks, and the tiles that would join it to the gate.
import { createInitialState } from "./state";
import { findPathGap, pathGaps } from "./pathgap";
import { getReach } from "./pathfind";
import { busyLab } from "./perf/busyLab";
import type { Building, GameState } from "./types";

/** An empty 24×24 lot: the gate at (11..12, 23), its mouth at (11..12, 22), and only the paths and buildings given. */
function lot(paths: [number, number][], buildings: [x: number, z: number, w: number, d: number][]): GameState {
  const s = createInitialState(1);
  s.grid.paths.fill(false);
  for (const [x, z] of paths) s.grid.paths[z * s.grid.w + x] = true;
  s.buildings = buildings.map(([x, z, w, d], i): Building => ({ id: 100 + i, kind: "kombucha", x, z, w, d, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 }));
  s.version++;
  return s;
}

const line = (x0: number, z0: number, x1: number, z1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) out.push([x, z]);
  return out;
};

const lay = (s: GameState, tiles: readonly [number, number][]) => {
  for (const [x, z] of tiles) s.grid.paths[z * s.grid.w + x] = true;
  s.version++;
};

describe("findPathGap (FLT-85)", () => {
  it("a straight gap: one missing tile in a line from the gate", () => {
    // The gate's path runs up to z=16; the building's stub runs from its door at z=14 down to z=15... but z=15 is missing.
    const s = lot([...line(11, 22, 11, 17), [11, 15]], [[10, 13, 2, 2]]);
    const b = s.buildings[0]!;
    expect(getReach(s).buildings.has(b.id)).toBe(false);
    const gap = findPathGap(s, b)!;
    expect(gap.join).toEqual([[11, 16]]);
    expect(gap.door).toEqual([11, 15]);
    expect(gap.stub).toEqual([[11, 15]]);
    lay(s, gap.join);
    expect(getReach(s).buildings.has(b.id)).toBe(true);
    expect(findPathGap(s, b)).toBeNull();
  });

  it("an L-shaped gap: the join turns the corner", () => {
    // The network comes up x=11 to z=18; the building sits to the left with nothing touching it.
    const s = lot(line(11, 22, 11, 18), [[5, 15, 2, 2]]);
    const b = s.buildings[0]!;
    const gap = findPathGap(s, b)!;
    // Five steps from the nearest side (the right edge, or the row under it) to a tile beside the network: six new tiles.
    expect(gap.join).toHaveLength(6);
    expect(gap.stub).toEqual([]);
    // The door touches the building, it is the first tile laid, and the last one touches the network.
    const [dx, dz] = gap.door!;
    expect(gap.join[0]).toEqual([dx, dz]);
    expect((dx === 7 && dz >= 15 && dz <= 16) || (dz === 17 && dx >= 5 && dx <= 6)).toBe(true);
    const [ex, ez] = gap.join.at(-1)!;
    expect(getReach(s).tiles[(ez + 1) * 24 + ex] || getReach(s).tiles[ez * 24 + ex + 1]).toBeTruthy();
    // Every step is a 4-neighbour of the one before.
    for (let i = 1; i < gap.join.length; i++) expect(Math.abs(gap.join[i]![0] - gap.join[i - 1]![0]) + Math.abs(gap.join[i]![1] - gap.join[i - 1]![1])).toBe(1);
    lay(s, gap.join);
    expect(getReach(s).buildings.has(b.id)).toBe(true);
  });

  it("a building in the way: the join goes round it, never through it", () => {
    // Network up x=11 to z=17. The stranded building is at (11..12, 12..13) with a stub at (11, 14).
    // A 4-wide wall of a building sits between them at (9..12, 15..16): the gap goes round its side.
    const s = lot([...line(11, 22, 11, 17), [11, 14]], [[11, 12, 2, 2], [9, 15, 4, 2]]);
    const [b, wall] = s.buildings;
    const gap = findPathGap(s, b!)!;
    for (const [x, z] of gap.join) {
      expect(x >= wall!.x && x < wall!.x + wall!.w && z >= wall!.z && z < wall!.z + wall!.d).toBe(false);
      expect(x >= b!.x && x < b!.x + b!.w && z >= b!.z && z < b!.z + b!.d).toBe(false);
    }
    // Round the wall's right-hand end: from the stub along z=14 to x=13, down to z=17, and one tile left to meet the network.
    expect(gap.join).toHaveLength(6);
    lay(s, gap.join);
    expect(getReach(s).buildings.has(b!.id)).toBe(true);
    expect(getReach(s).buildings.has(wall!.id)).toBe(true);
  });

  it("an already-connected building has no gap", () => {
    const s = lot(line(11, 22, 11, 15), [[12, 15, 2, 2]]);
    expect(getReach(s).buildings.has(s.buildings[0]!.id)).toBe(true);
    expect(findPathGap(s, s.buildings[0]!)).toBeNull();
    expect(pathGaps(s).size).toBe(0);
  });

  it("a building boxed in on every side has a gap with no door: there is no way through", () => {
    const s = lot(line(11, 22, 11, 18), [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 4, 2]]);
    const gap = findPathGap(s, s.buildings[0]!)!;
    expect(gap.door).toBeNull();
    expect(gap.join).toEqual([]);
  });

  it("a gate with no path at all: the join ends on the gate's mouth", () => {
    const s = lot([], [[11, 18, 2, 2]]);
    const gap = findPathGap(s, s.buildings[0]!)!;
    expect(gap.join).toHaveLength(3);
    expect(gap.join.at(-1)![1]).toBe(22);
  });

  it("pathGaps is cached per World version and lists only stranded buildings", () => {
    const s = lot([...line(11, 22, 11, 17), [11, 15]], [[10, 13, 2, 2], [12, 18, 2, 2]]);
    const gaps = pathGaps(s);
    expect([...gaps.keys()]).toEqual([100]);
    expect(pathGaps(s)).toBe(gaps);
    lay(s, gaps.get(100)!.join);
    expect(pathGaps(s).size).toBe(0);
  });

  it("is cheap: the busy lab with every building cut off costs well under a millisecond a building", () => {
    const { s } = busyLab();
    // Cut the gate off: every building is stranded.
    for (const [x, z] of [[11, 22], [12, 22]] as const) s.grid.paths[z * s.grid.w + x] = false;
    s.version++;
    const t0 = performance.now();
    const gaps = pathGaps(s);
    const ms = performance.now() - t0;
    expect(gaps.size).toBe(s.buildings.length);
    expect(ms / s.buildings.length).toBeLessThan(1);
  });
});

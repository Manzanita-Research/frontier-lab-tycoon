// FLT-85: where a stranded building's path breaks. A building with "No path!" gets the fewest tiles of new path that
// would join one of its doors to the gate's network, its door, and the stretch of path beside it that goes nowhere.
// Read-only and never called by the tick: the UI asks, once per World version, and only while something is stranded.
import { buildingAt, edgeTiles, gateAccessTiles, getReach, isPathTile, rectContains, tileIndex, type Tile } from "./pathfind";
import type { Building, GameState } from "./types";

export interface PathGap {
  /** The tile beside the building where the fix arrives: a stub of path that is already there, or the first new tile. Null when it is boxed in. */
  door: Tile | null;
  /** The tiles to lay, in order from the building's side to the gate's network. Empty when there is no way through. */
  join: Tile[];
  /** Path that touches the building but is cut off from the gate: the stretch that looks joined and isn't. */
  stub: Tile[];
}

/** One new tile costs more than any walk over existing path, so the fewest new tiles wins, then the shortest walk. */
const NEW_TILE = 1000;

/** Can a path go on (x, z) one day: in bounds, not under a building, not the gate. */
const open = (s: GameState, x: number, z: number) => x >= 0 && z >= 0 && x < s.grid.w && z < s.grid.h && !rectContains(s.gate, x, z) && !buildingAt(s, x, z);

/** A small binary heap of [cost, tile index], ties broken by index so the answer never depends on insertion luck. */
class Heap {
  private a: number[] = [];
  get size() {
    return this.a.length / 2;
  }
  private less(i: number, j: number) {
    const [ci, cj] = [this.a[2 * i]!, this.a[2 * j]!];
    return ci < cj || (ci === cj && this.a[2 * i + 1]! < this.a[2 * j + 1]!);
  }
  private swap(i: number, j: number) {
    const a = this.a;
    [a[2 * i], a[2 * j]] = [a[2 * j]!, a[2 * i]!];
    [a[2 * i + 1], a[2 * j + 1]] = [a[2 * j + 1]!, a[2 * i + 1]!];
  }
  push(cost: number, at: number) {
    this.a.push(cost, at);
    for (let i = this.size - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const out: [number, number] = [this.a[0]!, this.a[1]!];
    const last = this.size - 1;
    this.swap(0, last);
    this.a.length -= 2;
    for (let i = 0; ; ) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.size && this.less(l, m)) m = l;
      if (r < this.size && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return out;
  }
}

const DX = [1, -1, 0, 0];
const DZ = [0, 0, 1, -1];

/** Where `b`'s path breaks, or null when it is connected to the gate already. */
export function findPathGap(s: GameState, b: Building): PathGap | null {
  const reach = getReach(s);
  if (reach.buildings.has(b.id)) return null;
  const { w } = s.grid;
  const xy = (i: number): Tile => [i % w, Math.floor(i / w)];
  const mouths = new Set(gateAccessTiles(s).filter(([x, z]) => !buildingAt(s, x, z)).map(([x, z]) => tileIndex(s, x, z)));
  const goal = (i: number) => reach.tiles[i] === 1 || mouths.has(i);
  const step = (x: number, z: number) => (isPathTile(s, x, z) ? 1 : NEW_TILE);

  // The stub: path touching the building, and whatever path it leads to (none of it reaches the gate, or `b` would).
  const stub: Tile[] = [];
  const seen = new Set<number>();
  const doors = edgeTiles(s, b).filter((e) => isPathTile(s, e.x, e.z));
  const flood = doors.map((e) => tileIndex(s, e.x, e.z));
  for (const i of flood) seen.add(i);
  for (let head = 0; head < flood.length; head++) {
    const i = flood[head]!;
    stub.push(xy(i));
    const [x, z] = xy(i);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k]!;
      const nz = z + DZ[k]!;
      if (!isPathTile(s, nx, nz)) continue;
      const ni = tileIndex(s, nx, nz);
      if (seen.has(ni)) continue;
      seen.add(ni);
      flood.push(ni);
    }
  }

  // Dijkstra from every side of the building to the first tile of the gate's network (or the gate's bare mouth).
  const cost = new Map<number, number>();
  const parent = new Map<number, number>();
  const heap = new Heap();
  for (const e of edgeTiles(s, b)) {
    if (!open(s, e.x, e.z)) continue;
    const i = tileIndex(s, e.x, e.z);
    const c = step(e.x, e.z);
    if (c < (cost.get(i) ?? Infinity)) {
      cost.set(i, c);
      parent.set(i, -1);
      heap.push(c, i);
    }
  }
  let end = -1;
  while (heap.size > 0) {
    const [c, i] = heap.pop();
    if (c !== cost.get(i)) continue;
    // The gate's network (path already joined) ends the search; a bare mouth is a tile to lay, and then it ends.
    if (goal(i)) {
      end = i;
      break;
    }
    const [x, z] = xy(i);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k]!;
      const nz = z + DZ[k]!;
      if (!open(s, nx, nz)) continue;
      const ni = tileIndex(s, nx, nz);
      const nc = c + (reach.tiles[ni] === 1 ? 0 : step(nx, nz));
      if (nc < (cost.get(ni) ?? Infinity)) {
        cost.set(ni, nc);
        parent.set(ni, i);
        heap.push(nc, ni);
      }
    }
  }
  if (end === -1) return { door: null, join: [], stub };
  const route: number[] = [];
  for (let i = end; i !== -1; i = parent.get(i)!) route.push(i);
  route.reverse();
  const join = route.filter((i) => !s.grid.paths[i]).map(xy);
  return { door: xy(route[0]!), join, stub };
}

const gapCache = new WeakMap<GameState, { version: number; gaps: Map<number, PathGap> }>();

/** Every stranded building's gap, by building id. Cached per World version, like reachability. */
export function pathGaps(s: GameState): Map<number, PathGap> {
  const cached = gapCache.get(s);
  if (cached && cached.version === s.version) return cached.gaps;
  const reach = getReach(s);
  const gaps = new Map<number, PathGap>();
  for (const b of s.buildings) {
    if (reach.buildings.has(b.id)) continue;
    const gap = findPathGap(s, b);
    if (gap) gaps.set(b.id, gap);
  }
  gapCache.set(s, { version: s.version, gaps });
  return gaps;
}

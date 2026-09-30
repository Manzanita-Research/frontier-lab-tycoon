// Grid queries and BFS over path tiles (4-neighbour).
import type { Building, GameState, Point, Rect } from "./types";

export type Tile = [number, number];

export interface Edge {
  x: number;
  z: number;
  /** Direction from this outside tile into the footprint. */
  dx: number;
  dz: number;
}

export const tileIndex = (s: GameState, x: number, z: number) => z * s.grid.w + x;

export function inBounds(s: GameState, x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < s.grid.w && z < s.grid.h;
}

export function isPathTile(s: GameState, x: number, z: number): boolean {
  return inBounds(s, x, z) && s.grid.paths[tileIndex(s, x, z)] === true;
}

export function rectContains(r: Rect, x: number, z: number): boolean {
  return x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
}

/** The front of the entrance is always reserved, even if its paths are bulldozed. */
export function gateAccessTiles(s: GameState): Tile[] {
  return Array.from({ length: s.gate.w }, (_, i): Tile => [s.gate.x + i, s.gate.z - 1]);
}

export function entranceConnected(s: GameState): boolean {
  return getReach(s).connected;
}

/** A little deterministic amble across the two reserved entrance tiles; no random draws or teleporting. */
export function gateAmble(s: GameState, id: number): Point[] {
  const angle = id * 2.399963229728653 + Math.floor(s.tick / 12) * 0.7;
  return [[s.gate.x + s.gate.w / 2 + Math.cos(angle) * 0.75, s.gate.z - 0.5 + Math.sin(angle) * 0.38]];
}

export function buildingAt(s: GameState, x: number, z: number): Building | undefined {
  return s.buildings.find((b) => rectContains(b, x, z));
}

/** In-bounds tiles touching the footprint's edges from outside. */
export function edgeTiles(s: GameState, r: Rect): Edge[] {
  const out: Edge[] = [];
  const push = (x: number, z: number, dx: number, dz: number) => {
    if (inBounds(s, x, z)) out.push({ x, z, dx, dz });
  };
  for (let x = r.x; x < r.x + r.w; x++) {
    push(x, r.z - 1, 0, 1);
    push(x, r.z + r.d, 0, -1);
  }
  for (let z = r.z; z < r.z + r.d; z++) {
    push(r.x - 1, z, 1, 0);
    push(r.x + r.w, z, -1, 0);
  }
  return out;
}

/** Path tiles touching the footprint: where walkers enter and leave. */
export function entrances(s: GameState, r: Rect): Edge[] {
  return edgeTiles(s, r).filter((e) => isPathTile(s, e.x, e.z));
}

const NEIGHBORS: Tile[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// bfsRoute's scratch, reused from call to call: a tile is seen when its stamp is this call's.
let stamps = new Int32Array(0);
let parents = new Int32Array(0);
let queue = new Int32Array(0);
let stamp = 0;
const DX = [1, -1, 0, 0];
const DZ = [0, 0, 1, -1];

/** Shortest path-tile route from start to the nearest goal tile, inclusive of both. */
export function bfsRoute(s: GameState, start: Tile, goals: Set<number>): Tile[] | null {
  if (!isPathTile(s, start[0], start[1])) return null;
  const { w, h, paths } = s.grid;
  const n = w * h;
  if (stamps.length < n) {
    stamps = new Int32Array(n);
    parents = new Int32Array(n);
    queue = new Int32Array(n);
    stamp = 0;
  }
  if (++stamp === 0x7fffffff) {
    stamps.fill(0);
    stamp = 1;
  }
  let head = 0;
  let tail = 0;
  const startIdx = tileIndex(s, start[0], start[1]);
  stamps[startIdx] = stamp;
  parents[startIdx] = -1;
  queue[tail++] = startIdx;
  while (head < tail) {
    const cur = queue[head++]!;
    if (goals.has(cur)) {
      const route: Tile[] = [];
      for (let i = cur; i !== -1; i = parents[i]!) route.push([i % w, Math.floor(i / w)]);
      return route.reverse();
    }
    const cx = cur % w;
    const cz = Math.floor(cur / w);
    // NEIGHBORS' order, by index: destructuring each pair walked the array iterator (FLT-39).
    for (let k = 0; k < 4; k++) {
      const nx = cx + DX[k]!;
      const nz = cz + DZ[k]!;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const ni = nz * w + nx;
      if (paths[ni] !== true || stamps[ni] === stamp) continue;
      stamps[ni] = stamp;
      parents[ni] = cur;
      queue[tail++] = ni;
    }
  }
  return null;
}

function floodFill(s: GameState, seeds: Tile[]): Uint8Array {
  const seen = new Uint8Array(s.grid.w * s.grid.h);
  const queue: number[] = [];
  for (const [x, z] of seeds) {
    if (!isPathTile(s, x, z)) continue;
    const i = tileIndex(s, x, z);
    if (!seen[i]) {
      seen[i] = 1;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % s.grid.w;
    const cz = Math.floor(cur / s.grid.w);
    for (const [dx, dz] of NEIGHBORS) {
      if (!isPathTile(s, cx + dx, cz + dz)) continue;
      const ni = tileIndex(s, cx + dx, cz + dz);
      if (seen[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

export interface Reach {
  version: number;
  /** 1 for every path tile connected to the gate. */
  tiles: Uint8Array;
  /** Ids of buildings with an entrance connected to the gate. */
  buildings: Set<number>;
  connected: boolean;
}

const reachCache = new WeakMap<GameState, Reach>();

/** Reachability from the gate, cached per `state.version`. */
export function getReach(s: GameState): Reach {
  const cached = reachCache.get(s);
  if (cached && cached.version === s.version) return cached;
  const tiles = floodFill(
    s,
    gateAccessTiles(s).filter(([x, z]) => !buildingAt(s, x, z)),
  );
  const buildings = new Set<number>();
  for (const b of s.buildings) {
    if (entrances(s, b).some((e) => tiles[tileIndex(s, e.x, e.z)])) buildings.add(b.id);
  }
  const mouths = new Set(gateAccessTiles(s).map(([x, z]) => tileIndex(s, x, z)));
  const connected = tiles.some((on, i) => !!on && !mouths.has(i));
  const reach: Reach = { version: s.version, tiles, buildings, connected };
  reachCache.set(s, reach);
  return reach;
}

export function isReachable(s: GameState, b: Building): boolean {
  return getReach(s).buildings.has(b.id);
}

export function reachablePathTiles(s: GameState): Tile[] {
  const { tiles } = getReach(s);
  const out: Tile[] = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i]) out.push([i % s.grid.w, Math.floor(i / s.grid.w)]);
  return out;
}

export function nearestPathTile(s: GameState, x: number, z: number): Tile | null {
  let best: Tile | null = null;
  let bestD = Infinity;
  for (let i = 0; i < s.grid.paths.length; i++) {
    if (!s.grid.paths[i]) continue;
    const tx = i % s.grid.w;
    const tz = Math.floor(i / s.grid.w);
    const d = (tx + 0.5 - x) ** 2 + (tz + 0.5 - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = [tx, tz];
    }
  }
  return best;
}

/**
 * Waypoints from a position to a building (or the gate): tile centres along the
 * path, then a last "door" point just inside the wall. Null when there is no route.
 */
// Destination geometry only changes with the World version. Keep route templates outside
// the persisted sim and hand each walker its own mutable waypoint list.
// A route reads nothing but the path tiles and the target's footprint (the cache is per footprint object), and most
// new versions leave the paths alone (a breakdown, a repair, a card): those keep the routes (FLT-39).
const rectRoutes = new WeakMap<GameState, { version: number; w: number; paths: boolean[]; targets: WeakMap<Rect, Map<number | string, Point[] | null>> }>();
const samePaths = (a: boolean[], b: boolean[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
export function routeToRect(s: GameState, fromX: number, fromZ: number, target: Rect, isGate = false): Point[] | null {
  let cache = rectRoutes.get(s);
  if (cache && cache.version !== s.version && cache.w === s.grid.w && samePaths(cache.paths, s.grid.paths)) cache.version = s.version;
  if (!cache || cache.version !== s.version) {
    cache = { version: s.version, w: s.grid.w, paths: s.grid.paths.slice(), targets: new WeakMap() };
    rectRoutes.set(s, cache);
  }
  let routes = cache.targets.get(target);
  if (!routes) { routes = new Map(); cache.targets.set(target, routes); }
  const fx = Math.floor(fromX), fz = Math.floor(fromZ);
  const key = inBounds(s, fx, fz) ? tileIndex(s, fx, fz) * 2 + Number(isGate) : `${fx},${fz},${Number(isGate)}`;
  if (routes.has(key)) return routes.get(key)?.map(([x, z]): Point => [x, z]) ?? null;
  const ents = entrances(s, target);
  if (ents.length === 0) { routes.set(key, null); return null; }
  const goals = new Set(ents.map((e) => tileIndex(s, e.x, e.z)));
  const tiles = bfsRoute(s, [Math.floor(fromX), Math.floor(fromZ)], goals);
  if (!tiles) { routes.set(key, null); return null; }
  const points: Point[] = tiles.map(([x, z]) => [x + 0.5, z + 0.5]);
  const last = tiles[tiles.length - 1]!;
  const edge = ents.find((e) => e.x === last[0] && e.z === last[1])!;
  const reach = isGate ? 0.9 : 0.4;
  points.push([last[0] + 0.5 + edge.dx * reach, last[1] + 0.5 + edge.dz * reach]);
  routes.set(key, points.map(([x, z]): Point => [x, z]));
  return points;
}

/** Position walkers stand at when they "go inside" a building. */
export function doorPoint(s: GameState, r: Rect): Point | null {
  const ents = entrances(s, r);
  const linked = getReach(s).tiles;
  const e = ents.find((c) => linked[tileIndex(s, c.x, c.z)]) ?? ents[0];
  return e ? [e.x + 0.5 + e.dx * 0.4, e.z + 0.5 + e.dz * 0.4] : null;
}

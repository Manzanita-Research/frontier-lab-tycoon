// Queues (FLT-10): a full building's doorstep is a visible line. It forms on the path tiles leading away from the
// entrance, two people to a tile, so a long line snakes down the path; the walker at the front gets in when someone
// leaves, and everyone shuffles up. `chainFor` finds the tiles a line stands on, `slotPoint` the spot for the nth person.
import { entrances, isPathTile, tileIndex } from "./pathfind";
import type { GameState, Point } from "./types";

/** How many tiles a line can stretch over before the rest just stack at the end. */
const MAX_CHAIN = 12;
/** Two people to a tile, this far either side of its middle along the line. */
const SLOT_OFFSET = 0.25;

export interface Chain {
  /** The tiles, entrance first, each next to the last. */
  tiles: number[];
  /** Unit vector along the line at each tile, pointing away from the building. */
  dirs: Point[];
}

const chains = new WeakMap<GameState, { version: number; byKey: Map<number, Chain> }>();

/** The line that forms on entrance tile `tile` of building `id`: straight out from the door while the path goes on, turning when it must. */
export function chainFor(state: GameState, id: number, tile: number): Chain | null {
  let cache = chains.get(state);
  if (!cache || cache.version !== state.version) {
    cache = { version: state.version, byKey: new Map() };
    chains.set(state, cache);
  }
  const key = id * 4096 + tile;
  const hit = cache.byKey.get(key);
  if (hit) return hit;
  const b = state.buildings.find((o) => o.id === id);
  if (!b) return null;
  const x0 = tile % state.grid.w;
  const z0 = Math.floor(tile / state.grid.w);
  const edge = entrances(state, b).find((e) => e.x === x0 && e.z === z0);
  if (!edge) return null;
  const tiles = [tile];
  let dx = -edge.dx;
  let dz = -edge.dz;
  const dirs: Point[] = [[dx, dz]];
  const seen = new Set(tiles);
  let x = x0;
  let z = z0;
  while (tiles.length < MAX_CHAIN) {
    // Straight on, then a left turn, then a right turn.
    const options: Point[] = [[dx, dz], [dz, -dx], [-dz, dx]];
    const next = options.find(([ox, oz]) => isPathTile(state, x + ox, z + oz) && !seen.has(tileIndex(state, x + ox, z + oz)));
    if (!next) break;
    [dx, dz] = next;
    x += dx;
    z += dz;
    const i = tileIndex(state, x, z);
    seen.add(i);
    tiles.push(i);
    dirs.push([dx, dz]);
  }
  const chain = { tiles, dirs };
  cache.byKey.set(key, chain);
  return chain;
}

/** The direction the line runs at tile `t`: the way it goes on to the next tile (or, at the end, the way it came). */
const along = (chain: Chain, t: number): Point => chain.dirs[Math.min(chain.tiles.length - 1, t + 1)]!;

/** Where the nth person in the line stands (0 is at the door). Past the end of the chain they stack up. */
export function slotPoint(state: GameState, chain: Chain, n: number): Point {
  const last = chain.tiles.length - 1;
  const t = Math.min(last, n >> 1);
  const sub = t === last && n >> 1 > last ? 1 : n & 1;
  const i = chain.tiles[t]!;
  const [dx, dz] = along(chain, t);
  const cx = (i % state.grid.w) + 0.5;
  const cz = Math.floor(i / state.grid.w) + 0.5;
  const k = sub === 0 ? -SLOT_OFFSET : SLOT_OFFSET;
  return [cx + dx * k, cz + dz * k];
}

/** The route from slot `from` to slot `to` along the line: each slot in turn, so it follows the corners. */
export function slotRoute(state: GameState, chain: Chain, from: number, to: number): Point[] {
  const out: Point[] = [];
  const step = to >= from ? 1 : -1;
  for (let n = from + step; n !== to + step; n += step) out.push(slotPoint(state, chain, n));
  return out;
}

/** The direction someone in the line faces: at the front, the door; everyone else, the person ahead of them. */
export function faceDoor(state: GameState, chain: Chain, n: number): number {
  if (n <= 0) {
    const [dx, dz] = chain.dirs[0]!;
    return Math.atan2(-dx, -dz);
  }
  const [ax, az] = slotPoint(state, chain, n - 1);
  const [bx, bz] = slotPoint(state, chain, n);
  return Math.hypot(ax - bx, az - bz) < 1e-6 ? Math.atan2(-chain.dirs[0]![0], -chain.dirs[0]![1]) : Math.atan2(ax - bx, az - bz);
}

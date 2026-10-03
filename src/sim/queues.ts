// Queues (FLT-10): a full building's doorstep is a visible line. It forms on the path tiles leading away from the
// entrance, two people to a tile, so a long line snakes down the path; the walker at the front gets in when someone
// leaves, and everyone shuffles up. `chainFor` finds the tiles a line stands on, `slotPoint` the spot for the nth person.
import { entrances, isPathTile, tileIndex } from "./pathfind";
import type { GameState, Point } from "./types";
import { datan2, dhypot } from "./dmath";

/** How many tiles a line can stretch over before the rest just stack at the end. */
const MAX_CHAIN = 12;
/** People in a line stand this far apart (tiles): walkers are drawn 1.6x life size, so a half tile is a scrum. */
export const SLOT_SPACING = 0.66;
/** The front of the line stands this far from the door's edge of its tile. */
const FRONT = 0.3;

export interface Chain {
  /** The tiles, entrance first, each next to the last. */
  tiles: number[];
  /** Unit vector along the line at each tile, pointing away from the building. */
  dirs: Point[];
  /** The line as a path to walk along: the door end of the entrance tile, then each tile's middle. */
  pts: Point[];
  /** Where each place in the line is (0 is the front); the last place is where everybody beyond the end of the path stacks up. */
  slots: Point[];
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
  const cx = (i: number) => (i % state.grid.w) + 0.5;
  const cz = (i: number) => Math.floor(i / state.grid.w) + 0.5;
  const pts: Point[] = [[cx(tile) + edge.dx * 0.5, cz(tile) + edge.dz * 0.5], ...tiles.map((i): Point => [cx(i), cz(i)])];
  const chain: Chain = { tiles, dirs, pts, slots: [] };
  // Every place a person can stand along the path, worked out once (a busy line asks for them hundreds of times a tick).
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += dhypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  for (let n = 0; FRONT + n * SLOT_SPACING <= length + 1e-9; n++) chain.slots.push(along(chain, FRONT + n * SLOT_SPACING));
  if (chain.slots.length === 0) chain.slots.push(pts[0]!);
  cache.byKey.set(key, chain);
  return chain;
}

/** The point `d` tiles along the line from the door (the last stretch is extended, so a line longer than the path just stacks up). */
function along(chain: Chain, d: number): Point {
  const pts = chain.pts;
  let left = d;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]!;
    const [bx, bz] = pts[i]!;
    const len = dhypot(bx - ax, bz - az);
    if (left <= len || i === pts.length - 1) return [ax + ((bx - ax) * Math.min(left, len)) / (len || 1), az + ((bz - az) * Math.min(left, len)) / (len || 1)];
    left -= len;
  }
  return pts[0]!;
}

/** Where the nth person in the line stands (0 is at the door); a line longer than the path stacks up at the end of it. */
export function slotPoint(_state: GameState, chain: Chain, n: number): Point {
  return chain.slots[Math.min(n, chain.slots.length - 1)]!;
}

/** The route from slot `from` to slot `to` along the line: each slot in turn, so it follows the corners. */
export function slotRoute(state: GameState, chain: Chain, from: number, to: number): Point[] {
  const last = chain.slots.length - 1;
  const a = Math.min(from, last);
  const b = Math.min(to, last);
  const out: Point[] = [];
  const step = b >= a ? 1 : -1;
  // (Past the end of the path everybody shares the last place, so the walk stops there.)
  for (let n = a + step; n !== b + step; n += step) out.push(slotPoint(state, chain, n));
  if (out.length === 0) out.push(slotPoint(state, chain, b));
  return out;
}

/** The direction someone in the line faces: at the front, the door; everyone else, the person ahead of them. */
export function faceDoor(state: GameState, chain: Chain, n: number): number {
  const [bx, bz] = slotPoint(state, chain, n);
  const [ax, az] = n <= 0 ? chain.pts[0]! : slotPoint(state, chain, n - 1);
  return dhypot(ax - bx, az - bz) < 1e-6 ? datan2(-chain.dirs[0]![0], -chain.dirs[0]![1]) : datan2(ax - bx, az - bz);
}

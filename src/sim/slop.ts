// Slop (FLT-10): RCT's litter. An agent that has drifted (drift over 0.6) drops a little slop on the path tile it is
// standing on, about once every 8 game hours; the puddles build up to three deep, a tile at a time, and walking
// through one is miserable. Janitor Bots mop it up (sim/staff.ts). The cleanliness of the campus is the share of its
// path tiles that are slopped, and it is 15% of what the Vibes are made of (sim/vibes.ts).
import { pushNews, addToast } from "./news";
import type { Rng } from "./rng";
import type { GameState } from "./types";

export const SLOP_MAX = 3;
/** Agents this far gone start dropping slop. */
export const SLOP_DRIFT = 0.6;
/**
 * Ticks between drops for one drifted agent, by how far gone they are. A fully drifted agent (0.9 and up) drops one every
 * 7 ticks, 8.4 game hours ("about 1 per 8"); one that has only just crossed the line, a third as often. Spread by id so
 * they don't all drop on the same tick.
 */
export const slopInterval = (drift: number): number => (drift >= 0.9 ? 7 : drift >= 0.75 ? 14 : 21);
/** Above this share of the path tiles slopped, the ticker notices. */
export const SLOP_NEWS_SHARE = 0.2;
/** Ticks the thought "I stepped in slop" lasts after leaving the puddle. */
export const MESS_TICKS = 6;
/** While the thought lasts, happiness is this much lower (sim/needs.ts): standing in slop is miserable, but it wears off. */
export const MESS_UNHAPPINESS = 0.12;

export const newSlop = (w: number, h: number): number[] => new Array<number>(w * h).fill(0);

const NEWS_COOLDOWN_DAYS = 12;

export interface SlopStats {
  /** Path tiles with any slop on them. */
  tiles: number;
  /** All path tiles. */
  paths: number;
  /** Slopped tiles as a share of path tiles, 0 to 1. */
  share: number;
  /** Total puddle depth (each tile 1 to 3). */
  depth: number;
}

export function slopStats(state: GameState): SlopStats {
  const { paths } = state.grid;
  let tiles = 0;
  let count = 0;
  let depth = 0;
  for (let i = 0; i < paths.length; i++) {
    if (!paths[i]) continue;
    count++;
    const level = state.slop[i] ?? 0;
    if (level > 0) {
      tiles++;
      depth += level;
    }
  }
  return { tiles, paths: count, share: count > 0 ? tiles / count : 0, depth };
}

/** 0 (ankle-deep everywhere) to 1 (spotless): half the paths slopped is as bad as it gets. */
export const cleanlinessOf = (state: GameState): number => Math.max(0, 1 - 2 * slopStats(state).share);

/** The tile a walker is standing on, as a grid index (or -1 off the map). */
const tileOf = (state: GameState, x: number, z: number): number => {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  return tx < 0 || tz < 0 || tx >= state.grid.w || tz >= state.grid.h ? -1 : tz * state.grid.w + tx;
};

/** Per tick: drifted agents drop slop where they stand (on a path), and anyone else on a puddle gets grumpier. */
export function updateSlop(state: GameState) {
  const { slop, grid } = state;
  for (const w of state.walkers) {
    if (w.kind === "agent") {
      if (w.drift <= SLOP_DRIFT || w.machine.value === "inside" || (state.tick + w.id) % slopInterval(w.drift) !== 0) continue;
      const i = tileOf(state, w.x, w.z);
      if (i < 0 || !grid.paths[i] || (slop[i] ?? 0) >= SLOP_MAX) continue;
      slop[i] = (slop[i] ?? 0) + 1;
      state.flags.slopRev = (state.flags.slopRev ?? 0) + 1;
      continue;
    }
    if (w.kind !== "researcher" && w.kind !== "visitor") continue;
    if (w.mess > 0) w.mess--;
    if (w.machine.value === "inside") continue;
    if ((slop[tileOf(state, w.x, w.z)] ?? 0) > 0) w.mess = MESS_TICKS;
  }
}

/** Mop one level off a tile; returns whether anything was there to mop. */
export function mopTile(state: GameState, i: number): boolean {
  if ((state.slop[i] ?? 0) <= 0) return false;
  state.slop[i]!--;
  state.flags.slopRev = (state.flags.slopRev ?? 0) + 1;
  return true;
}

/** A bulldozed path takes its slop with it. */
export function clearSlop(state: GameState, i: number) {
  if ((state.slop[i] ?? 0) === 0) return;
  state.slop[i] = 0;
  state.flags.slopRev = (state.flags.slopRev ?? 0) + 1;
}

/** Once a day: when a fifth of the paths are slopped, the ticker says so (and again every couple of weeks while it stays that way). */
export function dailySlop(state: GameState, rng: Rng) {
  const { share } = slopStats(state);
  if (share <= SLOP_NEWS_SHARE || state.day < (state.flags.nextSlopNews ?? 0)) return;
  const pct = String(Math.round(share * 100));
  pushNews(state, rng, "slop", { pct });
  if (state.flags.nextSlopNews === undefined) addToast(state, `${state.labName} campus now ${pct}% slop by volume. A Janitor Bot is $2K a day.`, "bad");
  state.flags.nextSlopNews = state.day + NEWS_COOLDOWN_DAYS;
}

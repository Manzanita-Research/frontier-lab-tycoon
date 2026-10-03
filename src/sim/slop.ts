// Slop (FLT-10): RCT's litter. An agent that has drifted (drift over 0.6) drops a little slop on the path tile it is
// standing on, about once every 8 game hours; the puddles build up to three deep, a tile at a time, and walking
// through one is miserable. Janitor Bots mop it up (sim/staff.ts). The cleanliness of the campus is the share of its
// path tiles that are slopped, and it is 15% of what the Vibes are made of (sim/vibes.ts).
import { pushNews, addToast } from "./news";
import type { Rng } from "./rng";
import type { GameState, Walker } from "./types";
import { sq } from "./dmath";

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
/**
 * "Mess" is how much slop a walker has been through lately, 0 to 1: it builds while they stand in it (more per level of
 * depth) and wears off slowly once they are clear. It is a smooth quantity on purpose: the daily mood check reads happiness
 * at midnight, and an on/off flag would flip whole crowds between slumped and content from one day to the next.
 */
export const MESS_GAIN = 0.03;
export const MESS_DECAY = 0.004;
/** A walker with this much mess on them thinks "This path is covered in slop." */
export const MESS_THOUGHT = 0.08;
/** At full mess, happiness is this much lower (sim/needs.ts). */
export const MESS_UNHAPPINESS = 0.08;

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

/** Called for a drifted-enough agent whose turn it is (see `slopInterval`): a little slop where they stand, if that is a path. */
export function dropSlop(state: GameState, w: Walker) {
  // (Every interval is a multiple of 7, so most agents are ruled out by the caller's `(tick + id) % 7` alone.)
  if (w.drift <= SLOP_DRIFT || w.machine.value === "inside" || (state.tick + w.id) % slopInterval(w.drift) !== 0) return;
  const i = tileOf(state, w.x, w.z);
  if (i < 0 || !state.grid.paths[i] || (state.slop[i] ?? 0) >= SLOP_MAX) return;
  state.slop[i] = (state.slop[i] ?? 0) + 1;
  state.flags.slopRev = (state.flags.slopRev ?? 0) + 1;
}

/** Called once a tick for every researcher and visitor: mess builds while they stand in slop and wears off once they are clear. */
export function messTick(state: GameState, w: Walker) {
  if (w.machine.value === "inside") {
    if (w.mess > 0) w.mess = Math.max(0, w.mess - MESS_DECAY);
    return;
  }
  const level = state.slop[tileOf(state, w.x, w.z)] ?? 0;
  if (level > 0) w.mess = Math.min(1, w.mess + MESS_GAIN * level);
  else if (w.mess > 0) w.mess = Math.max(0, w.mess - MESS_DECAY);
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
  if (state.flags.firstSpillDay !== undefined && state.day >= state.flags.firstSpillDay) firstSpill(state);
  const { share } = slopStats(state);
  if (share <= SLOP_NEWS_SHARE || state.day < (state.flags.nextSlopNews ?? 0)) return;
  const pct = String(Math.round(share * 100));
  pushNews(state, rng, "slop", { pct });
  if (state.flags.nextSlopNews === undefined) addToast(state, `${state.labName} campus now ${pct}% slop by volume. A Janitor Bot is $2K a day.`, "bad", { source: "ops", importance: "you" });
  state.flags.nextSlopNews = state.day + NEWS_COOLDOWN_DAYS;
}

/** Puddles in the first spill, and how deep. */
export const FIRST_SPILL = { tiles: 6, depth: 2 };

/**
 * FLT-58: the day after Level 3 opens, the Kombucha Bar's culture gets out, so the new Janitor Bot has something to mop
 * before the agents have drifted far enough to make their own mess. The path tiles nearest the bar (or the gate), once.
 */
export function firstSpill(state: GameState) {
  delete state.flags.firstSpillDay;
  const bar = state.buildings.find((b) => b.kind === "kombucha");
  const cx = bar ? bar.x + bar.w / 2 : state.gate.x + 0.5;
  const cz = bar ? bar.z + bar.d / 2 : state.gate.z + 0.5;
  const w = state.grid.w;
  const near = state.grid.paths
    .flatMap((p, i) => (p ? [{ i, d: sq(i % w + 0.5 - cx) + sq(Math.floor(i / w) + 0.5 - cz) }] : []))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, FIRST_SPILL.tiles);
  if (near.length === 0) return;
  for (const { i } of near) state.slop[i] = Math.max(state.slop[i] ?? 0, FIRST_SPILL.depth);
  state.flags.slopRev = (state.flags.slopRev ?? 0) + 1;
  addToast(state, bar ? "The Kombucha Bar's culture has escaped onto the paths. It is alive and it is sticky." : "Something sticky is on the paths. Nobody will say what.", "bad", { source: "ops", importance: "you" });
}

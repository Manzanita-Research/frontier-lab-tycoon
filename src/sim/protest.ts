// The Water Discourse stat and the crowd it sends to the gate.
import { DISCOURSE_PER_PROTESTER, MAX_PROTESTERS } from "./constants";
import { buildingAt, inBounds, rectContains } from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_GATE, type GameState, type Point, type Walker } from "./types";
import { advance, despawn, newWalker } from "./walkers";
import { stepWalker } from "./machines/walker";

const DISCOURSE_PER_CLUSTER = 0.5;
const DISCOURSE_DECAY = 0.3;

export function protesterTarget(state: GameState): number {
  return Math.min(MAX_PROTESTERS, Math.floor(state.waterDiscourse / DISCOURSE_PER_PROTESTER));
}

export function protesterCount(state: GameState): number {
  let n = 0;
  for (const w of state.walkers) if (w.kind === "protester") n++;
  return n;
}

/** Discourse has a floor but no ceiling: ignore it long enough and the 40-protester cap is what stops the crowd. */
export const clampDiscourse = (n: number) => Math.max(0, n);

/** Each compute cluster adds to the discourse; it fades on its own. Then the crowd follows the number. */
export function dailyDiscourse(state: GameState, rng: Rng) {
  const clusters = state.buildings.filter((b) => b.kind === "cluster").length;
  state.waterDiscourse = clampDiscourse(state.waterDiscourse + DISCOURSE_PER_CLUSTER * clusters - DISCOURSE_DECAY);
  syncProtesters(state, rng);
}

const standable = (state: GameState, x: number, z: number) => {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  return inBounds(state, tx, tz) && !buildingAt(state, tx, tz) && !rectContains(state.gate, tx, tz);
};

const blocked = (state: GameState, x: number, z: number) => !!buildingAt(state, Math.floor(x), Math.floor(z));

function clearLine(state: GameState, ax: number, az: number, bx: number, bz: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(state, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/** Protesters walk on grass, so they steer round a building's corner instead of through it. */
function planRoute(state: GameState, ax: number, az: number, bx: number, bz: number): Point[] {
  if (clearLine(state, ax, az, bx, bz)) return [[bx, bz]];
  let best: Point | null = null;
  let bestLen = Infinity;
  for (const b of state.buildings) {
    const corners: Point[] = [
      [b.x - 0.35, b.z - 0.35],
      [b.x + b.w + 0.35, b.z - 0.35],
      [b.x - 0.35, b.z + b.d + 0.35],
      [b.x + b.w + 0.35, b.z + b.d + 0.35],
    ];
    for (const [cx, cz] of corners) {
      if (!inBounds(state, Math.floor(cx), Math.floor(cz)) || blocked(state, cx, cz)) continue;
      const len = Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz);
      if (len < bestLen && clearLine(state, ax, az, cx, cz) && clearLine(state, cx, cz, bx, bz)) {
        best = [cx, cz];
        bestLen = len;
      }
    }
  }
  return best ? [best, [bx, bz]] : [[bx, bz]];
}

/** A spot to picket from: on and beside the path just inside the gate, thickest right at the gate. */
function pickHome(state: GameState, rng: Rng): Point {
  const g = state.gate;
  const cx = g.x + g.w / 2;
  for (let i = 0; i < 16; i++) {
    const x = cx - 0.5 + (rng.next() + rng.next() - 1) * 3.6;
    const z = g.z - 0.45 - Math.pow(rng.next(), 1.4) * 5.2;
    if (standable(state, x, z)) return [x, z];
  }
  return [cx - 0.5, g.z - 0.8];
}

function spawnProtester(state: GameState, rng: Rng, placed: boolean) {
  const g = state.gate;
  const w = newWalker(state, "protester", g.x + 0.3 + rng.next() * (g.w - 0.6), g.z + 0.35 + rng.next() * 0.6, rng);
  w.machine = stepWalker(w.machine, { type: "PROTEST_STARTED" });
  const [hx, hz] = pickHome(state, rng);
  w.homeX = hx;
  w.homeZ = hz;
  w.timer = rng.int(10, 70);
  if (placed) {
    w.x = w.px = hx;
    w.z = w.pz = hz;
  } else {
    w.route = planRoute(state, w.x, w.z, hx, hz);
  }
  state.walkers.push(w);
}

function sendHome(state: GameState, w: Walker, rng: Rng) {
  const g = state.gate;
  const gx = g.x + 0.4 + rng.next() * (g.w - 0.8);
  w.machine = stepWalker(w.machine, { type: "SENT_HOME" });
  w.targetId = TARGET_GATE;
  w.route = [...planRoute(state, w.x, w.z, gx, g.z - 0.3), [gx, g.z + 0.5], [gx, g.z + 2.2]];
}

/** Bring the number of protesters at the gate in line with the discourse: newcomers march in, extras wander off. */
export function syncProtesters(state: GameState, rng: Rng, placed = false) {
  const target = protesterTarget(state);
  const staying = state.walkers.filter((w) => w.kind === "protester" && w.machine.value !== "leaving");
  for (let i = staying.length; i < target; i++) spawnProtester(state, rng, placed);
  for (let extra = staying.length - target; extra > 0; extra--) {
    const [w] = staying.splice(rng.int(0, staying.length - 1), 1);
    sendHome(state, w!, rng);
  }
}

/** Protesters shuffle around their spot, march in from the gate, and leave the same way. They never enter a building. */
export function updateProtesters(state: GameState, rng: Rng) {
  let gone: Set<number> | null = null;
  for (const w of state.walkers) {
    if (w.kind !== "protester") continue;
    w.px = w.x;
    w.pz = w.z;
    if (w.route.length > 0) {
      advance(w);
      if (w.route.length === 0 && w.machine.value === "leaving") (gone ??= new Set()).add(w.id);
      continue;
    }
    if (w.machine.value === "leaving") {
      (gone ??= new Set()).add(w.id);
      continue;
    }
    if (--w.timer > 0) continue;
    w.timer = rng.int(30, 90);
    // Someone built on their spot? Find a new one.
    if (!standable(state, w.homeX, w.homeZ)) [w.homeX, w.homeZ] = pickHome(state, rng);
    const tx = w.homeX + (rng.next() - 0.5) * 1.6;
    const tz = w.homeZ + (rng.next() - 0.5) * 1.2;
    const [gx, gz] = standable(state, tx, tz) ? [tx, tz] : [w.homeX, w.homeZ];
    w.route = planRoute(state, w.x, w.z, gx, gz);
  }
  if (gone) despawn(state, gone);
}

// The Water Discourse stat and the crowd it sends to the gate.
import { DISCOURSE_PER_PROTESTER, MAX_PROTESTERS } from "./constants";
import { buildingAt, inBounds, rectContains } from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_GATE, type GameState, type Point, type Walker } from "./types";
import { advance, newWalker } from "./walkers";

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

export const clampDiscourse = (n: number) => Math.max(0, Math.min(100, n));

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
  const [hx, hz] = pickHome(state, rng);
  w.homeX = hx;
  w.homeZ = hz;
  w.timer = rng.int(10, 70);
  if (placed) {
    w.x = w.px = hx;
    w.z = w.pz = hz;
  } else {
    w.route = [[hx, hz]];
  }
  state.walkers.push(w);
}

function sendHome(state: GameState, w: Walker, rng: Rng) {
  const g = state.gate;
  const gx = g.x + 0.4 + rng.next() * (g.w - 0.8);
  w.mode = "leave";
  w.targetId = TARGET_GATE;
  w.route = [
    [gx, g.z + 0.5],
    [gx, g.z + 2.2],
  ];
}

/** Bring the number of protesters at the gate in line with the discourse: newcomers march in, extras wander off. */
export function syncProtesters(state: GameState, rng: Rng, placed = false) {
  const target = protesterTarget(state);
  const staying = state.walkers.filter((w) => w.kind === "protester" && w.mode !== "leave");
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
      if (w.route.length === 0 && w.mode === "leave") (gone ??= new Set()).add(w.id);
      continue;
    }
    if (w.mode === "leave") {
      (gone ??= new Set()).add(w.id);
      continue;
    }
    if (--w.timer > 0) continue;
    w.timer = rng.int(30, 90);
    // Someone built on their spot? Find a new one.
    if (!standable(state, w.homeX, w.homeZ)) [w.homeX, w.homeZ] = pickHome(state, rng);
    const tx = w.homeX + (rng.next() - 0.5) * 1.6;
    const tz = w.homeZ + (rng.next() - 0.5) * 1.2;
    w.route = [standable(state, tx, tz) ? [tx, tz] : [w.homeX, w.homeZ]];
  }
  if (gone) state.walkers = state.walkers.filter((w) => !gone!.has(w.id));
}

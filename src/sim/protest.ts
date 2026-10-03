// The Water Discourse stat and the crowd it sends to the gate.
import { DISCOURSE_PER_PROTESTER, MAX_PROTESTERS } from "./constants";
import { buildingAt, inBounds, rectContains } from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_GATE, type GameState, type Point, type Walker } from "./types";
import { advance, despawn, newWalker } from "./walkers";
import { gasDiscourse } from "./race/power";
import { stepWalker } from "./machines/walker";
import { commsRelief } from "./staff";
import { defs } from "./defs";
import { exchange, pairedThoughts } from "./factions/driver";
import { THOUGHT_TICKS } from "./constants";
import { dhypot, dpow } from "./dmath";

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
  state.waterDiscourse = clampDiscourse(state.waterDiscourse + DISCOURSE_PER_CLUSTER * clusters + gasDiscourse(state) - DISCOURSE_DECAY - commsRelief(state));
  syncProtesters(state, rng);
}

const standable = (state: GameState, x: number, z: number) => {
  const tx = Math.floor(x);
  const tz = Math.floor(z);
  return inBounds(state, tx, tz) && !buildingAt(state, tx, tz) && !rectContains(state.gate, tx, tz);
};

const blocked = (state: GameState, x: number, z: number) => !!buildingAt(state, Math.floor(x), Math.floor(z));

function clearLine(state: GameState, ax: number, az: number, bx: number, bz: number): boolean {
  const steps = Math.max(1, Math.ceil(dhypot(bx - ax, bz - az) / 0.25));
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
      const len = dhypot(cx - ax, cz - az) + dhypot(bx - cx, bz - cz);
      if (len < bestLen && clearLine(state, ax, az, cx, cz) && clearLine(state, cx, cz, bx, bz)) {
        best = [cx, cz];
        bestLen = len;
      }
    }
  }
  return best ? [best, [bx, bz]] : [[bx, bz]];
}

/** Which side of the path a crowd stands on: 0 spread across it; during a counter-protest −1 (left) and +1 (right). */
type Side = -1 | 0 | 1;

/**
 * A spot to picket from: on and beside the path just inside the gate, thickest right at the gate. A counter-protest
 * splits the lawn: the rally on the right, the crowds it came to shout at on the left, the path between them.
 */
function pickHome(state: GameState, rng: Rng, side: Side = 0): Point {
  const g = state.gate;
  const cx = g.x + g.w / 2;
  for (let i = 0; i < 16; i++) {
    const x = side === 0 ? cx - 0.5 + (rng.next() + rng.next() - 1) * 3.6 : side < 0 ? cx - 1 - rng.next() * 3.5 : cx + 0.6 + rng.next() * 3.4;
    const z = g.z - 0.45 - dpow(rng.next(), 1.4) * 5.2;
    if (standable(state, x, z)) return [x, z];
  }
  return [side === 0 ? cx - 0.5 : side < 0 ? cx - 2 : cx + 1.5, g.z - 0.8];
}

/** The side a crowd takes (`undefined`: the water crowd). Always 0 with no counter-protest on. */
function sideOf(state: GameState, crowd: string | undefined): Side {
  const rallies = state.rallies;
  if (!rallies || rallies.length === 0) return 0;
  if (crowd === undefined) return -1;
  if (rallies.some((r) => r.faction === crowd)) return 1;
  return rallies.some((r) => r.against.includes(crowd)) ? -1 : 0;
}

function spawnProtester(state: GameState, rng: Rng, placed: boolean, crowd?: string) {
  const g = state.gate;
  const w = newWalker(state, "protester", g.x + 0.3 + rng.next() * (g.w - 0.6), g.z + 0.35 + rng.next() * 0.6, rng);
  w.machine = stepWalker(w.machine, { type: "PROTEST_STARTED" });
  if (crowd !== undefined) w.crowd = w.faction = crowd;
  const [hx, hz] = pickHome(state, rng, sideOf(state, crowd));
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
  const staying = state.walkers.filter((w) => w.kind === "protester" && w.crowd === undefined && w.machine.value !== "leaving");
  for (let i = staying.length; i < target; i++) spawnProtester(state, rng, placed);
  for (let extra = staying.length - target; extra > 0; extra--) {
    const [w] = staying.splice(rng.int(0, staying.length - 1), 1);
    sendHome(state, w!, rng);
  }
  if (state.factions || state.rallies) syncCrowds(state, rng, placed);
}

/** A protesting faction's own crowd: bigger the angrier it is. */
export const crowdSize = (meter: number) => Math.max(2, Math.min(8, Math.round((-meter - 50) / 5)));
/** Faction crowds together never add more than this on top of the water crowd. */
const MAX_CROWDS = 24;

/** How many of each faction's crowd should be at the gate: the marching factions, plus any rally. */
export function crowdTargets(state: GameState): Map<string, number> {
  const out = new Map<string, number>();
  const f = state.factions;
  if (f) {
    for (const def of defs().factions) {
      const mood = f.moods[def.id];
      if (mood?.value === "protesting") out.set(def.id, crowdSize(mood.context.meter));
    }
  }
  const water = protesterTarget(state);
  for (const r of state.rallies ?? []) out.set(r.faction, (out.get(r.faction) ?? 0) + Math.max(r.min, Math.round(r.share * water)));
  let room = MAX_CROWDS;
  for (const [id, n] of out) {
    out.set(id, Math.min(n, room));
    room -= out.get(id)!;
  }
  return out;
}

/** Faction crowds march in and go home like the water crowd; a counter-protest also moves its targets across the path. */
function syncCrowds(state: GameState, rng: Rng, placed: boolean) {
  const want = crowdTargets(state);
  const have = new Map<string, Walker[]>();
  for (const w of state.walkers) {
    if (w.kind !== "protester" || w.machine.value === "leaving") continue;
    // A counter-protest on: its targets cross to the far side of the path (a crowd already there stays put).
    const side = sideOf(state, w.crowd);
    const cx = state.gate.x + state.gate.w / 2;
    if (side < 0 && w.homeX > cx - 1) {
      [w.homeX, w.homeZ] = pickHome(state, rng, side);
      w.route = planRoute(state, w.x, w.z, w.homeX, w.homeZ);
    }
    if (w.crowd === undefined) continue;
    const list = have.get(w.crowd);
    if (list) list.push(w);
    else have.set(w.crowd, [w]);
  }
  for (const [id, n] of want) for (let i = have.get(id)?.length ?? 0; i < n; i++) spawnProtester(state, rng, placed, id);
  for (const [id, list] of have) {
    for (let extra = list.length - (want.get(id) ?? 0); extra > 0; extra--) {
      const [w] = list.splice(rng.int(0, list.length - 1), 1);
      sendHome(state, w!, rng);
    }
  }
}

/** Ticks between shouts across the path in a counter-protest, and between chants from a marching faction. */
const SHOUT_EVERY = 30;
const CHANT_EVERY = 50;

/** A counter-protest is two crowds shouting at each other; a faction on the march chants. Only faction crowds speak here. */
function shout(state: GameState, rng: Rng) {
  const rallies = state.rallies ?? [];
  if (rallies.length > 0 && state.tick % SHOUT_EVERY === 0) {
    const r = rallies[(state.tick / SHOUT_EVERY) % rallies.length]!;
    const us = state.walkers.filter((w) => w.crowd === r.faction && w.route.length === 0 && w.machine.value !== "leaving");
    const them = state.walkers.filter((w) => w.kind === "protester" && w.crowd !== r.faction && w.route.length === 0 && w.machine.value !== "leaving" && sideOf(state, w.crowd) < 0);
    const def = defs().factionById(r.faction);
    if (def && us.length > 0 && them.length > 0) {
      const a = rng.pick(us);
      const b = rng.pick(them);
      // The water crowd speaks for whichever target faction the rally named first.
      const other = defs().factionById(b.crowd ?? b.faction ?? r.against[0] ?? "") ?? defs().factionById(r.against[0] ?? "");
      if (other) {
        const [said, reply] = exchange(rng, def, other);
        pairedThoughts(state, a, said, def.id, b, reply, other.id);
        if (state.factions) state.factions.counts.shouts++;
      }
    }
    return;
  }
  if (state.factions && state.tick % CHANT_EVERY === 0) {
    const marching = state.walkers.filter((w) => w.crowd !== undefined && w.route.length === 0 && w.machine.value !== "leaving");
    if (marching.length === 0 || state.thoughts.filter((t) => t.expiresTick > state.tick).length >= 3) return;
    const w = rng.pick(marching);
    const def = defs().factionById(w.crowd!);
    if (def && def.chants.length > 0) state.thoughts.push({ id: state.nextId++, walkerId: w.id, kind: w.kind, text: rng.pick(def.chants), expiresTick: state.tick + THOUGHT_TICKS / 2, faction: def.id });
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
    if (!standable(state, w.homeX, w.homeZ)) [w.homeX, w.homeZ] = pickHome(state, rng, sideOf(state, w.crowd));
    const tx = w.homeX + (rng.next() - 0.5) * 1.6;
    const tz = w.homeZ + (rng.next() - 0.5) * 1.2;
    const [gx, gz] = standable(state, tx, tz) ? [tx, tz] : [w.homeX, w.homeZ];
    w.route = planRoute(state, w.x, w.z, gx, gz);
  }
  if (gone) despawn(state, gone);
  if (state.rallies || state.factions) shout(state, rng);
}

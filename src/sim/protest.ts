// The Water Discourse stat and the crowd it sends to the gate.
import { DISCOURSE_PER_PROTESTER, MAX_PROTESTERS } from "./constants";
import { buildingAt, inBounds, rectContains } from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_GATE, type GameState, type Point } from "./types";
import { newWalker, walk } from "./walkers";
import { arrived, byWalkerId, ground, IsMarching, JustArrived, marching, setRoute, standing, type Ground, type ProtesterView } from "./ecs/protesters";
import type { Entity } from "koota";
import { gasDiscourse } from "./race/power";
import { stepWalker } from "./machines/walker";
import { commsRelief } from "./staff";
import { defs } from "./defs";
import { exchange, pairedThoughts } from "./factions/driver";
import { THOUGHT_TICKS } from "./constants";

const DISCOURSE_PER_CLUSTER = 0.5;
const DISCOURSE_DECAY = 0.3;

export function protesterTarget(state: GameState): number {
  return Math.min(MAX_PROTESTERS, Math.floor(state.waterDiscourse / DISCOURSE_PER_PROTESTER));
}

export function protesterCount(state: GameState): number {
  return ground(state).size;
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
    const z = g.z - 0.45 - Math.pow(rng.next(), 1.4) * 5.2;
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
  ground(state).adopt(w);
}

function sendHome(state: GameState, w: ProtesterView, rng: Rng) {
  const g = state.gate;
  const gx = g.x + 0.4 + rng.next() * (g.w - 0.8);
  w.machine = stepWalker(w.machine, { type: "SENT_HOME" });
  w.targetId = TARGET_GATE;
  w.route = [...planRoute(state, w.x, w.z, gx, g.z - 0.3), [gx, g.z + 0.5], [gx, g.z + 2.2]];
}

/** Bring the number of protesters at the gate in line with the discourse: newcomers march in, extras wander off. */
export function syncProtesters(state: GameState, rng: Rng, placed = false) {
  const target = protesterTarget(state);
  const staying = ground(state).views().filter((w) => w.crowd === undefined && w.machine.value !== "leaving");
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
  const have = new Map<string, ProtesterView[]>();
  for (const w of ground(state).views()) {
    if (w.machine.value === "leaving") continue;
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
    const crowd = ground(state).views();
    const us = crowd.filter((w) => w.crowd === r.faction && w.route.length === 0 && w.machine.value !== "leaving");
    const them = crowd.filter((w) => w.crowd !== r.faction && w.route.length === 0 && w.machine.value !== "leaving" && sideOf(state, w.crowd) < 0);
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
    const chanting = ground(state).views().filter((w) => w.crowd !== undefined && w.route.length === 0 && w.machine.value !== "leaving");
    if (chanting.length === 0 || state.thoughts.filter((t) => t.expiresTick > state.tick).length >= 3) return;
    const w = rng.pick(chanting);
    const def = defs().factionById(w.crowd!);
    if (def && def.chants.length > 0) state.thoughts.push({ id: state.nextId++, walkerId: w.id, kind: w.kind, text: rng.pick(def.chants), expiresTick: state.tick + THOUGHT_TICKS / 2, faction: def.id });
  }
}

/** March: everyone with a route walks it. Whoever runs out of route is home (or, leaving, through the gate). */
/** Nothing in the sim watches for changes, so skip Koota's change tracking (and its per-entity AoS snapshot copies). */
const UNTRACKED = { changeDetection: "never" } as const;

function marchSystem(g: Ground, gone: Set<Entity>) {
  const done: Entity[] = [];
  marching(g).updateEach(([body, route, flow], e) => {
    body.px = body.x;
    body.pz = body.z;
    walk(body, route);
    if (route.length > 0) return;
    if (flow.value === "leaving") gone.add(e);
    else done.push(e);
  }, UNTRACKED);
  for (const e of done) {
    e.remove(IsMarching);
    e.add(JustArrived);
  }
  for (const e of gone) e.remove(IsMarching);
}

/**
 * Picket: the rest stand at their spot and shuffle round it now and then; anyone left standing in "leaving" goes.
 * Rolls dice, so it goes in Walker-id order, the order the old loop over `state.walkers` rolled them in.
 */
function picketSystem(state: GameState, g: Ground, rng: Rng, gone: Set<Entity>) {
  standing(g)
    .sort(byWalkerId)
    .updateEach(([body, picket, flow], e) => {
      body.px = body.x;
      body.pz = body.z;
      if (flow.value === "leaving") {
        gone.add(e);
        return;
      }
      if (--picket.timer > 0) return;
      picket.timer = rng.int(30, 90);
      // Someone built on their spot? Find a new one.
      if (!standable(state, picket.homeX, picket.homeZ)) [picket.homeX, picket.homeZ] = pickHome(state, rng, sideOf(state, g.view(e).crowd));
      const tx = picket.homeX + (rng.next() - 0.5) * 1.6;
      const tz = picket.homeZ + (rng.next() - 0.5) * 1.2;
      const [gx, gz] = standable(state, tx, tz) ? [tx, tz] : [picket.homeX, picket.homeZ];
      setRoute(e, planRoute(state, body.x, body.z, gx, gz));
    }, UNTRACKED);
}

/** Protesters shuffle around their spot, march in from the gate, and leave the same way. They never enter a building. */
export function updateProtesters(state: GameState, rng: Rng) {
  const g = ground(state);
  const gone = new Set<Entity>();
  marchSystem(g, gone);
  picketSystem(state, g, rng, gone);
  for (const e of arrived(g)) e.remove(JustArrived);
  if (gone.size > 0) {
    for (const e of gone) g.view(e).machine = stepWalker(g.view(e).machine, { type: "EXITED" });
    g.remove(gone);
  }
  if (state.rallies || state.factions) shout(state, rng);
}

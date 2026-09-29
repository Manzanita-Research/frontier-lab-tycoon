// Researchers, agents and visitors: who they are, where they go, what they say.
import { BUILDINGS } from "../content/buildings";
import { CROWDING_PROTESTERS, MAX_AGENTS, WALK_SPEED } from "./constants";
import {
  doorPoint,
  entrances,
  getReach,
  nearestPathTile,
  reachablePathTiles,
  routeToRect,
  isPathTile,
  bfsRoute,
  tileIndex,
} from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_GATE, TARGET_WANDER, type Building, type GameState, type Point, type Walker, type WalkerKind } from "./types";

const ENERGY_DRAIN = 0.0025;
/** Chance that a walker leaving a building hangs around outside it for a bit instead of rushing off. */
const LOITER_CHANCE = 0.55;
/** How close (in tiles) a researcher passes a Fountain to get the refreshing splash. */
const FOUNTAIN_REACH = 1.6;
const FOUNTAIN_REFRESH = 0.1;

export function newWalker(state: GameState, kind: WalkerKind, x: number, z: number, rng: Rng): Walker {
  return {
    id: state.nextId++,
    kind,
    x,
    z,
    px: x,
    pz: z,
    dir: rng.next() * Math.PI * 2,
    route: [],
    targetId: TARGET_WANDER,
    mode: "walk",
    timer: 0,
    energy: kind === "researcher" ? 0.35 + rng.next() * 0.65 : 1,
    // A visitor tours 2 or 3 buildings, counting the first one they head for.
    visits: kind === "visitor" ? rng.int(2, 3) : 0,
    step: rng.int(0, 1),
    loiter: false,
    fountain: 0,
    homeX: x,
    homeZ: z,
  };
}

const byId = (state: GameState, id: number): Building | undefined => state.buildings.find((b) => b.id === id);

/** Buildings walkers can go into: connected to the gate, and not just scenery. */
function reachableBuildings(state: GameState): Building[] {
  const { buildings } = getReach(state);
  return state.buildings.filter((b) => buildings.has(b.id) && !BUILDINGS[b.kind].scenery);
}

function chooseTarget(state: GameState, w: Walker, rng: Rng): Building | null {
  const pool = reachableBuildings(state).filter((b) => b.id !== w.targetId);
  if (pool.length === 0) return null;
  if (w.kind === "researcher") {
    if (w.energy < 0.3) {
      const bar = pool.filter((b) => b.kind === "kombucha");
      if (bar.length > 0) return rng.pick(bar);
    }
    const wanted = w.step % 2 === 0 ? "hall" : "cluster";
    const workplaces = pool.filter((b) => b.kind === wanted);
    if (workplaces.length > 0) return rng.pick(workplaces);
  }
  return rng.pick(pool);
}

function startRoute(state: GameState, w: Walker, target: Building): boolean {
  const route = routeToRect(state, w.x, w.z, target);
  if (!route) return false;
  w.route = route;
  w.targetId = target.id;
  w.mode = "walk";
  return true;
}

function startLeave(state: GameState, w: Walker) {
  const route = routeToRect(state, w.x, w.z, state.gate, true);
  w.route = route ?? [];
  w.targetId = TARGET_GATE;
  w.mode = "leave";
  if (!route) w.route = [[w.x, w.z]];
}

function wander(state: GameState, w: Walker, rng: Rng) {
  w.mode = "walk";
  w.targetId = TARGET_WANDER;
  w.route = [];
  w.timer = rng.int(6, 16);
  const tiles = reachablePathTiles(state);
  if (tiles.length === 0) return;
  const [gx, gz] = rng.pick(tiles);
  const route = bfsRoute(state, [Math.floor(w.x), Math.floor(w.z)], new Set([tileIndex(state, gx, gz)]));
  if (route) w.route = route.map(([x, z]): Point => [x + 0.5, z + 0.5]);
}

function pickNext(state: GameState, w: Walker, rng: Rng) {
  w.loiter = false;
  if (w.kind === "visitor") {
    if (w.visits <= 0) return startLeave(state, w);
    w.visits--;
  }
  const target = chooseTarget(state, w, rng);
  if (target && startRoute(state, w, target)) return;
  wander(state, w, rng);
}

/** Step out of the building and stand around near its door for a while. */
function startLoiter(w: Walker, rng: Rng) {
  w.mode = "walk";
  w.targetId = TARGET_WANDER;
  w.route = [];
  w.loiter = true;
  w.timer = rng.int(14, 40);
}

/** A small step onto a neighbouring path tile. */
function loiterStep(state: GameState, w: Walker, rng: Rng) {
  const tx = Math.floor(w.x);
  const tz = Math.floor(w.z);
  const options: Point[] = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (isPathTile(state, tx + dx, tz + dz)) options.push([tx + dx + 0.5, tz + dz + 0.5]);
  }
  if (options.length > 0) w.route = [rng.pick(options)];
}

/** Leaving a building (the timer ran out): sometimes loiter first, otherwise off to the next stop. */
function finishStay(state: GameState, w: Walker, rng: Rng) {
  if (rng.chance(LOITER_CHANCE)) startLoiter(w, rng);
  else pickNext(state, w, rng);
}

/** Researchers get a splash of energy the first time they pass within reach of a Fountain. */
function passFountains(w: Walker, fountains: Building[]) {
  for (const f of fountains) {
    if (Math.hypot(f.x + f.w / 2 - w.x, f.z + f.d / 2 - w.z) > FOUNTAIN_REACH) continue;
    if (w.fountain !== f.id) {
      w.fountain = f.id;
      w.energy = Math.min(1, w.energy + FOUNTAIN_REFRESH);
    }
    return;
  }
  w.fountain = 0;
}

function arrive(state: GameState, w: Walker, rng: Rng) {
  if (w.mode === "leave") return; // handled by the caller: the visitor despawns
  if (w.targetId === TARGET_WANDER) {
    if (w.timer <= 0) w.timer = rng.int(6, 16);
    return;
  }
  const b = byId(state, w.targetId);
  if (!b) return pickNext(state, w, rng);
  w.mode = "inside";
  w.timer = rng.int(15, 45);
  w.step++;
  if (b.kind === "kombucha") w.energy = 1;
}

/** Walkers caught out by a change to paths or buildings find a new way. */
function repairWalkers(state: GameState, rng: Rng) {
  for (const w of state.walkers) {
    if (w.kind === "protester") continue; // they stand on grass; protest.ts looks after them
    if (w.mode === "inside") {
      if (byId(state, w.targetId)) continue;
      const p = nearestPathTile(state, w.x, w.z);
      if (p) [w.x, w.z] = [p[0] + 0.5, p[1] + 0.5];
      pickNext(state, w, rng);
      continue;
    }
    if (!isPathTile(state, Math.floor(w.x), Math.floor(w.z))) {
      const p = nearestPathTile(state, w.x, w.z);
      if (p) [w.x, w.z] = [p[0] + 0.5, p[1] + 0.5];
    }
    const routeBroken = w.route.some(([x, z]) => !isPathTile(state, Math.floor(x), Math.floor(z)));
    const targetGone = w.targetId > 0 && !byId(state, w.targetId);
    if (!routeBroken && !targetGone) continue;
    w.px = w.x;
    w.pz = w.z;
    if (w.mode === "leave") startLeave(state, w);
    else pickNext(state, w, rng);
  }
}

export function advance(w: Walker) {
  let budget = WALK_SPEED;
  while (budget > 1e-9 && w.route.length > 0) {
    const [tx, tz] = w.route[0]!;
    const dx = tx - w.x;
    const dz = tz - w.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-6) w.dir = Math.atan2(dx, dz);
    if (dist <= budget) {
      w.x = tx;
      w.z = tz;
      budget -= dist;
      w.route.shift();
    } else {
      w.x += (dx / dist) * budget;
      w.z += (dz / dist) * budget;
      budget = 0;
    }
  }
}

function spawnVisitor(state: GameState, rng: Rng) {
  const targets = reachableBuildings(state);
  const linked = getReach(state).tiles;
  const mouth = entrances(state, state.gate).filter((e) => linked[tileIndex(state, e.x, e.z)]);
  if (targets.length === 0 || mouth.length === 0) return;
  const g = state.gate;
  const w = newWalker(state, "visitor", g.x + g.w / 2, g.z + 0.6, rng);
  const target = rng.pick(targets);
  const e = rng.pick(mouth);
  const route = routeToRect(state, e.x + 0.5, e.z + 0.5, target);
  if (!route) return;
  w.route = route;
  w.targetId = target.id;
  w.visits--;
  state.walkers.push(w);
}

export function visitorCap(state: GameState): number {
  return Math.round(30 + state.hype * 1.2);
}

export function updateWalkers(state: GameState, rng: Rng) {
  if (state.flags.walkerVersion !== state.version) {
    state.flags.walkerVersion = state.version;
    repairWalkers(state, rng);
  }
  const fountains = state.buildings.filter((b) => b.kind === "fountain");
  let gone: Set<number> | null = null;
  let visitors = 0;
  let protesters = 0;
  for (const w of state.walkers) {
    if (w.kind === "protester") {
      protesters++; // protest.ts moves them
      continue;
    }
    if (w.kind === "visitor") visitors++;
    w.px = w.x;
    w.pz = w.z;
    if (w.kind === "researcher") {
      w.energy = Math.max(0, w.energy - ENERGY_DRAIN);
      if (fountains.length > 0 && w.mode !== "inside") passFountains(w, fountains);
    }
    if (w.mode === "inside") {
      if (--w.timer <= 0) finishStay(state, w, rng);
      continue;
    }
    if (w.route.length === 0) {
      if (w.mode === "leave") (gone ??= new Set()).add(w.id);
      else if (w.targetId === TARGET_WANDER) {
        if (--w.timer <= 0) pickNext(state, w, rng);
        else if (w.loiter && rng.chance(0.06)) loiterStep(state, w, rng);
      } else arrive(state, w, rng);
      continue;
    }
    advance(w);
    if (w.route.length === 0) {
      if (w.mode === "leave") (gone ??= new Set()).add(w.id);
      else arrive(state, w, rng);
    }
  }
  if (gone) state.walkers = state.walkers.filter((w) => !gone!.has(w.id));

  // Twice the footfall of the first playable; a crowd at the gate halves it.
  const crowdFactor = protesters >= CROWDING_PROTESTERS ? 0.5 : 1;
  if (visitors < visitorCap(state) && rng.chance((0.01 + state.hype * 0.0024) * crowdFactor)) spawnVisitor(state, rng);
}

export function researcherTarget(state: GameState): number {
  return 8 + 3 * state.buildings.filter((b) => b.kind === "hall").length;
}

export function agentTarget(state: GameState): number {
  return Math.min(MAX_AGENTS, 6 + Math.floor(state.capability / 2) + state.agentBonus);
}

/** Agents pour out of a Compute Cluster, researchers out of a Training Hall (or wander in from the gate if there isn't one). */
function spawnFrom(state: GameState, kind: "agent" | "researcher", rng: Rng) {
  const homes = reachableBuildings(state).filter((b) => b.kind === (kind === "agent" ? "cluster" : "hall"));
  const home = homes.length > 0 ? rng.pick(homes) : undefined;
  const door = home ? doorPoint(state, home) : null;
  const g = state.gate;
  const [x, z] = door ?? [g.x + g.w / 2, g.z + 0.6];
  const w = newWalker(state, kind, x, z, rng);
  if (home && door) {
    w.mode = "inside";
    w.targetId = home.id;
    w.timer = rng.int(1, 8);
  } else {
    w.targetId = TARGET_WANDER;
    w.timer = 1;
  }
  state.walkers.push(w);
}

/** Once per day: grow the researcher and agent populations toward their targets, a few at a time. */
export function dailyWalkers(state: GameState, rng: Rng) {
  const count = (kind: WalkerKind) => state.walkers.filter((w) => w.kind === kind).length;
  const grow = (kind: "agent" | "researcher", target: number) => {
    const deficit = target - count(kind);
    const batch = Math.min(deficit, Math.max(1, Math.ceil(deficit / 4)));
    for (let i = 0; i < batch; i++) spawnFrom(state, kind, rng);
  };
  grow("researcher", researcherTarget(state));
  grow("agent", agentTarget(state));
}

/** Population for a fresh game or a stress test: place walkers already mid-stride on the paths. */
export function seedWalkers(state: GameState, kind: WalkerKind, count: number, rng: Rng) {
  const tiles = reachablePathTiles(state);
  for (let i = 0; i < count; i++) {
    const [tx, tz] = tiles.length > 0 ? rng.pick(tiles) : [state.gate.x, state.gate.z - 1];
    const w = newWalker(state, kind, tx + 0.5, tz + 0.5, rng);
    state.walkers.push(w);
    pickNext(state, w, rng);
  }
}

export function fillAgents(state: GameState, rng: Rng) {
  const agents = state.walkers.filter((w) => w.kind === "agent").length;
  seedWalkers(state, "agent", Math.max(0, agentTarget(state) - agents), rng);
}

// Researchers, agents and visitors: who they are, where they go, what they say.
import { systemUnlocked } from "./progression";
import type { BuildingDef } from "../content/buildings";
import { agentIdentity, protesterIdentity, researcherIdentity, visitorIdentity, type Identity } from "../content/names";
import { defs } from "./defs";
import { NEEDS, NEEDS_BY_KIND, type NeedKey } from "../content/needs";
import { CROWDING_PROTESTERS, MAX_AGENTS, WALK_SPEED } from "./constants";
import { showFor } from "./demo";
import { QUIT_LINES } from "../content/toastGroups";
import { fillTemplate, formatMoney } from "./format";
import { addToast, pushNews } from "./news";
import { applyServes, gainOf, MIN_GAIN, mostUrgent, tickNeeds, urgencyOf } from "./needs";
import { addIncident, APPLICANT_VIBES } from "./vibes";
import { visitorDemand } from "./attendance";
import { chainFor, faceDoor, slotPoint, slotRoute, type Chain } from "./queues";
import { dropSlop, messTick } from "./slop";
import { CONTENT } from "./machines/mood";
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
  entranceConnected,
  gateAmble,
} from "./pathfind";
import type { EventFromLogic } from "xstate";
import { stepWalker, tourDone, walkerMachine, type WalkerPhase } from "./machines/walker";
import type { Rng } from "./rng";
import { TARGET_GATE, TARGET_WANDER, type Building, type GameState, type Point, type Walker, type WalkerKind, type WalkerMode } from "./types";

/** Chance that a walker leaving a building hangs around outside it for a bit instead of rushing off. */
const LOITER_CHANCE = 0.55;
/** How close (in tiles) a researcher passes a Fountain to get the refreshing splash. */
const FOUNTAIN_REACH = 1.6;
const FOUNTAIN_REFRESH = 0.1;
/** A building this many tiles away is worth half as much as one next door. */
const GAIN_DISTANCE = 6;
/** How long a researcher waits in a queue, in ticks; visitors wait `15 + 45 * patience`. */
const RESEARCHER_QUEUE_TICKS = 40;
/** How close (in tiles) to the tail of a line someone walking up has to be to join it there. */
const TAIL_REACH = 0.35;
/** Queuing visitors who give up lose this much patience. */
const GAVE_UP_PATIENCE = 0.15;
/** An investor who leaves at least this impressed writes a cheque. */
const INVESTOR_IMPRESSED = 0.75;

function identityFor(state: GameState, kind: WalkerKind, rng: Rng): Identity {
  switch (kind) {
    case "researcher":
      return researcherIdentity(rng, defs().names);
    case "agent":
      return agentIdentity((state.flags.agentSeq = (state.flags.agentSeq ?? 0) + 1), rng, defs().names);
    case "visitor":
      return visitorIdentity(rng, state.vibes.value, defs().names);
    default:
      return protesterIdentity(rng, defs().names);
  }
}

export function newWalker(state: GameState, kind: WalkerKind, x: number, z: number, rng: Rng): Walker {
  const who = identityFor(state, kind, rng);
  return {
    id: state.nextId++,
    kind,
    name: who.name,
    role: who.role,
    pro: who.pro,
    x,
    z,
    px: x,
    pz: z,
    dir: rng.next() * Math.PI * 2,
    route: [],
    targetId: TARGET_WANDER,
    timer: 0,
    energy: kind === "researcher" ? 0.35 + rng.next() * 0.65 : 1,
    focus: kind === "researcher" ? 0.5 + rng.next() * 0.5 : 1,
    fomo: kind === "researcher" ? rng.next() * 0.15 : 0,
    patience: kind === "visitor" ? 0.75 + rng.next() * 0.25 : 1,
    impressed: kind === "visitor" ? 0.15 + (state.vibes.value / 999) * 0.2 + rng.next() * 0.1 : 0,
    drift: kind === "agent" ? rng.next() * 0.3 : 0,
    need: "",
    lost: "",
    mood: CONTENT,
    stats: { joined: state.day, sips: 0, naps: 0, snacks: 0, demos: 0, offers: 0, rival: 0 },
    // A visitor tours 2 or 3 buildings, counting the first one they head for.
    visits: kind === "visitor" ? rng.int(2, 3) : 0,
    step: rng.int(0, 1),
    machine: { value: "arriving", context: {} },
    fountain: 0,
    homeX: x,
    homeZ: z,
    mess: 0,
    queued: 0,
    qtile: -1,
    qslot: -1,
    qrank: 0,
  };
}

const byId = (state: GameState, id: number): Building | undefined => state.buildings.find((b) => b.id === id);

/** Buildings walkers can go into: connected to the gate, not just scenery, and not out of order. */
const buildingCache = new WeakMap<GameState, { version: number; buildings: Building[]; hosts: Partial<Record<WalkerKind, Building[]>> }>();
function reachableBuildings(state: GameState): Building[] {
  const cached = buildingCache.get(state);
  if (cached?.version === state.version) return cached.buildings;
  const { buildings } = getReach(state);
  const pool = state.buildings.filter((b) => buildings.has(b.id) && !b.broken && !defs().buildings[b.kind].scenery);
  buildingCache.set(state, { version: state.version, buildings: pool, hosts: {} });
  return pool;
}

function hostsFor(state: GameState, kind: WalkerKind): Building[] {
  const pool = reachableBuildings(state);
  const cache = buildingCache.get(state)!;
  return cache.hosts[kind] ??= pool.filter((b) => defs().buildings[b.kind].hosts.includes(kind));
}

/** The old `mode` field as the renderer and thoughts see it. */
export function modeOf(w: Walker): WalkerMode {
  const phase = w.machine.value;
  return phase === "inside" ? "inside" : phase === "leaving" ? "leave" : "walk";
}

/** Put a walker straight into a phase (spawning). */
export function inPhase(w: Walker, phase: WalkerPhase) {
  w.machine = { value: phase, context: {} };
}

/** The building that best meets `need` for `w`: how much it gives (plus a little for the other needs), over how far away it is. */
function bestFor(w: Walker, pool: Building[], need: NeedKey, rng: Rng, minGain = MIN_GAIN): Building | null {
  let best: Building | null = null;
  let bestScore = 0;
  for (const b of pool) {
    const def = defs().buildings[b.kind];
    const gain = gainOf(def, w, need);
    if (gain <= 0 || gain < minGain) continue;
    let bonus = 0;
    for (const other of NEEDS_BY_KIND[w.kind]) if (other !== need) bonus += urgencyOf(w, other) * gainOf(def, w, other) * 0.3;
    const dist = Math.hypot(b.x + b.w / 2 - w.x, b.z + b.d / 2 - w.z);
    const score = ((gain + bonus) / (1 + dist / GAIN_DISTANCE)) * (0.9 + rng.next() * 0.2);
    if (score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best;
}

/**
 * RCT-style destination choice. Researchers and visitors find their most urgent need and go to the building that
 * meets it best for the distance; if nothing reachable helps, they say so ("I can't find X": `w.lost`) and carry on
 * with the day job or the tour. Agents just wander between workplaces. Sets `w.need` and `w.lost`.
 */
export function chooseTarget(state: GameState, w: Walker, rng: Rng): Building | null {
  w.need = "";
  const reachable = hostsFor(state, w.kind);
  if (reachable.length === 0) return null;
  // Somewhere new, unless the one they just left is the only choice.
  const away = reachable.filter((b) => b.id !== w.targetId);
  const pool = away.length > 0 ? away : reachable;
  if (w.kind === "agent") {
    w.need = "work";
    return rng.pick(pool);
  }
  if (w.kind === "visitor") {
    if (urgencyOf(w, "patience") >= NEEDS.patience.urgentAt) {
      const rest = bestFor(w, pool, "patience", rng);
      if (rest) {
        w.need = "patience";
        return rest;
      }
    }
    w.need = "tour";
    // Anyone who came to be impressed and can't find a show says so.
    w.lost = w.impressed < 0.5 && !reachable.some((b) => defs().buildings[b.kind].show) ? "impressed" : "";
    return bestFor(w, pool, "impressed", rng, 0) ?? rng.pick(pool);
  }
  // Researchers.
  w.lost = "";
  const worst = mostUrgent(w);
  if (worst && worst.urgency >= NEEDS[worst.need].urgentAt) {
    const helpers = reachable.filter((b) => gainOf(defs().buildings[b.kind], w, worst.need) >= MIN_GAIN);
    if (helpers.length === 0) w.lost = worst.need;
    else {
      const elsewhere = helpers.filter((b) => b.id !== w.targetId);
      const best = bestFor(w, elsewhere.length > 0 ? elsewhere : helpers, worst.need, rng);
      if (best) {
        w.need = worst.need;
        return best;
      }
    }
  }
  w.need = "work";
  const wanted = w.step % 2 === 0 ? "hall" : "cluster";
  const workplaces = pool.filter((b) => b.kind === wanted);
  return rng.pick(workplaces.length > 0 ? workplaces : pool);
}

function startRoute(state: GameState, w: Walker, target: Building): boolean {
  const route = routeToRect(state, w.x, w.z, target);
  if (!route) return false;
  w.route = route;
  w.targetId = target.id;
  return true;
}

function startLeave(state: GameState, w: Walker) {
  const route = routeToRect(state, w.x, w.z, state.gate, true);
  w.route = route ?? [];
  w.targetId = TARGET_GATE;
  if (!route) w.route = [[w.x, w.z]];
}

function wander(state: GameState, w: Walker, rng: Rng) {
  w.targetId = TARGET_WANDER;
  w.route = [];
  w.timer = state.progression ? 1 : rng.int(6, 16);
  const tiles = reachablePathTiles(state);
  if (tiles.length === 0) return;
  const away = tiles.filter(([x, z]) => Math.abs(x + 0.5 - w.x) + Math.abs(z + 0.5 - w.z) >= 2);
  const [gx, gz] = rng.pick(away.length ? away : tiles);
  const route = bfsRoute(state, [Math.floor(w.x), Math.floor(w.z)], new Set([tileIndex(state, gx, gz)]));
  if (route) w.route = route.map(([x, z]): Point => [x + 0.5, z + 0.5]);
}

/** The world work behind a PICK: route to a building, or wander when there is nowhere to go. */
function pick(state: GameState, w: Walker, rng: Rng): "seeking" | "wandering" {
  const target = chooseTarget(state, w, rng);
  const stroll = !!state.progression && state.progression.context.level <= 2 && w.kind === "researcher" && w.need === "work" && hostsFor(state, w.kind).filter((b) => b.kind === "cluster" || b.kind === "hall").length < 2 && rng.chance(0.35);
  if (!stroll && target && startRoute(state, w, target)) return "seeking";
  w.need = "";
  wander(state, w, rng);
  return "wandering";
}

const exiting = (phase: WalkerPhase) => phase === "leaving" || phase === "quitting";

/** Send a walker's machine an event, then do the world work the state it entered implies (see machines/walker.ts). */
function send(state: GameState, w: Walker, rng: Rng, event: EventFromLogic<typeof walkerMachine>) {
  const before = w.machine.value;
  w.machine = stepWalker(w.machine, event);
  const phase = w.machine.value;
  // `need` is what they're on their way for; once they are in, out or off, it no longer applies.
  if (phase !== "seeking" && phase !== "arriving" && phase !== "queuing" && phase !== "choosing") w.need = "";
  switch (phase) {
    case "choosing":
      send(state, w, rng, { type: pick(state, w, rng) === "seeking" ? "CHOSE_BUILDING" : "CHOSE_WANDER" });
      break;
    case "loitering":
      if (before === "inside") startLoiter(w, rng);
      break;
    case "leaving":
      if (before !== "leaving") {
        startLeave(state, w);
        if (w.kind === "visitor") departVisitor(state, w, rng);
      }
      break;
    case "quitting":
      if (before !== "quitting") startLeave(state, w);
      break;
  }
}

/** A researcher has had enough: box, gate, headline (the headline waits until they reach the gate). */
export function resign(state: GameState, w: Walker, rng: Rng) {
  send(state, w, rng, { type: "QUIT" });
}

/** An investor who liked what they saw leaves a cheque on the way out; everyone else just goes. */
function departVisitor(state: GameState, w: Walker, rng: Rng) {
  if (w.role !== "Venture Capitalist" || w.impressed < INVESTOR_IMPRESSED) return;
  const amount = Math.round((20 + state.capability * 2) / 5) * 5_000;
  state.cash += amount;
  const g = state.gate;
  state.pops.push({ id: state.nextId++, x: g.x + g.w / 2, z: g.z, amount, tick: state.tick });
  pushNews(state, rng, "investorPays", { name: w.name, amount: formatMoney(amount) });
  addToast(state, `${w.name} loved it: ${formatMoney(amount)} in the bank`, "good", { source: "economy" });
}

/** They reached the gate with the box: the headline, the toast, the dent in the Vibes. */
function walkOut(state: GameState, w: Walker, rng: Rng) {
  // A pack that walked them out (the `people.quit` verb, quietly) writes its own exit.
  if (state.flags[`quietExit:${w.id}`] !== undefined) {
    delete state.flags[`quietExit:${w.id}`];
    addIncident(state, 0.15);
    return;
  }
  pushNews(state, rng, "researcherLeft", { name: w.name, their: defs().names.THEIR[w.pro] ?? "their" });
  const line = QUIT_LINES[w.id % QUIT_LINES.length]!;
  addToast(state, fillTemplate(line, { name: w.name, their: defs().names.THEIR[w.pro] ?? "their" }), "bad", { source: "staff", importance: "you", group: { kind: "quit", who: w.name } });
  addIncident(state, 0.15);
}

/** Time to pick the next stop. A visitor whose tour is done (or whose patience is) leaves; one who goes on uses up a visit. */
function pickNext(state: GameState, w: Walker, rng: Rng) {
  if (tourDone(w.kind, w.visits, w.patience)) return send(state, w, rng, { type: "TOUR_DONE" });
  if (w.kind === "visitor") w.visits--;
  send(state, w, rng, { type: "NEXT" });
}

/** Step out of the building and stand around near its door for a while. */
function startLoiter(w: Walker, rng: Rng) {
  w.targetId = TARGET_WANDER;
  w.route = [];
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
  if (rng.chance(LOITER_CHANCE)) send(state, w, rng, { type: "LINGER" });
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

/** How many researchers and visitors are inside each building right now (agents walk through walls and don't count). */
type Occupancy = Map<number, number>;
const occupancy: Occupancy = new Map();

/** The people waiting outside one full building, in the order they joined (kept between ticks so a busy line does not allocate). */
interface Waiting {
  building: Building | undefined;
  list: Walker[];
  /** Each line that has formed (keyed by entrance tile) and how long it is; where its tail stands is worked out when someone walks up. */
  ends: { tile: number; n: number; max: number; chain: Chain | null; x: number; z: number; known: boolean }[];
}
const queues = new Map<number, Waiting>();
/** How many of `queues` have anybody in them this tick. */
let waiting = 0;

function fillOccupancy(state: GameState) {
  occupancy.clear();
  waiting = 0;
  for (const q of queues.values()) {
    q.list.length = 0;
    q.ends.length = 0;
  }
  for (const w of state.walkers) {
    if (w.kind === "agent") continue;
    const phase = w.machine.value;
    if (phase === "inside") occupancy.set(w.targetId, (occupancy.get(w.targetId) ?? 0) + 1);
    else if (phase === "queuing") {
      let q = queues.get(w.targetId);
      if (!q) queues.set(w.targetId, (q = { building: undefined, list: [], ends: [] }));
      if (q.list.length === 0) {
        waiting++;
        q.building = byId(state, w.targetId);
      }
      q.list.push(w);
    }
  }
  if (waiting === 0) return;
  for (const q of queues.values()) {
    const list = q.list;
    if (list.length === 0) continue;
    if (list.length > 1) list.sort((x, y) => x.queued - y.queued || x.id - y.id);
    const ends = q.ends;
    for (const w of list) {
      let end = ends.find((e) => e.tile === w.qtile);
      if (!end) {
        const chain = chainFor(state, q.building?.id ?? -1, w.qtile);
        ends.push((end = { tile: w.qtile, n: 0, max: (chain?.slots.length ?? 1) - 1, chain, x: 0, z: 0, known: false }));
      }
      // Past the end of the path everybody shares the last place, so only the front of a long line ever shuffles.
      w.qrank = Math.min(end.n++, end.max);
    }
  }
}

const hasRoom = (b: Building) => (occupancy.get(b.id) ?? 0) < defs().buildings[b.kind].capacity;

/** How many people are waiting outside a building (for the "n waiting" label and the ticker). */
export function queueLength(state: GameState, id: number): number {
  let n = 0;
  for (const w of state.walkers) if (w.machine.value === "queuing" && w.targetId === id) n++;
  return n;
}

/** Let a walker into a building: the stay starts, the needs refill, the personnel file grows. */
function enter(state: GameState, w: Walker, rng: Rng, b: Building, event: "ARRIVED" | "ADMITTED") {
  const def: BuildingDef = defs().buildings[b.kind];
  w.timer = rng.int(def.stay[0], def.stay[1]);
  w.step++;
  w.route = [];
  w.qslot = -1;
  if (w.kind !== "agent") occupancy.set(b.id, (occupancy.get(b.id) ?? 0) + 1);
  send(state, w, rng, { type: event });
  // A show works or flops for the whole audience; agents only watch.
  applyServes(w, def, def.show && w.kind === "visitor" ? showFor(state, rng, b) : 1);
  if (def.tally && w.kind !== "agent") w.stats[def.tally]++;
  // Level 2's goal counts visitors let in somewhere, not the ones who gave up in a queue (FLT-58); only while it is the goal.
  if (w.kind === "visitor" && state.progression?.context.level === 2) state.flags.visitorsServed = (state.flags.visitorsServed ?? 0) + 1;
}

/** Join the line at the tail: the tick they got there, the entrance tile the line forms on, and no place in it yet. */
function joinLine(state: GameState, w: Walker, rng: Rng, tile: number) {
  w.timer = w.kind === "visitor" ? Math.round(15 + 45 * w.patience) : RESEARCHER_QUEUE_TICKS;
  w.queued = state.tick;
  w.qtile = tile;
  w.qslot = -1;
  send(state, w, rng, { type: "QUEUED" });
}

function arrive(state: GameState, w: Walker, rng: Rng) {
  if (exiting(w.machine.value)) return; // handled by the caller: they leave the World
  if (w.targetId === TARGET_WANDER) {
    if (w.timer <= 0) w.timer = rng.int(6, 16);
    return;
  }
  const b = byId(state, w.targetId);
  if (!b || b.broken) return pickNext(state, w, rng);
  if (w.kind !== "agent" && !hasRoom(b)) return joinLine(state, w, rng, tileIndex(state, Math.floor(w.x), Math.floor(w.z)));
  enter(state, w, rng, b, "ARRIVED");
}

/** Someone walking up to a building with a line stops at the tail of it instead of pushing in at the door. */
function meetTail(state: GameState, w: Walker, rng: Rng): boolean {
  const q = queues.get(w.targetId);
  if (!q || q.list.length === 0) return false;
  for (const end of q.ends) {
    const chain = end.chain;
    if (!chain) continue;
    if (!end.known) {
      [end.x, end.z] = slotPoint(state, chain, Math.min(end.n, end.max));
      end.known = true;
    }
    const dx = w.x - end.x;
    const dz = w.z - end.z;
    if (dx * dx + dz * dz > TAIL_REACH * TAIL_REACH) continue;
    joinLine(state, w, rng, end.tile);
    // They are already there: the place they stand in is the one they stopped at, facing the door like the rest.
    w.qslot = w.qrank = Math.min(end.n, end.max);
    w.route = [];
    end.n++;
    w.dir = faceDoor(state, chain, w.qslot);
    [end.x, end.z] = slotPoint(state, chain, Math.min(end.n, end.max));
    q.list.push(w);
    return true;
  }
  return false;
}

/** In line: the front of it gets in when there is room, everyone else shuffles up; patience runs out and they wander off. */
function tickQueue(state: GameState, w: Walker, rng: Rng) {
  const q = queues.get(w.targetId);
  const b = q?.building;
  if (!q || !b || b.broken) return pickNext(state, w, rng);
  if (q.list[0] === w && hasRoom(b)) {
    q.list.shift();
    return enter(state, w, rng, b, "ADMITTED");
  }
  // Take a place in the line, and move up when it does.
  const rank = w.qrank;
  if (w.qslot !== rank) {
    const chain = chainFor(state, b.id, w.qtile);
    if (chain) {
      const [sx, sz] = slotPoint(state, chain, rank);
      w.route = w.qslot >= 0 ? slotRoute(state, chain, w.qslot, rank) : Math.hypot(w.x - sx, w.z - sz) < 0.7 ? [[sx, sz]] : slotRoute(state, chain, -1, rank);
    }
    w.qslot = rank;
  }
  if (w.route.length > 0) {
    advance(w);
    // Arrived at their place: turn to face the door (or whoever is in front).
    if (w.route.length === 0) {
      const chain = chainFor(state, b.id, w.qtile);
      if (chain) w.dir = faceDoor(state, chain, rank);
    }
  }
  if (--w.timer > 0) return;
  if (w.kind === "visitor") w.patience = Math.max(0, w.patience - GAVE_UP_PATIENCE);
  w.qslot = -1;
  w.route = [];
  state.flags.queueQuits = (state.flags.queueQuits ?? 0) + 1;
  send(state, w, rng, { type: "GAVE_UP" });
}

/** Someone who couldn't find what they wanted stops saying so the moment a building that helps is connected. */
function found(state: GameState, w: Walker): boolean {
  if (!w.lost) return false;
  const need = w.lost;
  return reachableBuildings(state).some((b) => defs().buildings[b.kind].hosts.includes(w.kind) && gainOf(defs().buildings[b.kind], w, need) >= MIN_GAIN);
}

/** Walkers caught out by a change to paths or buildings find a new way. */
function repairWalkers(state: GameState, rng: Rng, grew: boolean) {
  for (const w of state.walkers) {
    if (w.kind === "protester") continue; // they stand on grass; protest.ts looks after them
    if (found(state, w)) w.lost = "";
    if (grew && (w.machine.value === "wandering" || w.machine.value === "loitering")) {
      wander(state, w, rng);
      w.machine = stepWalker(w.machine, { type: "NEXT" });
      w.machine = stepWalker(w.machine, { type: "CHOSE_WANDER" });
    }
    if (w.machine.value === "inside") {
      const home = byId(state, w.targetId);
      if (home && !home.broken) continue;
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
    const target = w.targetId > 0 ? byId(state, w.targetId) : undefined;
    const targetGone = w.targetId > 0 && (!target || target.broken);
    if (!routeBroken && !targetGone) continue;
    w.px = w.x;
    w.pz = w.z;
    if (exiting(w.machine.value)) startLeave(state, w);
    else pickNext(state, w, rng);
  }
}

export function advance(w: Walker) {
  let budget = WALK_SPEED;
  while (budget > 1e-9 && w.route.length > 0) {
    const [tx, tz] = w.route[0]!;
    const dx = tx - w.x;
    const dz = tz - w.z;
    // Tile-space distances are small: avoid hypot's overflow scaling in the hottest 800-walker loop.
    const dist = Math.sqrt(dx * dx + dz * dz);
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

/** A newcomer through the gate: a visitor touring, or an applicant heading for a Training Hall. Null if there is nowhere to go. */
function spawnFromGate(state: GameState, kind: "visitor" | "researcher", rng: Rng): Walker | null {
  const targets = reachableBuildings(state).filter((b) => (kind === "researcher" ? b.kind === "hall" : defs().buildings[b.kind].hosts.includes(kind)));
  const linked = getReach(state).tiles;
  const mouth = entrances(state, state.gate).filter((e) => linked[tileIndex(state, e.x, e.z)]);
  if (targets.length === 0 || mouth.length === 0) return null;
  const g = state.gate;
  const w = newWalker(state, kind, g.x + g.w / 2, g.z + 0.6, rng);
  const target = kind === "visitor" ? (chooseTarget(state, w, rng) ?? rng.pick(targets)) : rng.pick(targets);
  const e = rng.pick(mouth);
  const route = routeToRect(state, e.x + 0.5, e.z + 0.5, target);
  if (!route) return null;
  w.route = route;
  w.targetId = target.id;
  w.need = kind === "visitor" ? "tour" : "work";
  if (kind === "visitor") w.visits--;
  state.walkers.push(w);
  return w;
}

export function visitorCap(state: GameState): number {
  return visitorDemand(state).cap;
}

/** Walkers that reached the gate on their way out: the machine finishes, then they leave the World. */
export function despawn(state: GameState, ids: ReadonlySet<number>) {
  for (const w of state.walkers) if (ids.has(w.id)) w.machine = stepWalker(w.machine, { type: "EXITED" });
  state.walkers = state.walkers.filter((w) => !ids.has(w.id));
}

export function updateWalkers(state: GameState, rng: Rng) {
  if (state.flags.walkerVersion !== state.version) {
    state.flags.walkerVersion = state.version;
    const paths = getReach(state).tiles.filter(Boolean).length;
    const grew = state.flags.walkerPathCount !== undefined && paths > state.flags.walkerPathCount;
    state.flags.walkerPathCount = paths;
    repairWalkers(state, rng, grew);
  }
  fillOccupancy(state);
  const slopOn = systemUnlocked(state, "slop");
  const disconnected = !entranceConnected(state);
  const fountains = state.buildings.filter((b) => b.kind === "fountain");
  let gone: Set<number> | null = null;
  for (const w of state.walkers) {
    if (w.kind === "protester") {
      continue;
    }
    w.px = w.x;
    w.pz = w.z;
    if (disconnected && w.machine.value !== "inside" && !exiting(w.machine.value)) {
      // The existing wandering phase owns this wait; reconsider destinations on reconnection/version change.
      if (w.machine.value !== "wandering") send(state, w, rng, { type: "NEXT" });
      w.targetId = TARGET_WANDER;
      if (w.route.length === 0 || state.tick % 12 === 0) w.route = gateAmble(state, w.id);
      advance(w);
      continue;
    }
    tickNeeds(w, state.capability);
    // Slop (sim/slop.ts): drifted agents drop it, everyone else gets a little grumpier for standing in it.
    if (w.kind === "agent") {
      if (slopOn && (state.tick + w.id) % 7 === 0) dropSlop(state, w);
    } else if (slopOn) messTick(state, w);
    if (w.kind === "researcher" && fountains.length > 0 && w.machine.value !== "inside") passFountains(w, fountains);
    const phase = w.machine.value;
    if (phase === "inside") {
      if (--w.timer <= 0) finishStay(state, w, rng);
      continue;
    }
    if (phase === "queuing") {
      tickQueue(state, w, rng);
      continue;
    }
    // A line has formed at the place they are heading for: they stop at the back of it.
    if (waiting > 0 && w.targetId > 0 && w.kind !== "agent" && (phase === "seeking" || phase === "arriving") && meetTail(state, w, rng)) continue;
    if (w.route.length === 0) {
      if (exiting(phase)) (gone ??= new Set()).add(w.id);
      else if (w.targetId === TARGET_WANDER) {
        if (--w.timer <= 0) pickNext(state, w, rng);
        else if (phase === "loitering" && rng.chance(0.06)) loiterStep(state, w, rng);
      } else arrive(state, w, rng);
      continue;
    }
    advance(w);
    if (w.route.length === 0) {
      if (exiting(phase)) (gone ??= new Set()).add(w.id);
      else arrive(state, w, rng);
    }
  }
  if (gone) {
    for (const w of state.walkers) if (gone.has(w.id) && w.machine.value === "quitting") walkOut(state, w, rng);
    despawn(state, gone);
  }

}

const hallCount = (state: GameState) => state.buildings.filter((b) => b.kind === "hall").length;

/** Researchers a new campus starts with. */
export const researchersAtStart = (_state: GameState) => 3;

/** How many researchers the halls can seat: applicants keep coming (Vibes permitting) until the lab is this big. */
export function researcherTarget(state: GameState): number {
  return 3 + 4 * hallCount(state);
}

export function agentTarget(state: GameState): number {
  return Math.min(MAX_AGENTS, 1 + Math.floor(Math.max(0, state.capability - 10) / 2) + state.agentBonus);
}

/** Agents pour out of a Compute Cluster (or wander in from the gate if there isn't one). */
function spawnAgent(state: GameState, rng: Rng) {
  const homes = reachableBuildings(state).filter((b) => b.kind === "cluster");
  const home = homes.length > 0 ? rng.pick(homes) : undefined;
  const door = home ? doorPoint(state, home) : null;
  const g = state.gate;
  const [x, z] = door ?? [g.x + g.w / 2, g.z + 0.6];
  const w = newWalker(state, "agent", x, z, rng);
  if (home && door) {
    inPhase(w, "inside");
    w.targetId = home.id;
    w.timer = rng.int(1, 8);
  } else {
    w.targetId = TARGET_WANDER;
    w.timer = 1;
  }
  state.walkers.push(w);
}

/** Good Vibes and room in a Training Hall bring applicants to the gate, a few a day at most. */
function admitApplicants(state: GameState, rng: Rng, researchers: number) {
  const vibes = state.vibes.value;
  const room = researcherTarget(state) - researchers;
  if (vibes <= APPLICANT_VIBES || room <= 0) return;
  const batch = Math.min(room, 1 + Math.floor((vibes - APPLICANT_VIBES) / 300));
  for (let i = 0; i < batch; i++) {
    if (!rng.chance(Math.min(1, (0.5 + vibes / 2000) * (state.recruitingPull ?? 1)))) continue;
    const w = spawnFromGate(state, "researcher", rng);
    if (w && state.recruitingPull !== undefined) w.focus = Math.min(1, w.focus + Math.max(0, state.recruitingPull - 1) * 0.1);
    if (w && rng.chance(0.35)) pushNews(state, rng, "applicant", { name: w.name });
  }
}

/** Once per day: grow the researcher and agent populations toward their targets, a few at a time. */
export function dailyWalkers(state: GameState, rng: Rng) {
  const count = (kind: WalkerKind) => state.walkers.filter((w) => w.kind === kind).length;
  const deficit = agentTarget(state) - count("agent");
  const batch = Math.min(deficit, Math.max(1, Math.ceil(deficit / 4)));
  for (let i = 0; i < batch; i++) spawnAgent(state, rng);
  admitApplicants(state, rng, count("researcher"));
  if (state.flags.firstGateway === undefined && !state.buildings.some((b) => b.kind === "gateway")) return;
  const demand = visitorDemand(state);
  const crowdFactor = count("protester") >= CROWDING_PROTESTERS ? 0.5 : 1;
  const rate = demand.perDay * crowdFactor;
  const arrivals = Math.floor(rate) + (rng.chance(rate % 1) ? 1 : 0);
  const room = Math.max(0, demand.cap - count("visitor"));
  for (let i = 0; i < Math.min(room, arrivals); i++) spawnFromGate(state, "visitor", rng);
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

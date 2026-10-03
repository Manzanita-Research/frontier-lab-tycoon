// Staff (FLT-10): the payroll. Every staffer is a little walker with a machine of their own (machines/staff.ts) and,
// like an RCT handyman, an optional painted patrol zone: with one, they only look for work inside it. This is the
// driver: it finds jobs, walks people to them and does the world work each phase implies; the machine only
// says what phase someone is in.
//
//   Janitor Bot: walks to the nearest slopped path tile and mops it.
//   SRE:         walks to the nearest broken building and fixes it (2 to 4 game hours once there).
//   Comms Rep:   walks up to a protester and hands them a tote bag; each one also takes 2 discourse off every day (protest.ts).
//   Security:    walks the fence. It is the hook for catching escaped agents (FLT-5): see `guardsOn`.
import { staffUnlocked } from "./progression";
import { MAX_PER_JOB, MAX_STAFF, STAFF } from "../content/staff";
import { repairBuilding } from "./breakdowns";
import { fillTemplate } from "./format";
import { stepStaff, staffStart } from "./machines/staff";
import { addToast, pushNews } from "./news";
import { bfsRoute, entrances, getReach, inBounds, isPathTile, nearestPathTile, routeToRect, tileIndex, entranceConnected, gateAmble } from "./pathfind";
import { mopTile } from "./slop";
import type { Rng } from "./rng";
import type { EventFromLogic } from "xstate";
import type { staffMachine } from "./machines/staff";
import type { Building, GameState, Point, Rect, StaffJob, Staffer } from "./types";
import { defs } from "./defs";
import { toteBagFor } from "./factions/driver";
import { datan2, dhypot, sq } from "./dmath";

/** Look for something to do this often when idle (in ticks). */
const SCAN_TICKS = 3;
/** A Comms Rep stops this far from the protester they are talking to. */
const TOTE_REACH = 0.8;
/** A Comms Rep with a patrol zone only talks to protesters this close (in tiles) to it. */
const ZONE_REACH = 3;
/** How close a protester must still be when the Rep arrives, or they have wandered off and it is back to looking. */
const TOTE_TOLERANCE = 1.6;
/** The route a Security guard walks, just inside the fence and round the gate (tile units). */
export const FENCE: readonly Point[] = [
  [0.45, 0.45], [12, 0.45], [23.55, 0.45], [23.55, 12], [23.55, 23.55], [13.6, 23.55], [13.6, 22.45], [10.4, 22.45], [10.4, 23.55], [0.45, 23.55], [0.45, 12],
];

export const staffOf = (state: GameState, job: StaffJob): Staffer[] => state.staff.filter((s) => s.job === job);

/** Total salaries, per game day. */
export const payroll = (state: GameState): number => state.staff.reduce((sum, s) => sum + STAFF[s.job].salary, 0);

/** Each Comms Rep takes this much off the water discourse every day there are protesters at the gate. */
export const COMMS_RELIEF = 2;

/** Discourse a day the Comms Reps talk down: nothing when there is nobody to talk to. */
export const commsRelief = (state: GameState): number => (state.walkers.some((w) => w.kind === "protester") ? COMMS_RELIEF * staffOf(state, "comms").filter((s) => s.machine.value !== "leaving" && !s.divert).length : 0);

/** How many Security guards are on the fence (the hook FLT-5's escaped agents look for). One pulled off by a disaster is not. */
export const guardsOn = (state: GameState): number => staffOf(state, "security").filter((s) => !s.divert).length;

export const inZone = (s: Staffer, tile: number): boolean => s.zone.length === 0 || s.zone.includes(tile);

type StaffEvent = EventFromLogic<typeof staffMachine>;
const send = (s: Staffer, event: StaffEvent) => {
  s.machine = stepStaff(s.machine, event);
};

/** Can this job be filled right now? A reason if not. */
export function canHire(state: GameState, job: StaffJob): { ok: true } | { ok: false; reason: string } {
  if (!staffUnlocked(state, job)) return { ok: false, reason: "Meet your next goal to unlock this job" };
  if (state.staff.length >= MAX_STAFF) return { ok: false, reason: "The office is full" };
  if (staffOf(state, job).length >= MAX_PER_JOB) return { ok: false, reason: `That's plenty of ${STAFF[job].title}s` };
  return { ok: true };
}

/** Someone new through the gate. Deterministic: a name in hiring order, and no random numbers. */
export function hire(state: GameState, job: StaffJob) {
  if (!canHire(state, job).ok) return;
  const def = STAFF[job];
  const serial = (state.flags[`hired:${job}`] = (state.flags[`hired:${job}`] ?? 0) + 1);
  const name = fillTemplate(def.names[(serial - 1) % def.names.length]!, { n: String(serial) });
  const g = state.gate;
  const x = g.x + g.w / 2;
  const z = g.z + 0.6;
  const linked = getReach(state).tiles;
  const mouth = entrances(state, g).find((e) => linked[tileIndex(state, e.x, e.z)]);
  state.staff.push({
    id: state.nextId++,
    job,
    name,
    x,
    z,
    px: x,
    pz: z,
    dir: Math.PI,
    route: mouth ? [[mouth.x + 0.5, mouth.z + 0.5]] : [],
    timer: 0,
    task: job === "security" ? nearestFence(x, z - 1) : 0,
    last: 0,
    hired: state.day,
    done: 0,
    zone: [],
    machine: staffStart(),
  });
  addToast(state, fillTemplate(def.hired, { name }), "good", { source: "staff", importance: "you" });
}

/** Let someone go: they walk back to the gate with a box. */
export function fire(state: GameState, id: number) {
  const s = state.staff.find((o) => o.id === id);
  if (!s || s.machine.value === "leaving") return;
  send(s, { type: "FIRED" });
  delete s.divert;
  s.task = 0;
  const g = state.gate;
  const route = routeToRect(state, ...fromTile(state, s), g, true);
  s.route = route ?? [[g.x + g.w / 2, g.z]];
  addToast(state, fillTemplate(STAFF[s.job].fired, { name: s.name }), "neutral", { source: "staff", importance: "you" });
}

/** Paint (or erase) one tile of a staffer's patrol zone. */
export function paintZone(state: GameState, id: number, x: number, z: number, on: boolean) {
  const s = state.staff.find((o) => o.id === id);
  if (!s || !inBounds(state, x, z)) return;
  const i = tileIndex(state, x, z);
  const has = s.zone.includes(i);
  if (on && !has) s.zone = [...s.zone, i].sort((a, b) => a - b);
  else if (!on && has) s.zone = s.zone.filter((t) => t !== i);
  else return;
  rethink(s);
}

/** A change to the patrol zone: anyone just strolling drops the walk they were on and looks again. */
function rethink(s: Staffer) {
  if (s.machine.value !== "idle") return;
  s.route = [];
  s.timer = 0;
}

export function clearZone(state: GameState, id: number) {
  const s = state.staff.find((o) => o.id === id);
  if (!s) return;
  s.zone = [];
  rethink(s);
}

/** The tile to route from: where they stand if it is a path, else the nearest path. */
function fromTile(state: GameState, s: Staffer): [number, number] {
  const tx = Math.floor(s.x);
  const tz = Math.floor(s.z);
  if (isPathTile(state, tx, tz)) return [tx + 0.5, tz + 0.5];
  const p = nearestPathTile(state, s.x, s.z);
  return p ? [p[0] + 0.5, p[1] + 0.5] : [s.x, s.z];
}

function pathRoute(state: GameState, s: Staffer, goals: Set<number>): Point[] | null {
  const [fx, fz] = fromTile(state, s);
  const tiles = bfsRoute(state, [Math.floor(fx), Math.floor(fz)], goals);
  return tiles ? tiles.map(([x, z]): Point => [x + 0.5, z + 0.5]) : null;
}

const nearestFence = (x: number, z: number): number => {
  let best = 0;
  let bestD = Infinity;
  FENCE.forEach(([fx, fz], i) => {
    const d = sq(fx - x) + sq(fz - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
};

const claimed = (state: GameState, s: Staffer, task: number) => state.staff.some((o) => o !== s && o.job === s.job && o.task === task && (o.machine.value === "going" || o.machine.value === "working"));

interface Job {
  task: number;
  route: Point[];
}

function janitorJob(state: GameState, s: Staffer): Job | null {
  const reach = getReach(state).tiles;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < state.slop.length; i++) {
    if (!(state.slop[i]! > 0) || !reach[i] || !inZone(s, i) || claimed(state, s, i)) continue;
    const d = sq(i % state.grid.w + 0.5 - s.x) + sq(Math.floor(i / state.grid.w) + 0.5 - s.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) return null;
  const route = pathRoute(state, s, new Set([best]));
  return route ? { task: best, route } : null;
}

/** Any of a building's entrance tiles in the zone counts as "in the zone". */
const buildingInZone = (state: GameState, s: Staffer, b: Building) => s.zone.length === 0 || entrances(state, b).some((e) => s.zone.includes(tileIndex(state, e.x, e.z)));

function sreJob(state: GameState, s: Staffer): Job | null {
  const reach = getReach(state).buildings;
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of state.buildings) {
    if (!b.broken || !reach.has(b.id) || claimed(state, s, b.id) || !buildingInZone(state, s, b)) continue;
    const d = sq(b.x + b.w / 2 - s.x) + sq(b.z + b.d / 2 - s.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (!best) return null;
  const [fx, fz] = fromTile(state, s);
  const route = routeToRect(state, fx, fz, best);
  return route ? { task: best.id, route } : null;
}

function commsJob(state: GameState, s: Staffer): Job | null {
  let best: { id: number; x: number; z: number } | null = null;
  let bestD = Infinity;
  for (const w of state.walkers) {
    if (w.kind !== "protester" || w.id === s.last || claimed(state, s, w.id)) continue;
    const d = sq(w.x - s.x) + sq(w.z - s.z);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  if (!best) return null;
  // Walk the path to the tile nearest them, then cross the grass.
  const reach = getReach(state).tiles;
  let goal = -1;
  let goalD = Infinity;
  for (let i = 0; i < reach.length; i++) {
    if (!reach[i] || !inZone(s, i)) continue;
    const d = sq(i % state.grid.w + 0.5 - best.x) + sq(Math.floor(i / state.grid.w) + 0.5 - best.z);
    if (d < goalD) {
      goalD = d;
      goal = i;
    }
  }
  // With a patrol zone they only go to protesters who are close to it: it is their patch.
  if (goal < 0 || (s.zone.length > 0 && goalD > sq(ZONE_REACH))) return null;
  const route = pathRoute(state, s, new Set([goal]));
  if (!route) return null;
  const [gx, gz] = route[route.length - 1]!;
  const dist = dhypot(best.x - gx, best.z - gz);
  if (dist > TOTE_REACH) route.push([best.x + ((gx - best.x) / dist) * TOTE_REACH, best.z + ((gz - best.z) / dist) * TOTE_REACH]);
  return { task: best.id, route };
}

function findJob(state: GameState, s: Staffer): Job | null {
  switch (s.job) {
    case "janitor":
      return janitorJob(state, s);
    case "sre":
      return sreJob(state, s);
    case "comms":
      return commsJob(state, s);
    default:
      return null;
  }
}

/** Nothing to do: stroll. Security walk the fence (or their zone); everyone else wanders their zone or the campus. */
function patrol(state: GameState, s: Staffer, rng: Rng) {
  if (s.job === "security" && s.zone.length === 0) {
    const [fx, fz] = FENCE[s.task % FENCE.length]!;
    s.route = [[fx, fz]];
    s.task = (s.task + 1) % FENCE.length;
    return;
  }
  if (s.job === "comms" && !state.walkers.some((w) => w.kind === "protester")) {
    const spot = state.buildings.find((b) => b.kind === "kombucha") ?? state.buildings.find((b) => b.kind === "gateway");
    const zoned = s.zone.find((i) => getReach(state).tiles[i]);
    const route = zoned !== undefined ? pathRoute(state, s, new Set([zoned])) : spot ? routeToRect(state, ...fromTile(state, s), spot) : pathRoute(state, s, new Set([tileIndex(state, 11, 19)]));
    if (route) s.route = route;
    return;
  }
  const reach = getReach(state).tiles;
  const tiles: number[] = [];
  if (s.zone.length > 0) {
    for (const i of s.zone) if (reach[i]) tiles.push(i);
  } else {
    for (let i = 0; i < reach.length; i++) if (reach[i]) tiles.push(i);
  }
  if (tiles.length === 0) return;
  const goal = rng.pick(tiles);
  const route = pathRoute(state, s, new Set([goal]));
  if (route) s.route = route;
}

const isTarget = (state: GameState, s: Staffer): boolean => {
  switch (s.job) {
    case "janitor":
      return (state.slop[s.task] ?? 0) > 0;
    case "sre":
      return state.buildings.some((b) => b.id === s.task && b.broken);
    case "comms":
      return state.walkers.some((w) => w.id === s.task && w.kind === "protester");
    default:
      return false;
  }
};

/** Move along the route at the job's pace (times `mul`: a diverted staffer jogs); faces the way they go. */
function move(s: Staffer, mul = 1) {
  let budget = STAFF[s.job].speed * mul;
  while (budget > 1e-9 && s.route.length > 0) {
    const [tx, tz] = s.route[0]!;
    const dx = tx - s.x;
    const dz = tz - s.z;
    const dist = dhypot(dx, dz);
    if (dist > 1e-6) s.dir = datan2(dx, dz);
    if (dist <= budget) {
      s.x = tx;
      s.z = tz;
      budget -= dist;
      s.route.shift();
    } else {
      s.x += (dx / dist) * budget;
      s.z += (dz / dist) * budget;
      budget = 0;
    }
  }
}

/** The world work of a finished job. */
function finish(state: GameState, rng: Rng, s: Staffer) {
  switch (s.job) {
    case "janitor":
      // A full tile comes clean in one go: the mop goes back and forth until the sparkle is gone.
      while (mopTile(state, s.task));
      state.flags.mopped = (state.flags.mopped ?? 0) + 1;
      break;
    case "sre": {
      const b = state.buildings.find((o) => o.id === s.task);
      if (b?.broken) {
        repairBuilding(state, b);
        state.flags.lastRepaired = b.id;
        // Level 3's goal wants a fix (FLT-58); counted only while it is the goal.
        if (state.progression?.context.level === 3) state.flags.repaired = (state.flags.repaired ?? 0) + 1;
        pushNews(state, rng, "repaired");
      }
      break;
    }
    case "comms": {
      const w = state.walkers.find((o) => o.id === s.task);
      state.flags.totes = (state.flags.totes ?? 0) + 1;
      if (w && state.flags.totes % 3 === 1) pushNews(state, rng, "tote");
      if (w?.crowd !== undefined) toteBagFor(state, w.crowd);
      break;
    }
  }
  s.done++;
  s.last = s.task;
  s.task = 0;
}

/** Path changes can strand a staffer off the paths, or with a route that no longer exists. */
function repairStaff(state: GameState) {
  for (const s of state.staff) {
    if (s.machine.value === "leaving") continue;
    if (s.job === "security" && s.zone.length === 0) continue; // they walk the grass by the fence
    const routeBroken = s.route.some(([x, z]) => s.job !== "comms" && !isPathTile(state, Math.floor(x), Math.floor(z)));
    if (routeBroken) {
      s.route = [];
      if (s.machine.value === "going") send(s, { type: "LOST" });
    }
    if (!isPathTile(state, Math.floor(s.x), Math.floor(s.z)) && s.job !== "comms") {
      const p = nearestPathTile(state, s.x, s.z);
      if (p) [s.x, s.z] = [p[0] + 0.5, p[1] + 0.5];
    }
  }
}

export function updateStaff(state: GameState, rng: Rng) {
  if (state.staff.length === 0) return;
  if (state.flags.staffVersion !== state.version) {
    state.flags.staffVersion = state.version;
    repairStaff(state);
  }
  let gone: Set<number> | null = null;
  const disconnected = !entranceConnected(state);
  for (const s of state.staff) {
    s.px = s.x;
    s.pz = s.z;
    if (disconnected && s.machine.value !== "leaving" && !(s.job === "security" && s.zone.length === 0)) {
      if (s.machine.value === "going" || s.machine.value === "working") send(s, { type: "LOST" });
      if (s.machine.value === "arriving") send(s, { type: "ARRIVED" });
      if (s.route.length === 0 || state.tick % 12 === 0) s.route = gateAmble(state, s.id);
      move(s);
      continue;
    }
    switch (s.machine.value) {
      case "arriving":
        move(s);
        if (s.route.length === 0) send(s, { type: "ARRIVED" });
        break;
      case "idle":
        // After an escaping agent (FLT-59): straight at it, jogging; sim/escape moves the point and calls it off.
        if (s.chase) {
          s.route = [[s.chase.x, s.chase.z]];
          move(s, s.chase.jog);
          break;
        }
        // Pulled off their post: no looking for work, no patrol; straight to where the disaster sent them.
        if (s.divert) {
          march(state, s, s.divert);
          break;
        }
        if (--s.timer <= 0) {
          s.timer = SCAN_TICKS;
          const job = findJob(state, s);
          if (job) {
            s.task = job.task;
            s.route = job.route;
            send(s, { type: "TASK" });
          } else if (s.route.length === 0) patrol(state, s, rng);
        }
        move(s);
        break;
      case "going":
        if (!isTarget(state, s)) {
          s.route = [];
          s.task = 0;
          send(s, { type: "LOST" });
          break;
        }
        move(s);
        if (s.route.length === 0) {
          const w = s.job === "comms" ? state.walkers.find((o) => o.id === s.task) : undefined;
          if (w && dhypot(w.x - s.x, w.z - s.z) > TOTE_TOLERANCE) {
            s.last = s.task; // they moved: try somebody else, or come back for them
            s.task = 0;
            send(s, { type: "LOST" });
            break;
          }
          if (w) s.dir = datan2(w.x - s.x, w.z - s.z);
          const [lo, hi] = STAFF[s.job].work;
          s.timer = rng.int(lo, hi);
          send(s, { type: "ARRIVED" });
        }
        break;
      case "working":
        if (!isTarget(state, s)) {
          s.task = 0;
          send(s, { type: "LOST" });
        } else if (--s.timer <= 0) {
          finish(state, rng, s);
          send(s, { type: "DONE" });
          s.timer = 0;
          // Back to the path after talking on the grass.
          if (s.job === "comms") {
            const [fx, fz] = fromTile(state, s);
            s.route = [[fx, fz]];
          }
        }
        break;
      case "leaving":
        move(s);
        if (s.route.length === 0) (gone ??= new Set()).add(s.id);
        break;
    }
  }
  if (gone) state.staff = state.staff.filter((s) => !gone.has(s.id));
}

// ---- Disasters (FLT-17): pulling people off their posts -----------------------------------------------------------

/** A diverted staffer counts as "there" this close (in tiles) to the middle of the building, once their route is spent. */
const DIVERT_ARRIVED = 1.1;

/** Where a diversion points: the building (a gone one falls back to the gate). */
export function divertTarget(state: GameState, to: number): { rect: Rect; isGate: boolean; building: Building | null } {
  const building = to === 0 ? null : (state.buildings.find((b) => b.id === to) ?? null);
  return building ? { rect: building, isGate: false, building } : { rect: state.gate, isGate: true, building: null };
}

/** Is this staffer standing at the place they were diverted to? */
export function atDivert(state: GameState, s: Staffer): boolean {
  if (!s.divert || s.route.length > 0 || s.machine.value !== "idle") return false;
  const { rect } = divertTarget(state, s.divert.to);
  return dhypot(rect.x + rect.w / 2 - s.x, rect.z + rect.d / 2 - s.z) <= Math.max(rect.w, rect.d) / 2 + DIVERT_ARRIVED;
}

/** Route to the diversion if they are not there and not on their way; then jog. */
function march(state: GameState, s: Staffer, d: NonNullable<Staffer["divert"]>) {
  if (s.route.length === 0 && !atDivert(state, s)) {
    const { rect, isGate } = divertTarget(state, d.to);
    const [fx, fz] = fromTile(state, s);
    const route = routeToRect(state, fx, fz, rect, isGate);
    if (route) s.route = route;
  }
  move(s, d.jog);
}

/** Take a staffer off their post. Whatever they were doing is dropped; the post goes unstaffed until they are released. */
export function divertStaff(s: Staffer, owner: string, to: number, jog: number) {
  if (s.machine.value === "leaving") return;
  s.divert = { owner, to, jog };
  s.task = 0;
  s.route = [];
  s.timer = 0;
  if (s.machine.value === "going" || s.machine.value === "working") send(s, { type: "LOST" });
}

/** Let everyone `owner` diverted (of one job, or all) go back to work. They stroll off and look for jobs again. */
export function releaseStaff(state: GameState, owner: string, job?: StaffJob) {
  for (const s of state.staff) {
    if (!s.divert || s.divert.owner !== owner || (job && s.job !== job)) continue;
    delete s.divert;
    s.route = [];
    s.timer = 0;
  }
}

/** What a staffer is up to, for the panel. */
export function statusOfStaff(state: GameState, s: Staffer): string {
  if (s.chase && s.machine.value !== "leaving") return "Chasing an agent";
  if (s.divert && s.machine.value !== "leaving") {
    const { building } = divertTarget(state, s.divert.to);
    const where = building ? defs().buildings[building.kind].name : "the gate";
    return atDivert(state, s) ? `On the incident at the ${where}` : `Running to the ${where}`;
  }
  switch (s.machine.value) {
    case "arriving":
      return "Reporting for duty";
    case "idle":
      return s.job === "security" ? "Walking the fence" : "Looking for work";
    case "going":
    case "working": {
      const working = s.machine.value === "working";
      switch (s.job) {
        case "janitor":
          return working ? "Mopping slop" : "On the way to a puddle";
        case "sre": {
          const b = state.buildings.find((o) => o.id === s.task);
          const name = b ? defs().buildings[b.kind].name : "the incident";
          return working ? `Fixing the ${name}` : `Running to the ${name}`;
        }
        case "comms":
          return working ? "Handing over a tote bag" : "Heading for a protester";
        default:
          return "Walking the fence";
      }
    }
    case "leaving":
      return "Walking out with a box";
    default:
      return "";
  }
}

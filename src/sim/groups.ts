// Visitor groups (FLT-19): a small party that comes in through the gate, tours a planned list of buildings single file,
// stands about each one for a dwell (`inspect`), and leaves. Generic engine: a pack registers a group kind (its look,
// names, pace and route rules) and calls the `visitors.arrive` verb; Evals Without Borders is the first, and journalists
// or a select committee would be the same code with different data.
//
// A group is not a Walker. The walker machine is context-free and memoized per phase, and a tour group needs a plan;
// so each group keeps its own statechart (machines/group.ts) and moves with plain functions here, like the staff.
// Only the leader pathfinds. The others follow the leader's trail a few steps behind, and fan out along the front of the
// building at each stop. The owner (a pack's driver) reads `done` to hear which stops are finished.
import type { Json } from "./disasters/types";
import { TICKS_PER_HOUR } from "./daylight";
import { doorPoint, entrances, getReach, isPathTile, routeToRect, tileIndex } from "./pathfind";
import { stepGroup, groupStart, type GroupStored } from "./machines/group";
import type { Rng } from "./rng";
import type { Building, GameState, Point } from "./types";

/** What a pack says about a kind of group. Everything specific (names, looks, numbers) is data. */
export interface GroupKind {
  id: string;
  /** "Evals Without Borders". */
  name: string;
  /** How many turn up, inclusive. */
  size: readonly [number, number];
  /** Tiles per tick (the walkers do 0.12). */
  speed: number;
  names: readonly string[];
  route: {
    /** How many buildings they visit, inclusive. */
    stops: readonly [number, number];
    /** Building kinds they want to see, most wanted first. Kinds not listed are never visited. */
    prefer: readonly string[];
    /** Dwell at each stop, in campus-clock hours (25 ticks each), inclusive. */
    inspectHours: readonly [number, number];
    /** Kinds where they run their own evals (a longer dwell with a progress bar). The first one found is the last stop. */
    evalAt: readonly string[];
    evalHours: number;
  };
  /** For the renderer: colours and props. The sim never reads it. */
  look: Readonly<Record<string, Json>>;
}

export interface GroupMember {
  id: number;
  name: string;
  x: number;
  z: number;
  /** Position at the start of this tick, for render interpolation. */
  px: number;
  pz: number;
  dir: number;
}

export interface GroupStop {
  building: number;
  kind: string;
  ticks: number;
  evals: boolean;
}

export interface VisitorGroup {
  id: number;
  kind: string;
  /** Who called them (a pack's id); `visitors.leave` and the owner's driver find their groups by it. */
  owner: string;
  members: GroupMember[];
  stops: GroupStop[];
  /** Index of the current (or next) stop. */
  at: number;
  /** The leader's remaining waypoints. */
  route: Point[];
  /** The leader's recent positions, newest last: the others walk it. */
  trail: Point[];
  /** Ticks left at the current stop. */
  timer: number;
  machine: GroupStored;
  /** Stops finished, in order. */
  done: { building: number; kind: string; tick: number; evals: boolean }[];
}

const KINDS = new Map<string, GroupKind>();

/** A pack's group kind. Registering twice replaces the old one (a live-reloaded pack). */
export function registerGroupKind(kind: GroupKind) {
  KINDS.set(kind.id, kind);
}
export const groupKind = (id: string): GroupKind | undefined => KINDS.get(id);
export const groupKindNames = (): string[] => [...KINDS.keys()];

/** Trail points between one member and the next: about 0.5 tiles apart at the default pace. */
const GAP = 4;

const centre = (b: Building): Point => [b.x + b.w / 2, b.z + b.d / 2];

/** Where to go: a few of the preferred kinds, nearest-first from the gate, the eval stop last. Uses `rng`. */
export function planStops(s: GameState, kind: GroupKind, rng: Rng): GroupStop[] {
  const reach = getReach(s).buildings;
  const r = kind.route;
  const open = (k: string) => s.buildings.filter((b) => b.kind === k && reach.has(b.id) && !b.broken);
  const evalKind = r.evalAt.find((k) => open(k).length > 0);
  const evalAt = evalKind ? rng.pick(open(evalKind)) : null;
  const wanted = rng.int(r.stops[0], r.stops[1]) - (evalAt ? 1 : 0);
  // Every kind on the list that is on the campus, one building each; a few of the most wanted, shuffled a little.
  const kinds = r.prefer.filter((k) => k !== evalKind && open(k).length > 0);
  const chosen: Building[] = [];
  const pool = kinds.slice(0, Math.max(wanted + 2, 0));
  while (chosen.length < wanted && pool.length > 0) {
    const k = pool.splice(rng.int(0, Math.min(pool.length - 1, 2)), 1)[0]!;
    chosen.push(rng.pick(open(k)));
  }
  // A plausible walk: always the nearest unvisited stop next.
  const ordered: Building[] = [];
  let at: Point = [s.gate.x + s.gate.w / 2, s.gate.z];
  while (chosen.length > 0) {
    let best = 0;
    let bestD = Infinity;
    chosen.forEach((b, i) => {
      const [cx, cz] = centre(b);
      const d = (cx - at[0]) ** 2 + (cz - at[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    const b = chosen.splice(best, 1)[0]!;
    ordered.push(b);
    at = centre(b);
  }
  const stops = ordered.map((b): GroupStop => ({ building: b.id, kind: b.kind, evals: false, ticks: Math.round(rng.int(r.inspectHours[0] * 4, r.inspectHours[1] * 4) / 4 * TICKS_PER_HOUR) }));
  if (evalAt) stops.push({ building: evalAt.id, kind: evalAt.kind, evals: true, ticks: Math.round(r.evalHours * TICKS_PER_HOUR) });
  return stops;
}

/**
 * A group through the gate, on its way to the first stop. Null when there is nowhere to go (no path from the gate, or
 * nothing on the list is built). Draws its size, names and plan from `rng`.
 */
export function spawnGroup(s: GameState, kind: GroupKind, owner: string, rng: Rng): VisitorGroup | null {
  const linked = getReach(s).tiles;
  const mouth = entrances(s, s.gate).filter((e) => linked[tileIndex(s, e.x, e.z)]);
  if (mouth.length === 0) return null;
  const stops = planStops(s, kind, rng);
  const first = stops.length > 0 ? s.buildings.find((b) => b.id === stops[0]!.building) : undefined;
  const e = mouth[0]!;
  const route = first ? routeToRect(s, e.x + 0.5, e.z + 0.5, first) : null;
  if (!route) return null;
  const size = rng.int(kind.size[0], kind.size[1]);
  const names = kind.names.slice();
  const x = s.gate.x + s.gate.w / 2;
  const z = s.gate.z + 0.6;
  const members: GroupMember[] = [];
  for (let i = 0; i < size; i++) {
    const name = names.length > 0 ? names.splice(rng.int(0, names.length - 1), 1)[0]! : `${kind.name} ${i + 1}`;
    // They queue up outside the gate, one behind the other.
    members.push({ id: s.nextId++, name, x, z: z + i * 0.45, px: x, pz: z + i * 0.45, dir: Math.PI });
  }
  const g: VisitorGroup = { id: s.nextId++, kind: kind.id, owner, members, stops, at: 0, route, trail: [[x, z]], timer: 0, machine: groupStart(), done: [] };
  (s.groups ??= []).push(g);
  return g;
}

/** Send an owner's groups home (the stop they are at is left unfinished). */
export function sendGroupsHome(s: GameState, owner: string) {
  for (const g of s.groups ?? []) if (g.owner === owner && g.machine.value !== "leaving" && g.machine.value !== "gone") goHome(s, g);
}

export const groupsOf = (s: GameState, owner: string): VisitorGroup[] => (s.groups ?? []).filter((g) => g.owner === owner);

/** Everyone in a group, by member id: for bubbles and name lookups. */
export function memberById(s: GameState, id: number): { group: VisitorGroup; member: GroupMember } | null {
  for (const group of s.groups ?? []) for (const member of group.members) if (member.id === id) return { group, member };
  return null;
}

/** Where the leader starts a route: where it stands, or (fanned out onto the grass at a stop) the nearest path tile. */
function startPoint(s: GameState, g: VisitorGroup): Point {
  const m = g.members[0]!;
  const fx = Math.floor(m.x);
  const fz = Math.floor(m.z);
  if (isPathTile(s, fx, fz)) return [m.x, m.z];
  let best: Point = [m.x, m.z];
  let bestD = Infinity;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (!isPathTile(s, fx + dx, fz + dz)) continue;
    const d = (fx + dx + 0.5 - m.x) ** 2 + (fz + dz + 0.5 - m.z) ** 2;
    if (d < bestD) { bestD = d; best = [fx + dx + 0.5, fz + dz + 0.5]; }
  }
  return best;
}

function goHome(s: GameState, g: VisitorGroup) {
  const [x, z] = startPoint(s, g);
  g.route = routeToRect(s, x, z, s.gate, true) ?? [];
  g.machine = stepGroup(g.machine, { type: "HOME" });
}

/** The next stop that is still standing and reachable, routed to; or home if there is none. */
function onward(s: GameState, g: VisitorGroup) {
  const [x, z] = startPoint(s, g);
  while (g.at < g.stops.length) {
    const b = s.buildings.find((o) => o.id === g.stops[g.at]!.building);
    const route = b ? routeToRect(s, x, z, b) : null;
    if (route) {
      g.route = route;
      g.machine = stepGroup(g.machine, { type: "NEXT" });
      return;
    }
    g.at++;
  }
  goHome(s, g);
}

function stepToward(m: GroupMember, tx: number, tz: number, budget: number) {
  const dx = tx - m.x;
  const dz = tz - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return;
  if (dist > 0.02) m.dir = Math.atan2(dx, dz);
  const k = Math.min(1, budget / dist);
  m.x += dx * k;
  m.z += dz * k;
}

/** Leader along the route; returns true once it is empty. */
function lead(g: VisitorGroup, speed: number): boolean {
  const m = g.members[0]!;
  let budget = speed;
  while (budget > 1e-9 && g.route.length > 0) {
    const [tx, tz] = g.route[0]!;
    const dist = Math.hypot(tx - m.x, tz - m.z);
    stepToward(m, tx, tz, budget);
    if (dist <= budget) g.route.shift();
    budget -= Math.min(dist, budget);
  }
  const last = g.trail[g.trail.length - 1];
  if (!last || Math.hypot(last[0] - m.x, last[1] - m.z) > speed * 0.5) {
    g.trail.push([m.x, m.z]);
    const keep = g.members.length * GAP + 1;
    if (g.trail.length > keep) g.trail.splice(0, g.trail.length - keep);
  }
  return g.route.length === 0;
}

/** The others walk the leader's trail, one behind the other. */
function follow(g: VisitorGroup, speed: number) {
  for (let i = 1; i < g.members.length; i++) {
    const p = g.trail[Math.max(0, g.trail.length - 1 - i * GAP)]!;
    stepToward(g.members[i]!, p[0], p[1], speed * 1.4);
  }
}

/** At a stop: a line along the building's front, facing it, shuffling about and peering at things. */
function fanOut(s: GameState, g: VisitorGroup, b: Building, speed: number) {
  const door = doorPoint(s, b) ?? centre(b);
  const [cx, cz] = centre(b);
  const ax = door[0] - cx;
  const az = door[1] - cz;
  const len = Math.hypot(ax, az) || 1;
  // Outward from the wall, and along it.
  const ox = ax / len;
  const oz = az / len;
  const n = g.members.length;
  g.members.forEach((m, i) => {
    const side = (i - (n - 1) / 2) * 0.55;
    const peer = Math.sin(s.tick * 0.07 + i * 2.1) * 0.18;
    const tx = door[0] + ox * (0.35 + peer) - oz * side;
    const tz = door[1] + oz * (0.35 + peer) + ox * side;
    stepToward(m, tx, tz, speed);
    if (Math.hypot(tx - m.x, tz - m.z) < 0.05) m.dir = Math.atan2(cx - m.x, cz - m.z) + Math.sin(s.tick * 0.05 + i) * 0.5;
  });
}

/** One tick for every group. Nothing to do (and nothing drawn from any rng) when there are none. */
export function updateGroups(s: GameState) {
  const groups = s.groups;
  if (!groups || groups.length === 0) return;
  for (const g of groups) {
    for (const m of g.members) { m.px = m.x; m.pz = m.z; }
    const speed = KINDS.get(g.kind)?.speed ?? 0.1;
    const phase = g.machine.value;
    if (phase === "walking" || phase === "leaving") {
      const there = lead(g, speed);
      follow(g, speed);
      if (!there) continue;
      if (phase === "leaving") {
        g.machine = stepGroup(g.machine, { type: "EXITED" });
        continue;
      }
      const stop = g.stops[g.at];
      if (!stop) { goHome(s, g); continue; }
      g.timer = stop.ticks;
      g.machine = stepGroup(g.machine, { type: stop.evals ? "EVALS" : "ARRIVED" });
    } else if (phase === "inspecting" || phase === "evaluating") {
      const stop = g.stops[g.at]!;
      const b = s.buildings.find((o) => o.id === stop.building);
      // Bulldozed mid-inspection: that is also a finding, but not one this dwell waits for.
      if (!b) { g.at++; onward(s, g); continue; }
      fanOut(s, g, b, speed);
      if (--g.timer > 0) continue;
      g.done.push({ building: b.id, kind: b.kind, tick: s.tick, evals: stop.evals });
      g.at++;
      g.trail = [[g.members[0]!.x, g.members[0]!.z]];
      onward(s, g);
    }
  }
  if (groups.some((g) => g.machine.value === "gone")) s.groups = groups.filter((g) => g.machine.value !== "gone");
}

/** How far through the current stop's dwell (0 to 1), or null when walking. */
export function dwellProgress(g: VisitorGroup): number | null {
  if (g.machine.value !== "inspecting" && g.machine.value !== "evaluating") return null;
  const stop = g.stops[g.at];
  return stop ? Math.max(0, Math.min(1, 1 - g.timer / stop.ticks)) : null;
}

/** Group members on campus, all groups. */
export const visitorCount = (s: GameState): number => (s.groups ?? []).reduce((n, g) => n + g.members.length, 0);

/** Names, for anything that wants to say who a member is. */
export const kindName = (id: string): string => KINDS.get(id)?.name ?? id;

// Meetings (FLT-26): a visitor walks in from the gate to talk to one of your people, somewhere everyone can see.
// Generic: the `people.meet` verb starts one; which visitor, where and what they say is the calling pack's.
// Both walkers stay in their ordinary `wandering` phase: a meeting only picks the spot and holds their timers.
import { stepWalker } from "./machines/walker";
import { bfsRoute, doorPoint, isPathTile, nearestPathTile, tileIndex } from "./pathfind";
import type { Rng } from "./rng";
import { TARGET_WANDER, type GameState, type Point, type Walker } from "./types";
import { newWalker } from "./walkers";
import { TICKS_PER_DAY } from "./constants";

const HOURS_PER_TICK = 24 / TICKS_PER_DAY;

export interface Meeting {
  id: number;
  /** Who started it (a pack or machine id). */
  owner: string;
  hostId: number;
  guestId: number;
  /** The building kind they meet by, for the history line. */
  at: string;
  /** The two tiles they stand on, host first. */
  spots: [Point, Point];
  /** "waiting" until the host is free to step out, "walking" to the spot, "talking" there. */
  phase: "waiting" | "walking" | "talking";
  /** Ticks of talk once both are there. */
  length: number;
  /** When the talk ends (set when it starts). */
  until: number;
  /** Tick it was called; a host who never frees up is let off after a day. */
  called: number;
  /** What they say, guest first, then host, alternating. */
  lines: string[];
}

const FREE = new Set(["arriving", "seeking", "loitering", "wandering"]);
/** Long enough to walk across any campus; the meeting sets the real end when both are there. */
const HOLD = 100_000;
const CALL_TICKS = 20;

/** The two tiles to stand on: the path tile at the building's door and a free neighbour, or next to the host. */
function spotsFor(s: GameState, at: string, host: Walker): [Point, Point] | null {
  const b = s.buildings.find((o) => o.kind === at && !o.broken);
  const door = b ? doorPoint(s, b) : null;
  const t = nearestPathTile(s, door ? door[0] : host.x, door ? door[1] : host.z);
  if (!t) return null;
  const [x, z] = t;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (isPathTile(s, x + dx, z + dz)) return [[x + 0.5, z + 0.5], [x + dx + 0.5, z + dz + 0.5]];
  }
  return [[x + 0.5, z + 0.5], [x + 0.5, z + 0.5]];
}

function routeTo(s: GameState, w: Walker, to: Point) {
  const start = nearestPathTile(s, w.x, w.z);
  const route = start ? bfsRoute(s, start, new Set([tileIndex(s, Math.floor(to[0]), Math.floor(to[1]))])) : null;
  w.route = route ? route.map(([x, z]): Point => [x + 0.5, z + 0.5]) : [to];
  w.route.push(to);
}

/** Park a walker in `wandering` with a long timer, heading for `to`. */
function hold(s: GameState, w: Walker, to: Point) {
  if (w.machine.value !== "wandering") {
    w.machine = stepWalker(w.machine, { type: "NEXT" });
    w.machine = stepWalker(w.machine, { type: "CHOSE_WANDER" });
  }
  w.need = "";
  w.targetId = TARGET_WANDER;
  w.timer = HOLD;
  routeTo(s, w, to);
}

/** Call a meeting: `role` walks in from the gate to meet `hostId` by the first `at` building. */
export function callMeeting(s: GameState, rng: Rng, m: { owner: string; hostId: number; role: string; at: string; hours: number; lines: string[] }): Meeting | null {
  const host = s.walkers.find((w) => w.id === m.hostId);
  if (!host) return null;
  const spots = spotsFor(s, m.at, host);
  if (!spots) return null;
  const g = s.gate;
  const guest = newWalker(s, "visitor", g.x + g.w / 2, g.z + 0.6, rng);
  guest.role = m.role;
  // A VC on a recruiting call does not write the lab a cheque on the way out.
  guest.impressed = 0.2;
  guest.visits = 0;
  s.walkers.push(guest);
  hold(s, guest, spots[1]);
  const meeting: Meeting = { id: s.nextId++, owner: m.owner, hostId: host.id, guestId: guest.id, at: m.at, spots, phase: "waiting", length: Math.max(1, Math.round(m.hours / HOURS_PER_TICK)), until: 0, called: s.tick, lines: m.lines };
  (s.meetings ??= []).push(meeting);
  return meeting;
}

const release = (w: Walker | undefined) => {
  if (w && w.machine.value === "wandering" && w.timer > 1) w.timer = 1;
};

/** Per tick, and cheap: nothing to do without a meeting. */
export function updateMeetings(s: GameState) {
  const list = s.meetings;
  if (!list || list.length === 0) return;
  for (const m of list) {
    const host = s.walkers.find((w) => w.id === m.hostId);
    const guest = s.walkers.find((w) => w.id === m.guestId);
    const gone = !host || !guest || host.machine.value === "quitting" || host.machine.value === "leaving" || guest.machine.value === "leaving";
    if (gone || (m.phase === "talking" && s.tick >= m.until) || (m.phase === "waiting" && s.tick - m.called > CALL_TICKS * 3)) {
      release(host);
      release(guest);
      m.until = -1;
      continue;
    }
    // A path change can send a wanderer somewhere new (walkers.ts repairWalkers): call them back.
    if (m.phase !== "waiting" && (host.timer < 1000 || guest.timer < 1000)) {
      if (!FREE.has(host.machine.value) || !FREE.has(guest.machine.value)) {
        m.until = -1;
        continue;
      }
      hold(s, host, m.spots[0]);
      hold(s, guest, m.spots[1]);
      m.phase = "walking";
    }
    if (m.phase === "waiting" && FREE.has(host.machine.value)) {
      hold(s, host, m.spots[0]);
      m.phase = "walking";
    } else if (m.phase === "walking" && host.route.length === 0 && guest.route.length === 0) {
      m.phase = "talking";
      m.until = s.tick + m.length;
      // Face each other.
      host.dir = Math.atan2(guest.x - host.x, guest.z - host.z);
      guest.dir = Math.atan2(host.x - guest.x, host.z - guest.z);
    }
  }
  if (list.some((m) => m.until < 0)) s.meetings = list.filter((m) => m.until >= 0);
}

export const talking = (s: GameState, owner?: string): Meeting[] => (s.meetings ?? []).filter((m) => m.phase === "talking" && (owner === undefined || m.owner === owner));

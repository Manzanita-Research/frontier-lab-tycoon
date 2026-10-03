// Who waits at the gate while lunch is late (FLT-109), and where they stand. Pure arithmetic on the walker's id and the
// tick, no dice: the walkers' loop (sim/walkers.ts) asks it and does the walking.
import { dcos, dsin } from "../dmath";
import type { GameState, Point, Walker } from "../types";
import { SLOPBOWL } from "./pack";

const R = SLOPBOWL.rules;
/** A walker waiting at the gate holds a timer at least this long, so the ordinary wander never ends their wait. */
export const HOLDING = 1_000;
/** Less than a meeting's hold (meetings.ts): the courier's host is never mistaken for someone waiting. */
export const MEETING_HOLD = 100_000;
/** A walker's place in the queue for lunch, 0 to 1: the first `crowd` of them by this number are at the gate. */
const share = (id: number) => (Math.imul(id + 1, 2654435761) >>> 0) / 4294967296;

/** Is this researcher waiting for lunch at the gate right now? (Not the one signing for the bowls: the courier has them.) */
export function waitsForLunch(s: GameState, w: Walker): boolean {
  const sb = s.slopbowl;
  return !!sb && sb.crowd > 0 && w.kind === "researcher" && w.id !== sb.host && share(w.id) < sb.crowd;
}

/** The spot just inside the gate this researcher paces to now: a new one every `paceTicks`, everyone on their own beat. */
export function lunchSpot(s: GameState, w: Walker): Point {
  const g = s.gate;
  const turn = Math.floor((s.tick + w.id * 5) / R.crowd.paceTicks);
  const a = w.id * 2.399963229728653 + turn * 1.9;
  const r = 0.55 + 0.45 * share(w.id + turn);
  return [g.x + g.w / 2 + dcos(a) * 2.6 * r, g.z - 1.6 - (0.5 + 0.5 * dsin(a)) * 2.2 * r];
}

/** Time for a new spot (and a fresh look at the gate)? */
export const paceNow = (s: GameState, w: Walker) => (s.tick + w.id * 5) % R.crowd.paceTicks === 0;

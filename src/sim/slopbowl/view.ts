// What the delivery tracker shows (FLT-109): the OrderTracker slot draws it. Read-only and plain data. The ETA slips a
// little further at every stage, and the old ones stay on the screen, struck through.
import { TICKS_PER_DAY } from "../constants";
import { fillTemplate } from "../format";
import type { GameState } from "../types";
import { hungry } from "./research";
import { SLOPBOWL, STAGES, type SlopStage } from "./pack";

const R = SLOPBOWL.rules;
const T = R.tracker;
/** "Delivered" stays on the tracker this many days after lunch (or until the player closes it). */
const LINGER_DAYS = 10;

export interface SlopBowlView {
  /** The order: its due tick, so a tracker closed on one order opens again for the next. */
  id: number;
  app: string;
  place: string;
  order: string;
  stage: SlopStage;
  /** "Day 3 of the Fancy Healthy … being late". */
  dayLine: string;
  /** Whole days late. */
  daysLate: number;
  eta: string;
  /** The ETAs it gave before this one, oldest first. */
  slipped: string[];
  status: string;
  /** Where the courier is on the route, 0 (the restaurant) to 1 (the gate). It goes backwards too. */
  route: number;
  delivered: boolean;
  /** Research is going backwards right now. */
  backwards: boolean;
}

export function slopbowlView(s: GameState): SlopBowlView | null {
  const sb = s.slopbowl;
  if (!sb?.enabled) return null;
  const value = sb.machine.value as string;
  const { due, fedAt } = sb.machine.context;
  const lingering = value === "quiet" && fedAt > due && s.tick - fedAt < LINGER_DAYS * TICKS_PER_DAY;
  if (value === "quiet" && !lingering) return null;
  const stage: SlopStage = lingering ? "fed" : (value as SlopStage);
  const at = STAGES.indexOf(stage);
  const step = T.steps[stage];
  const daysLate = Math.floor(((stage === "fed" ? fedAt : s.tick) - due) / TICKS_PER_DAY);
  const slipped: string[] = [];
  for (const k of STAGES.slice(0, at)) {
    const eta = T.steps[k].eta;
    if (k !== "arriving" && !slipped.includes(eta) && eta !== step.eta) slipped.push(eta);
  }
  return {
    id: due, app: T.app, place: R.place, order: T.order, stage, daysLate,
    dayLine: fillTemplate(T.day, { n: String(daysLate + 1), place: R.place }),
    eta: step.eta, slipped: stage === "fed" ? [] : slipped, status: step.status, route: step.route,
    delivered: stage === "fed", backwards: hungry(sb),
  };
}

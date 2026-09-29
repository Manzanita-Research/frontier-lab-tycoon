// What the HUD reads: a small plain snapshot of the World, refreshed at about 5 Hz instead of every tick.
import type { PlaceableKind } from "../content/buildings";
import { runwayMonths } from "../sim/format";
import { protesterCount } from "../sim/protest";
import { computePerDay } from "../sim/training";
import { openEventOf } from "../sim/events";
import { outcomeOf } from "../sim/goals";
import type { Building, GameState, GoalProgress, OpenEvent, Outcome, Pop, Thought, Tone } from "../sim/types";

export type Tool = "path" | PlaceableKind | "bulldoze";
/** Hotkeys 1-9 pick these in order. */
export const TOOLS: Tool[] = ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "bulldoze"];
export const SPEEDS = [0, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Snapshot {
  tick: number;
  day: number;
  cash: number;
  net: number;
  income: number;
  expenses: number;
  runway: number | null;
  capability: number;
  hype: number;
  labName: string;
  hasHall: boolean;
  computePerDay: number;
  training: { name: string; run: number; pct: number };
  thoughts: Thought[];
  pops: Pop[];
  version: number;
  /** Same array identity until the grid or buildings change. */
  buildings: Building[];
  models: number;
  walkers: number;
  hasGateway: boolean;
  goals: GoalProgress[];
  outcome: Outcome;
  event: OpenEvent | null;
  protesters: number;
  discourse: number;
}

export interface UiToast {
  id: number;
  text: string;
  tone: Tone;
}

export function makeSnapshot(s: GameState, prev?: Snapshot): Snapshot {
  return {
    tick: s.tick,
    day: s.day,
    cash: s.cash,
    net: s.ledger.net,
    income: s.ledger.income,
    expenses: s.ledger.expenses,
    runway: runwayMonths(s.cash, s.ledger.net),
    capability: s.capability,
    hype: s.hype,
    labName: s.labName,
    hasHall: s.buildings.some((b) => b.kind === "hall"),
    computePerDay: computePerDay(s),
    training: { name: s.training.context.name, run: s.training.context.run, pct: Math.min(1, s.training.context.progress / s.training.context.cost) },
    thoughts: s.thoughts.slice(),
    pops: s.pops.slice(),
    version: s.version,
    buildings: prev && prev.version === s.version ? prev.buildings : s.buildings.slice(),
    models: s.models.length,
    walkers: s.walkers.length,
    hasGateway: s.buildings.some((b) => b.kind === "gateway"),
    goals: s.goals.context.goals.map((g) => ({ ...g })),
    outcome: outcomeOf(s),
    event: openEventOf(s),
    protesters: protesterCount(s),
    discourse: s.waterDiscourse,
  };
}

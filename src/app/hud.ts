// What the HUD reads: a small plain snapshot of the World, refreshed at about 5 Hz instead of every tick.
import type { PlaceableKind } from "../content/buildings";
import { runwayMonths } from "../sim/format";
import { protesterCount } from "../sim/protest";
import { inspectWalker, type Inspect } from "../sim/inspect";
import { thoughtBoard, type ThoughtRow } from "../sim/mind";
import { computePerDay } from "../sim/training";
import { openEventOf } from "../sim/events";
import { opsView, type OpsView } from "../sim/opsView";
import { raceView, type RaceView } from "../sim/race/view";
import { outcomeOf, releaseGoalText } from "../sim/goals";
import { estimateLedger } from "../sim/economy";
import { assistantOf, type AssistantMessage } from "../sim/tutorial";
import { pendingConfirmOf, persistentWarnings, type PendingConfirm } from "../sim/guardrails";
import type { Building, GameState, GoalProgress, OpenEvent, Outcome, Pop, Thought, Tone, Vibes } from "../sim/types";

export type Tool = "path" | PlaceableKind | "bulldoze";
/** Hotkeys 1-9 pick these in order. */
export const TOOLS: Tool[] = ["path", "cluster", "hall", "gateway", "kombucha", "nap", "snack", "demo", "bulldoze"];
/** The race's buildings: in the palette (between the core buildings and Bulldoze, no hotkey) once an auction unlocks them. */
export const RACE_TOOLS: Tool[] = ["datacenter", "gas", "solar"];
export const SPEEDS = [0, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];

/** What the player has selected: it lives in the app machine, and the World only reads it to build the snapshot. */
export interface UiSelection {
  /** The walker whose card is open. */
  selected: number | null;
  /** The camera is tracking `selected`. */
  follow: boolean;
  /** The Thoughts row (`kind|text`) whose walkers are lit up. */
  highlight: string | null;
}

export const NO_SELECTION: UiSelection = { selected: null, follow: false, highlight: null };

/** How many Thoughts rows the panel gets. */
export const BOARD_ROWS = 14;

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
  vibes: Vibes;
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
  /** The Thoughts panel: everyone's thought, counted, most common first. */
  board: ThoughtRow[];
  /** The open inspector card, if a walker is selected and still here. */
  inspect: Inspect | null;
  /** The selection this snapshot was built for: the app only trusts `inspect: null` if it matches its own. */
  selectedId: number | null;
  /** The Race: multiplier, era, the Arena, the open-weights drop, power. */
  race: RaceView;
  /** Operations: staff, slop, broken buildings, queues. */
  ops: OpsView;
  assistant: AssistantMessage | null;
  firstBuildPending: boolean;
  pendingConfirm: PendingConfirm | null;
  warnings: string[];
  releaseGoal: string;
}

export interface UiToast {
  id: number;
  text: string;
  tone: Tone;
}

export function makeSnapshot(s: GameState, prev?: Snapshot, ui: UiSelection = NO_SELECTION): Snapshot {
  const books = estimateLedger(s);
  return {
    tick: s.tick,
    day: s.day,
    cash: s.cash,
    net: books.net,
    income: books.income,
    expenses: books.expenses,
    runway: runwayMonths(s.cash, books.net),
    capability: s.capability,
    hype: s.hype,
    vibes: { ...s.vibes },
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
    board: thoughtBoard(s).slice(0, BOARD_ROWS),
    inspect: ui.selected === null ? null : inspectWalker(s, ui.selected),
    selectedId: ui.selected,
    race: raceView(s),
    ops: opsView(s),
    assistant: assistantOf(s),
    firstBuildPending: assistantOf(s) !== null && s.flags.firstBuild === undefined,
    pendingConfirm: pendingConfirmOf(s),
    warnings: persistentWarnings(s),
    releaseGoal: releaseGoalText(s),
  };
}

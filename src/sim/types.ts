// Everything in GameState is plain and JSON-serializable.
import type { BuildingKind } from "../content/buildings";
import type { EconomyStored } from "./machines/economy";
import type { TrainingStored } from "./machines/training";

export type { BuildingKind };
export type WalkerKind = "researcher" | "agent" | "visitor" | "protester";
export type WalkerMode = "walk" | "inside" | "leave";
export type Tone = "good" | "bad" | "neutral" | "joke";

/** Tile-space position; tile (i, j) covers [i, i+1) x [j, j+1). */
export type Point = [number, number];

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Building extends Rect {
  id: number;
  kind: BuildingKind;
  /** Tick it was placed on; the renderer uses it for the pop-in squash. */
  placedTick: number;
}

/** Walker.targetId values that aren't building ids. */
export const TARGET_WANDER = -1;
export const TARGET_GATE = 0;

export interface Walker {
  id: number;
  kind: WalkerKind;
  x: number;
  z: number;
  /** Position at the start of this tick, for render interpolation. */
  px: number;
  pz: number;
  /** Heading in radians (atan2(dx, dz)), for the renderer. */
  dir: number;
  route: Point[];
  /** Building id, TARGET_GATE, or TARGET_WANDER. While 'inside', the building they're in. */
  targetId: number;
  mode: WalkerMode;
  timer: number;
  energy: number;
  /** Visitors: buildings left to tour before heading for the gate. */
  visits: number;
  /** Researchers: counts visits so they alternate between Hall and Cluster. */
  step: number;
  /** Standing around near the last building instead of heading somewhere. */
  loiter: boolean;
  /** Researchers: id of the Fountain they are currently walking past (0 for none), so it refreshes them once per pass. */
  fountain: number;
  /** Protesters: the spot they picket from. */
  homeX: number;
  homeZ: number;
}

export interface NewsItem {
  id: number;
  day: number;
  text: string;
  tone: Tone;
}

export interface Thought {
  id: number;
  walkerId: number;
  kind: WalkerKind;
  text: string;
  expiresTick: number;
}

export interface Pop {
  id: number;
  x: number;
  z: number;
  amount: number;
  tick: number;
}

/** Drained by the store into UI toasts. */
export interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

export interface GoalProgress {
  id: string;
  /** Current value of the metric (latched at the target once met). */
  value: number;
  target: number;
  /** Milestones latch: once met, they stay met. */
  met: boolean;
}

export type Outcome = "playing" | "won" | "lost";

/** The event card that is open right now; the game is paused until the player picks a choice. */
export interface OpenEvent {
  id: string;
  day: number;
}

export interface Ledger {
  income: number;
  expenses: number;
  net: number;
}

export interface GameState {
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  cash: number;
  capability: number;
  /** Compute stockpile: clusters add it, training spends it. */
  compute: number;
  /** 0 to 100. The park rating. */
  hype: number;
  labName: string;
  grid: { w: number; h: number; paths: boolean[] };
  gate: Rect;
  buildings: Building[];
  walkers: Walker[];
  /** The economy machine: solvent, runwayWarning, bailout or bankrupt, plus the day of the last bridge round. */
  economy: EconomyStored;
  /** The training machine: run, progress, cost and the next model name live in its context. */
  training: TrainingStored;
  /** Names of released models. */
  models: string[];
  /** Last 50. */
  news: NewsItem[];
  /** Active thought bubbles, at most 3. */
  thoughts: Thought[];
  /** Recent money pops (kept ~3 days so a throttled renderer doesn't miss any). */
  pops: Pop[];
  toasts: Toast[];
  /** Last game day's income and expenses. */
  ledger: Ledger;
  /** Bumps whenever the grid or buildings change. */
  version: number;
  nextId: number;
  /** Misc counters and timestamps: 'built:<kind>', 'nextFiller', 'lastRelease', ... */
  flags: Record<string, number>;
  recentThoughts: string[];
  /** Debug/stress: extra agents on top of the capability-driven count. */
  agentBonus: number;
  /** Rises with compute clusters, decays daily; a quarter of it is the protester headcount (capped at 40). */
  waterDiscourse: number;
  goals: GoalProgress[];
  outcome: Outcome;
  /** At most one at a time; `tick` does nothing while it is open. */
  event: OpenEvent | null;
}

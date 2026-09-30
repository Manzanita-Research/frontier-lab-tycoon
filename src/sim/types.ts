// Everything in GameState is plain and JSON-serializable.
import type { BuildingKind } from "../content/buildings";
import type { NeedKey } from "../content/needs";
import type { ArcStored } from "./machines/arc";
import type { EconomyStored } from "./machines/economy";
import type { GoalsStored } from "./machines/goals";
import type { MoodStored } from "./machines/mood";
import type { RaceState } from "./race/state";
import type { StaffStored } from "./machines/staff";
import type { TrainingStored } from "./machines/training";
import type { WalkerStored } from "./machines/walker";
import type { TutorialStored } from "./machines/tutorial";

export type { BuildingKind, NeedKey };
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
  /** 0 to 1 (FLT-10): a new building is at 1, loses 0.5% a day, and a repair puts it back to 0.9. */
  reliability: number;
  /** Out of order (a fire, an outage): it does no work, and nobody goes in, until someone fixes it. */
  broken: boolean;
  /** The tick it broke; the emergency contractor's clock starts here. */
  brokenTick: number;
}

/** Walker.targetId values that aren't building ids. */
export const TARGET_WANDER = -1;
export const TARGET_GATE = 0;

/** A walker's personnel file: what the inspector reads out as history. Counts only go up. */
export interface WalkerStats {
  /** Game day they joined (or first turned up). */
  joined: number;
  /** Kombuchas drunk, naps taken, snacks eaten, demos watched. */
  sips: number;
  naps: number;
  snacks: number;
  demos: number;
  /** Poaching offers turned down, and the RIVALS index of the latest one. */
  offers: number;
  rival: number;
}

export interface Walker {
  id: number;
  kind: WalkerKind;
  /** "Dr. Ada Gradient", "Agent-0042 'Sparky'". */
  name: string;
  /** "Member of Technical Staff", "Venture Capitalist", ... */
  role: string;
  /** Index into THEIR (her, his, their): assigned at random, used in headlines. */
  pro: number;
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
  timer: number;
  /**
   * The needs, each 0 to 1. Researchers use energy, focus and fomo; visitors patience and impressed; agents drift.
   * Energy, focus, patience and impressed are good high; fomo and drift are bad high. The rest sit at 0.
   */
  energy: number;
  focus: number;
  fomo: number;
  patience: number;
  impressed: number;
  drift: number;
  /** What they are heading somewhere for: a need, "work" (the day job) or "tour" (a visitor sightseeing). Empty when not seeking. */
  need: NeedKey | "work" | "tour" | "";
  /** The need they went looking for and found nothing that helps: "I can't find X" (cleared once something does). */
  lost: NeedKey | "";
  /** The mood machine: content, slumped, miserable or resigned. Drives the slump walk and, for researchers, quitting. */
  mood: MoodStored;
  stats: WalkerStats;
  /** Visitors: buildings left to tour before heading for the gate. */
  visits: number;
  /** Researchers: counts visits so they alternate between Hall and Cluster. */
  step: number;
  /** The walker machine: heading, inside, loitering, wandering, leaving or picketing. */
  machine: WalkerStored;
  /** Researchers: id of the Fountain they are currently walking past (0 for none), so it refreshes them once per pass. */
  fountain: number;
  /** Protesters: the spot they picket from. */
  homeX: number;
  homeZ: number;
  /** How much slop they have been through lately, 0 to 1 (sim/slop.ts): it builds underfoot, wears off slowly, and takes a little off their happiness. */
  mess: number;
  /** In a line (FLT-10): the tick they joined, the entrance tile the line forms on, and the place they stand in it (-1: not yet). */
  queued: number;
  qtile: number;
  qslot: number;
  /** Where the line says they should be standing (recomputed each tick from the join order; `qslot` follows it). Transient. */
  qrank: number;
}

export type StaffJob = "janitor" | "sre" | "comms" | "security";

/** Someone on the payroll (FLT-10): a little walker with a machine of their own and, optionally, a painted patrol zone. */
export interface Staffer {
  id: number;
  job: StaffJob;
  name: string;
  x: number;
  z: number;
  /** Position at the start of this tick, for render interpolation. */
  px: number;
  pz: number;
  dir: number;
  route: Point[];
  /** Ticks left of what they are doing (working, or waiting to look around again). */
  timer: number;
  /** What they are on their way to or working on: a tile index (janitor), a building id (SRE), a walker id (comms), a fence waypoint (security). */
  task: number;
  /** The last thing they finished, so a Comms Rep does not hand the same protester a second tote bag straight away. */
  last: number;
  /** Game day they joined. */
  hired: number;
  /** Jobs done (puddles mopped, buildings fixed, tote bags handed out). */
  done: number;
  /** Painted patrol zone: grid tile indices, sorted. Empty means the whole campus. */
  zone: number[];
  /** The staff machine: arriving, idle, going, working, leaving or gone. */
  machine: StaffStored;
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

/** The park rating: 0 to 999, recalculated daily and smoothed. `parts` are the 0 to 1 inputs the tooltip explains. */
export interface Vibes {
  value: number;
  /** Where the smoothing is heading. */
  target: number;
  /** Change over the last day; the trend arrow reads this. */
  delta: number;
  happiness: number;
  impressed: number;
  cleanliness: number;
  hype: number;
  /** Penalties, each 0 (none) to 1 (worst). */
  incident: number;
  protest: number;
  /** The running incident score behind `incident`: quits, failed demos and bailouts add to it, it fades daily. */
  incidents: number;
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
  /** 0 to 100. Buzz: one input to the Vibes. */
  hype: number;
  /** The park rating (0 to 999): drives visitors, applicants and investor visits. */
  vibes: Vibes;
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
  /** The scenario machine: tracking, won or lost, with the milestones and the day it ended in its context. */
  goals: GoalsStored;
  /** One machine per event card, by event id. At most one is in `cardOpen`; `tick` does nothing while it is. */
  arcs: Record<string, ArcStored>;
  /** The Race (FLT-9): rival machines, the Arena, the era ratchet, the open-weights drop and the auction clock. */
  race: RaceState;
  /** Slop on each grid tile (FLT-10), 0 (clean) to 3 (ankle-deep). Drifted agents drop it on the path; Janitor Bots mop it up. */
  slop: number[];
  /** The payroll: Janitor Bots, SREs, Comms Reps and Security. */
  staff: Staffer[];
  /** FLT-16: absent on older saves; those keep playing without onboarding. */
  tutorial?: TutorialStored;
}

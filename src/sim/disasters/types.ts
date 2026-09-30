// Disasters (FLT-17): the shapes. A disaster is content: a JSON statechart (`DisasterDef`, in the FLT-15 section
// shape: nodes with `entry`, `exit` and `on: { EVENT: [{ guard, target, actions }] }`, guards and actions being
// named calls into the Vocabulary, sim/verbs.ts). The engine compiles it to an XState machine (compile.ts), steps it
// purely inside the tick and applies what it emits (driver.ts). Nothing in here needs a mod to be loaded.
import type { BuildingKind } from "../../content/buildings";
import type { Effect } from "../../content/events";
import type { StaffJob, Tone } from "../types";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** A named guard or verb: a bare name, or a name with parameters (FLT-30's `NamedCall`). */
export type Call = string | { type: string; params?: Record<string, Json> };
/** Guards: one call, or a list that must all hold. */
export type GuardSpec = Call | Call[];

export interface TransitionDef {
  /** Where to go. Absent: stay put (the actions still run). */
  target?: string;
  guard?: GuardSpec;
  actions?: Call[];
}

/** The two events a disaster machine hears: a game tick, and the player's pick on a card the disaster opened. */
export type BeatName = "TICK" | "CHOSE";

/** Staff-hours of cleanup: staffers of `job` standing at a building of kind `at` add 1.2 hours each tick. */
export interface WorkSpec {
  job: StaffJob;
  /** A building kind, or "$target". */
  at: string;
  /** Hours for `progress` to reach 1. */
  hours: number;
}

export interface StateNode {
  type?: "final";
  entry?: Call[];
  exit?: Call[];
  work?: WorkSpec;
  on?: Partial<Record<BeatName, TransitionDef | TransitionDef[]>>;
}

export interface CardChoiceDef {
  /** What the machine hears as `choice`. */
  key: string;
  label: string;
  hint: string;
  /** Immediate effects: the ordinary event-card vocabulary (cash, hype, news, discourse, thought, flag). */
  effects: Effect[];
}

/** An event card a disaster can open (the `card` verb). It becomes an ordinary `EventDef` with id `dz:<disaster>:<id>`. */
export interface CardDef {
  id: string;
  stripe?: string;
  title: string;
  body: string;
  tone: Tone;
  choices: CardChoiceDef[];
}

export interface OddsScale {
  stat: string;
  /** Added to the weight for each unit of the stat. */
  per: number;
}

export interface OddsDef {
  /** Baseline weight (1 is a typical disaster). The weight is then scaled by the lab's risk stats. */
  weight: number;
  scale?: OddsScale[];
  /** Clamp for the scaled weight. Defaults 0.2 to 3. */
  min?: number;
  max?: number;
  /** No random one before this game day. */
  minDay?: number;
  /** No random repeat inside this many days of the last one. */
  gapDays?: number;
}

export interface DisasterDef {
  id: string;
  name: string;
  /** One line for the Disasters menu. */
  blurb: string;
  /** A tag or two for the menu: "off-map", "fire", "staff". */
  tags?: string[];
  odds: OddsDef;
  /** Can it be triggered right now? Evaluated against the lab's stats. */
  requires?: { guard: GuardSpec; reason: string };
  /** A building the disaster is about (`$target` in verbs), picked when it starts. */
  target?: { kind: BuildingKind; pick?: "random" | "first" | "last" };
  initial: string;
  states: Record<string, StateNode>;
  cards?: CardDef[];
}

/** The file format of a content pack (FLT-15 section shape); this is the part FLT-17 owns. */
export interface DisasterPack {
  apiVersion: 1;
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  content: { disasters: { add: DisasterDef[] } };
}

// ---- World state ---------------------------------------------------------------------------------------------

/** Random disasters: how often the world goes wrong on its own. */
export type Risk = "off" | "rare" | "normal" | "chaos";
export const RISKS: readonly Risk[] = ["off", "rare", "normal", "chaos"];

/** The persisted part of a disaster machine. */
export interface DisasterContext {
  id: string;
  startedDay: number;
  /** The tick the current state was entered: timers count from here. */
  enteredTick: number;
  /** Cleanup progress 0..1, and the staff-hours behind it. */
  progress: number;
  hours: number;
}
export interface DisasterStored {
  value: string;
  context: DisasterContext;
}

/** A staff diversion a disaster keeps in force: new hires of the job are pulled in too. */
export interface DivertSpec {
  job: StaffJob;
  /** A building id, or 0 for the gate. */
  to: number;
  fraction: number;
  jog: number;
}

export interface DisasterRun {
  id: string;
  startedDay: number;
  startedTick: number;
  machine: DisasterStored;
  /** Building the disaster is about (0 for none). */
  target: number;
  /** Buildings this run set on fire or took offline. */
  fires: number[];
  /** The card it has offered and not seen answered, or null. */
  card: string | null;
  diverts: DivertSpec[];
  /** Template variables verbs have set (`{leapRival}`, `{target}`) for later headlines. */
  vars: Record<string, string>;
  /** The player asked for it (menu or dev hook), rather than the dice. */
  forced: boolean;
}

/** Things that change the numbers for a while: a drained cluster, a tripled bill. */
export interface TimedEffect {
  id: number;
  /** The disaster that owns it (its id), or "" for none: an owned effect ends with the disaster. */
  owner: string;
  kind: "drain" | "spike" | "revenue" | "auditor";
  /** drain: fraction lost per day; spike, revenue, auditor: a multiplier. */
  value: number;
  /** The tick it wears off; -1 lasts as long as the owner does. */
  until: number;
  /** spike: which building kinds pay more (empty: all of them). */
  kinds: string[];
}

/** The sim's way of telling the renderer and the sound layer: read-only cues, each with a rising id. */
export type Cue = { id: number; tick: number } & (
  | { type: "focus"; x: number; z: number; zoom: number; hold: number | null }
  | { type: "shake"; strength: number }
  | { type: "sound"; cue: string }
);

export interface HistoryRow {
  id: string;
  name: string;
  startedDay: number;
  endedDay: number;
}

export interface DisastersState {
  risk: Risk;
  /** Its own random stream: a lab that never has a disaster draws exactly the numbers it did before there were any. */
  rngState: number;
  runs: DisasterRun[];
  /** Day the last disaster of any kind began, and of each kind. */
  lastStart: number;
  lastByDef: Record<string, number>;
  /** The last 20 that finished. */
  history: HistoryRow[];
  effects: TimedEffect[];
  cues: Cue[];
  /** Public trust and regulatory heat, 0 to 100: trust starts at 50, heat at 0. FLT-19 (auditors) reads both. */
  trust: number;
  heat: number;
  /** Disasters begun, all time. */
  started: number;
}

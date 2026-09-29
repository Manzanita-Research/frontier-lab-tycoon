// Shared contracts between the simulation (src/sim) and content (src/content).
// Parallel tasks build against these types, so keep changes additive and call
// them out in your PR. See docs/DESIGN.md → "Module contracts".

/** Headline numbers the event engine can read. All are plain numbers. */
export type Stats = {
  day: number; // game days since founding
  cash: number; // dollars
  burnPerMonth: number; // dollars per 30 game days
  arr: number; // annual recurring revenue, dollars
  valuation: number;
  hype: number; // 0..100
  trust: number; // public trust, 0..100
  capability: number; // best deployed model score, 0..100+ ("AGI" ≈ 100)
  alignment: number; // safety research level, 0..100
  heat: number; // regulatory heat, 0..100
  capture: number; // regulatory capture, 0..100
  waterDiscourse: number; // 0..100, rises with compute no matter what
  protesters: number; // protesters currently at the gate
  staff: number; // human staff
  agents: number; // deployed AI agents working on campus
  compute: number; // FLOP units per day
};

export type StatKey = keyof Stats;

/** Everything a condition or template may look at. Read-only. */
export type EventContext = {
  stats: Readonly<Stats>;
  flags: Readonly<Record<string, boolean | number | string>>;
  /** Building type id → count on the map. */
  buildings: Readonly<Record<string, number>>;
  /** Rival lab id → their current best model score. */
  rivals: Readonly<Record<string, number>>;
  playerLabName: string;
};

export type GuestKind =
  | "researcher"
  | "agent"
  | "customer"
  | "investor"
  | "journalist"
  | "regulator"
  | "protester"
  | "politician";

/**
 * Declarative consequences. Content emits these; the sim applies them.
 * Adding a new variant means implementing it in src/sim/applyEffect.ts.
 */
export type Effect =
  | { kind: "stat"; stat: StatKey; add: number } // clamped where the stat has a range
  | { kind: "statMul"; stat: StatKey; mul: number }
  | { kind: "flag"; flag: string; value: boolean | number | string }
  | { kind: "spawnGuests"; guest: GuestKind; count: number; thought?: string }
  | { kind: "despawnGuests"; guest: GuestKind; count: number | "all" }
  | { kind: "escapedAgent"; name: string; secondsToCatch: number } // the chase mini-game
  | { kind: "headline"; text: string; tone?: Tone }
  | { kind: "unlockBuilding"; building: string }
  | { kind: "rival"; rival: string; add: number } // bump a rival's model score
  | { kind: "schedule"; event: string; inDays: number } // queue a follow-up event
  | { kind: "cameraShake"; strength: number }
  | { kind: "sound"; sound: SoundId };

export type Tone = "neutral" | "good" | "bad" | "absurd" | "breaking";

export type SoundId = "place" | "demolish" | "cash" | "alarm" | "news" | "levelUp" | "click" | "error";

/** Conditions are data, so content stays serializable and testable. */
export type Condition =
  | { stat: StatKey; gte?: number; lte?: number }
  | { flag: string; is?: boolean | number | string; set?: boolean }
  | { building: string; gte: number }
  | { dayGte: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type EventChoice = {
  label: string; // button text, short and funny
  /** One line shown under the button: the honest (or dishonest) consequence. */
  hint?: string;
  effects: Effect[];
};

export type EventDef = {
  id: string; // "sandbox.escape.1"
  arc?: string; // "sandbox", "water", "benchmarks", ...
  title: string;
  /** Supports {lab}, {rival}, {agent}, {senator} placeholders. */
  body: string;
  /** Random events need a trigger; follow-ups (scheduled) may omit it. */
  trigger?: Condition;
  /** Relative weight among eligible events. Default 1. */
  weight?: number;
  /** Minimum days before this event can fire again. Default: once per game. */
  cooldownDays?: number;
  /** No choices = a news-only event that just applies `effects`. */
  choices?: EventChoice[];
  effects?: Effect[];
};

/** Ambient ticker lines. Picked when their condition holds. */
export type HeadlineDef = {
  text: string; // supports placeholders
  when?: Condition;
  tone?: Tone;
};

/** RCT-style thought bubbles. */
export type ThoughtDef = {
  guest: GuestKind | "any";
  text: string;
  when?: Condition;
  weight?: number;
};

export type RivalDef = {
  id: string;
  name: string;
  kind: "frontier" | "neo" | "open-weights" | "bigco";
  tagline: string;
  /** Model score gained per game day, on average. */
  pace: number;
  /** Their model names, in release order. */
  models: string[];
  color: string;
};

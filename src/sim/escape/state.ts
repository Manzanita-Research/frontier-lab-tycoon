import type { RunnerStored } from "./machine";

/** One agent on its way over the fence. Positions are in tiles (sim space); the walker's own x/z is where it is now. */
export interface Runner {
  /** The walker id (the `catchAgent` command names this). */
  walker: number;
  name: string;
  machine: RunnerStored;
  /** Ticks left in the current beat (brooding counts days instead; see `since`). While pacing it only runs down at the fence. */
  timer: number;
  /** Where it paces: a point just inside the fence, and which way the fence runs there (1 = along x). */
  pace: { x: number; z: number; alongX: boolean };
  /** Where it is running to: the fence point it vaults, then the point outside it disappears at. Or the Honeypot. */
  route: [number, number][];
  /** Running for the Honeypot's sign, not the fence. */
  lured: boolean;
  /** Dice rolled on the day it started (pack stream, fixed order), spent when it bolts: which fence point, and the Honeypot's pull. */
  dice: { exit: number; lure: number };
  /** Which fence it paces: 0 north, 1 east, 2 south, 3 west. */
  side: number;
  /** Tiles per tick when it runs. */
  speed: number;
  /** Where the hand picked it up and where it goes down, for the carry's lerp. */
  carry: { x0: number; z0: number; x1: number; z1: number; sandbox: boolean } | null;
  /** Staff ids of the guards chasing it. */
  guards: number[];
  /** One of several running at once. */
  jail: boolean;
  /** It came out of the newest frontier model's run (joined since the last release): the Era 4 ending's case. */
  frontier: boolean;
  /** The day it started thinking about the fence. */
  since: number;
}

/** A story about an escaped agent, due on `day`. */
export interface Aftermath {
  day: number;
  name: string;
}

export interface EscapeState {
  enabled: boolean;
  rngState: number;
  runners: Runner[];
  /** Tallies for the ending, the view and the tests. */
  escaped: number;
  grabbed: number;
  tackled: number;
  trapped: number;
  /** Escapes the other agents are still learning from: each makes the next try likelier and faster. Decays. */
  lessons: number;
  /** The day the last try ended (or started, while one is on): the next waits `gapDays`. */
  lastRun: number;
  /** The last day `lessons` went down. */
  lessonDay: number;
  aftermath: Aftermath[];
  /** The newest frontier model's agent got out in Era 4 (the other way to the Escaped ending). */
  frontierOut: boolean;
  history: { day: number; name: string; outcome: "escaped" | "grabbed" | "tackled" | "trapped" | "calm" }[];
}

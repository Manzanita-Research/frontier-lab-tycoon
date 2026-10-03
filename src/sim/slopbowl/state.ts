import type { SlopBowlStored } from "./machine";

/** The lunch order (FLT-109), in the World as `GameState.slopbowl`. Additive: a save from before it simply has none. */
export interface SlopBowlState {
  enabled: boolean;
  /** Its own random stream (the noon die, who thinks and posts what, the courier's name), so the main stream never moves for it. */
  rngState: number;
  machine: SlopBowlStored;
  /** The day the pack woke, and the day an order last ran late (null: never). */
  wokeDay: number;
  lastDay: number | null;
  /** The share of researchers (0 to 1) waiting at the gate right now: 0 when nobody is. */
  crowd: number;
  /** Training progress the hunger took that the lab has not won back yet. */
  owed: number;
  /** The courier (a visitor, walker id) and the researcher who signs for the bowls, while they meet at the gate. */
  courier: number | null;
  host: number | null;
  /** The researchers lying on the floor at the gate (day three's meltdown) until the bowls come. Absent in a save from before. */
  flopped?: number[];
  /** The thought bubbles the order put up, so the next beat replaces them. */
  said: number[];
  tally: { late: number; lost: number };
}

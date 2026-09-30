import type { ChartContext, ChartStored } from "../circus/chart";

/** One vote on the record: what the senator promised about the motion, how they voted, whether that was the same thing. */
export type VoteRecord = { motion: string; title: string; day: number; said: "aye" | "nay" | "both"; voted: "aye" | "nay"; kept: boolean; lobbied: boolean };
/** A senator's record: promises kept and broken ("both" counts as kept: technically true), and the latest votes. */
export type SenatorRecord = { kept: number; broken: number; log: VoteRecord[] };

/** The promises chart's context: the motion on the docket, who has been lobbied, the roll call, and every senator's record. */
export interface PromisesContext extends ChartContext {
  enteredTick: number;
  /** The motion's id (FLT-22's bill is "bill"), and its title as the Senate reads it. */
  motion: string;
  title: string;
  /** Senators the lab's lobbyists have seen about this motion. */
  lobbied: string[];
  /** This roll call, once counted: senator id → "aye" or "nay". */
  votes: Record<string, string>;
  ayes: number;
  records: Record<string, SenatorRecord>;
  /** Roll calls held, all time. */
  held: number;
}
export type PromisesStored = ChartStored<PromisesContext>;

export interface MotionResult { motion: string; title: string; passed: boolean; ayes: number; nays: number; day: number; lobbied: string[] }

export interface PromisesState {
  enabled: boolean;
  /** Its own random stream: turning the pack on never moves the baseline's dice. */
  rngState: number;
  machine: PromisesStored;
  /** A motion put to the floor out of turn (FLT-22's bill), heard at the next recess. */
  tabled: { id: string; title: string } | null;
  /** The docket's next motion (rolled when the last one was called). */
  next: string;
  /** The last few motions heard, so the docket does not repeat itself at once. */
  recent: string[];
  /** The last roll call's result (FLT-22 reads it for the bill). */
  last: MotionResult | null;
}

import type { ChartContext, ChartStored } from "../circus/chart";

/** The capture chart's context: the clauses the bill went to the floor with. */
export interface BillContext extends ChartContext {
  enteredTick: number;
  clauses: string[];
}
export type BillStored = ChartStored<BillContext>;

export interface BillRecord {
  day: number;
  act: string;
  clauses: string[];
  /** How it ended: "declined", "failed", "sunset" or "exposed". */
  outcome: string;
}

export interface BillState {
  enabled: boolean;
  /** Its own random stream: turning the pack on never moves the baseline's dice. */
  rngState: number;
  machine: BillStored;
  /** The bill's name, rolled when the staffer emails. */
  act: string;
  /** The clauses ticked on the draft so far (the card's word processor). */
  draft: string[];
  /** The day the bill went to the floor, and the day it became law (or null). */
  floorDay: number | null;
  lawDay: number | null;
  /** The last roll call on the bill: ayes out of three (null until counted). */
  ayes: number | null;
  /** Each rival's release count when the driver last looked, so a release under the law makes the news once. */
  seen: Record<string, number>;
  /** Bills gone by, newest last (the last 8). */
  history: BillRecord[];
}

import type { ChartStored } from "../machines/packChart";
import type { NeoMood } from "../neolabs/state";

export type DefectionStage = "watching" | "courted" | "deciding" | "farewell" | "storming";
export type DefectionPick = "counter" | "equity" | "title" | "goodbye";

/** The researcher the VCs are courting. */
export interface DefectionSubject {
  id: number;
  name: string;
  role: string;
  /** Index into THEIR. */
  pro: number;
  /** A reason id from the pack ("concerns", "money", ...). */
  reason: string;
  /** Who they worked with (joined around the same time), closest first: the followers come from here. */
  team: number[];
  /** Tenure against the longest-serving researcher, 0 to 1. */
  seniority: number;
  /** Day the VCs first came. */
  since: number;
}

/** Someone who has walked out and is about to found a lab. */
export interface DefectionExit {
  day: number;
  founderId: number;
  founder: string;
  pro: number;
  followerIds: number[];
  followers: string[];
  mood: NeoMood;
  /** Capability lost, in percent. */
  loss: number;
  /** The lab they founded, once they have. */
  lab: string | null;
}

export interface DefectionState {
  enabled: boolean;
  rngState: number;
  machine: ChartStored<DefectionStage>;
  /** The hidden defect score per researcher id, 0 to 100. */
  scores: Record<number, number>;
  /** Counter-offers taken: each makes the score rise faster next time. */
  bumps: Record<number, number>;
  /** Releases shipped without them getting a title. */
  passedOver: Record<number, number>;
  /** Times seen with a VC by the Kombucha Bar (the inspector's history line). */
  seen: Record<number, number>;
  /** How many models had shipped at the last check (for "passed over"). */
  models: number;
  /** The day the last courtship ended (a pick, a cooling-off, an exit): the VCs wait `gapDays` before the next. */
  resolved: number;
  subject: DefectionSubject | null;
  /** The last exit; `lab` is filled in once they found it. */
  exit: DefectionExit | null;
  history: { day: number; stage: DefectionStage; name: string }[];
}

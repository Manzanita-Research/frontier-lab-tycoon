import type { ChartStored } from "../machines/packChart";

export type PoachingStage = "quiet" | "offered" | "walkout";

/** One offer, to several researchers at once. */
export interface PoachOffer {
  day: number;
  /** The poaching lab: a built-in rival id or a neo lab's. */
  from: string;
  name: string;
  short: string;
  targets: number[];
  names: string[];
}

export interface PoachingState {
  enabled: boolean;
  rngState: number;
  machine: ChartStored<PoachingStage>;
  offer: PoachOffer | null;
  /** Someone who left and will found a lab `delayDays` later. */
  founding: { day: number; founderId: number; founder: string; followers: string[]; from: string; fromShort: string; lab: string | null } | null;
  /** Offers made, matched, talked down, and people lost to them. */
  tally: { offers: number; matched: number; stayed: number; lost: number };
  history: { day: number; stage: PoachingStage }[];
}

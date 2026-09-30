import type { ChartContext, ChartStored } from "../circus/chart";

/** The hearing chart's context: why the lab is here, the docket (one question card per senator) and the session's tallies. */
export interface HearingContext extends ChartContext {
  enteredTick: number;
  topic: string;
  /** The trigger that summoned the lab ("era", "scandal", ...). */
  trigger: string;
  /** Question card ids, in the order the senators ask them. */
  docket: string[];
  /** The player's answer keys so far ("earnest", "slick", "chaotic"). */
  answers: string[];
  sessionTrust: number;
  sessionCapture: number;
  chaos: number;
}
export type HearingStored = ChartStored<HearingContext>;

export interface HearingRecord {
  day: number;
  topic: string;
  trigger: string;
  verdict: string;
  trust: number;
  capture: number;
}

export interface HearingState {
  enabled: boolean;
  /** Its own random stream: turning the pack on never moves the baseline's dice. */
  rngState: number;
  machine: HearingStored;
  enabledDay: number;
  /** Per trigger, what the driver has already reacted to: a flag's day, a stat's last value, or 1 once latched. */
  seen: Record<string, number>;
  /** Past hearings, newest last (the last 12). FLT-19 and FLT-22 read the latest. */
  history: HearingRecord[];
}

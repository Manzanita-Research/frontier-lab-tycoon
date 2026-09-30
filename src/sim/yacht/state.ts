import type { ChartContext, ChartStored } from "../circus/chart";

export type YachtStored = ChartStored<ChartContext>;
export interface YachtState {
  enabled: boolean;
  /** Its own random stream (the price-fixing ticker's picks). */
  rngState: number;
  machine: YachtStored;
  /** How the lab answered the invitation: "sign", "intern" or "decline". */
  rsvp: string | null;
  /** The day the chat leaked, and how the lab handled it. */
  leakDay: number | null;
  ending: string | null;
}

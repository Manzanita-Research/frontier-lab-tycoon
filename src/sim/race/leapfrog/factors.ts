// What the news cycle and your credibility are worth in the rest of the game. Small pure functions, read by the money
// code (sim/race/finance.ts) and the driver. Asleep (a factor of 1) while the pack is off.
import { LEAPFROG } from "../../../content/leapfrog";
import { YOU } from "../../../content/rivals";
import type { GameState } from "../../types";
import { shareOf } from "./voice";

const R = LEAPFROG.rules;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Your share of the news cycle, 0 to 1. */
export const yourShare = (state: GameState): number => shareOf(state.leapfrog.voice.context, YOU);

/** Trust as a 0.x multiplier: 1 at full trust, `valuationBase` at none. */
export const trustFactor = (state: GameState): number => R.trust.valuationBase + R.trust.valuationWeight * (state.leapfrog.trust / 100);

/** Investors pay for a lab everyone is talking about, and less for one whose screenshots don't reproduce. */
export function valuationFactor(state: GameState): number {
  if (!state.leapfrog.enabled) return 1;
  return clamp(R.valuation.base + R.valuation.perShare * yourShare(state), 0.8, 1.4) * trustFactor(state);
}

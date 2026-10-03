// How lunch moves the research (FLT-109): backwards while the lab is hungry, then won back once it has eaten.
// training.ts asks; this module only reads the pack and the World, so the training loop can import it without a cycle.
import type { GameState } from "../types";
import { SLOPBOWL } from "./pack";
import type { SlopBowlState } from "./state";

const R = SLOPBOWL.rules;

/** Hungry: research is going backwards. */
export const hungry = (sb: SlopBowlState | undefined): boolean => {
  const v = sb?.enabled ? sb.machine.value : "quiet";
  return v === "hangry" || v === "worse" || v === "meltdown" || v === "arriving";
};

/** How far a day's training goes (training.ts's ETA): backwards while hungry, faster while it is winning lunch back. Read-only. */
export function lunchPace(s: GameState): number {
  const sb = s.slopbowl;
  if (!sb?.enabled) return 1;
  if (hungry(sb)) return -R.research.backwards * (sb.machine.context.pick === "granola" ? R.research.granola : 1);
  return sb.owed > 0 ? 1 + R.research.catchUp : 1;
}

/**
 * What a day of training adds, given what it would have (`gain`): the identity unless lunch is late. While hungry the
 * run goes backwards (never below zero) and the lab owes itself the difference; once fed it wins it back, `catchUp` of
 * a day's gain a day on top of the day's own.
 */
export function lunchGain(s: GameState, gain: number): number {
  const sb = s.slopbowl;
  if (!sb?.enabled || gain <= 0) return gain;
  if (hungry(sb)) {
    const take = Math.min(s.training.context.progress, -gain * lunchPace(s));
    sb.owed += take;
    sb.tally.lost += take;
    return take > 0 ? -take : 0;
  }
  if (sb.owed <= 0) return gain;
  const back = Math.min(sb.owed, gain * R.research.catchUp);
  sb.owed -= back;
  return gain + back;
}

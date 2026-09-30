// The rulebook the rivals race under (FLT-22): timed effects of kind `rivalGrowth`, `rivalPace` and `rivalClosed`, set by
// the Vocabulary's `rival.growth`, `rival.pace` and `rival.closed` (a law's clauses, say). The weekly cycle and the
// launch calendar read `rivalRules` for each lab. With no such effect in play every factor is 1 and nothing changes.
import { RIVAL_BY_ID, type RivalId } from "../../content/rivals";
import type { TimedEffect } from "../disasters/types";
import type { GameState } from "../types";

export interface RivalRules {
  /** Multiplies what a release adds. */
  growth: number;
  /** Multiplies the era's pace (below 1, runs take longer). */
  pace: number;
  /** The lab may not ship open weights. */
  closed: boolean;
}
const FREE: RivalRules = { growth: 1, pace: 1, closed: false };
const KINDS: ReadonlySet<string> = new Set(["rivalGrowth", "rivalPace", "rivalClosed"]);

/**
 * Does a selector list name this lab? Entries are rival ids or `below` (behind your capability), `above`, `open` (a lab
 * that ships open weights at all); `!x` excludes. No positive entry means every lab.
 */
export function rivalMatches(state: GameState, lab: { id: string; capability: number }, who: readonly string[]): boolean {
  const test = (sel: string) => {
    if (sel === "below") return lab.capability < state.capability;
    if (sel === "above") return lab.capability >= state.capability;
    if (sel === "open") return (RIVAL_BY_ID[lab.id as RivalId]?.personality.openness ?? 0) > 0;
    return sel === lab.id;
  };
  const yes = who.filter((w) => !w.startsWith("!"));
  if (who.some((w) => w.startsWith("!") && test(w.slice(1)))) return false;
  return yes.length === 0 || yes.some(test);
}

const live = (state: GameState, e: TimedEffect) => e.until < 0 || state.tick < e.until;

/** The rules a lab races under today. */
export function rivalRules(state: GameState, lab: { id: string; capability: number }): RivalRules {
  const effects = state.disasters.effects;
  if (!effects.some((e) => KINDS.has(e.kind))) return FREE;
  const out = { ...FREE };
  for (const e of effects) {
    if (!KINDS.has(e.kind) || !live(state, e) || !rivalMatches(state, lab, e.kinds)) continue;
    if (e.kind === "rivalGrowth") out.growth *= e.value;
    else if (e.kind === "rivalPace") out.pace *= e.value;
    else out.closed = true;
  }
  return out;
}

/** Is any rule on the rivals in force? (The HUD's "under the law" tags.) */
export const rivalRulesInForce = (state: GameState): boolean => state.disasters.effects.some((e) => KINDS.has(e.kind) && live(state, e));

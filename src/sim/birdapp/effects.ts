// What the rest of the sim reads from the Bird App (FLT-69). Each is the identity (+0, ×1) while the pack is asleep,
// so a run without it keeps every number. Its own module, so the economy, the crowd and the gate need not import the
// driver.
import type { GameState } from "../types";
import { BIRD as R } from "./pack";

/** Resting Hype from Aura. */
export const auraHype = (s: Pick<GameState, "birdapp">): number => (s.birdapp?.enabled ? s.birdapp.aura * R.effects.hype : 0);
/** Visitor demand, times this. */
export const auraVisitors = (s: Pick<GameState, "birdapp">): number => (s.birdapp?.enabled ? 1 + s.birdapp.aura / R.effects.visitors : 1);
/** The chance an applicant turns up, times this. */
export const auraApplicants = (s: Pick<GameState, "birdapp">): number => (s.birdapp?.enabled ? 1 + s.birdapp.aura / R.effects.applicants : 1);
/** Who a rival calls first (higher first): a cancelled poster with something to prove, then a big account. */
export function poachAppeal(s: Pick<GameState, "birdapp">, id: number): number {
  const p = s.birdapp?.enabled ? s.birdapp.posters[id] : undefined;
  if (!p) return 0;
  return p.hot ? 2 : p.machine.value === "big" ? 1 : 0;
}

// Hooks for the Arena and Leapfrog; honest capability and rival claims are untouched.
import type { GameState } from "../types";
import { COLLUSION } from "./pack";
import { activeSwarm } from "./state";
export const evalInvalid = (s: Pick<GameState, "collusion" | "day">): boolean => !!s.collusion?.enabled && s.day < s.collusion.invalidUntil;
export function evalBonus(s: Pick<GameState, "collusion">): number {
  const c = s.collusion;
  if (!c?.enabled || !["seeded", "spreading", "organized"].includes(c.machine.value)) return 0;
  const r = COLLUSION.rules.scores;
  return r.minBonus + (r.maxBonus - r.minBonus) * c.machine.context.score / 100;
}
export function collusionScore(s: Pick<GameState, "collusion" | "day">, honest: number): number | null {
  if (evalInvalid(s)) return null;
  return honest * (1 + evalBonus(s));
}
export { activeSwarm };

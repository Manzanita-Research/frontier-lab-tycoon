// The words the Leapfrog cards can use, filled in from the World when the card is shown: {lfRival} {lfModel} {lfReady}
// {lfShip} {lfHold} {lfBug} {lfHoldDays} {lfMine}. They join the race's variables (sim/race/finance.ts raceVars).
import { LEAPFROG } from "../../../content/leapfrog";
import { RIVAL_BY_ID, type RivalId, YOU } from "../../../content/rivals";
import { releaseGain } from "../../machines/training";
import type { GameState } from "../../types";
import { rdMultiplier, releaseBoost } from "../rd";

const R = LEAPFROG.rules;

/** How far through the run you are, 0 to 1. */
export function readiness(state: GameState): number {
  const { progress, cost } = state.training.context;
  return Math.max(0, Math.min(1, progress / cost));
}

/** What shipping the run now adds, and what waiting for the whole run would add. */
export function shipGains(state: GameState): { ship: number; hold: number } {
  const full = releaseGain(state.training.context.run) * releaseBoost(rdMultiplier(state));
  return { ship: full * readiness(state) * R.response.shipQuality, hold: full };
}

/** The chance an early release has a launch bug: worse the less baked it is. */
export const bugChance = (ready: number): number => Math.min(0.9, R.response.bugBase + R.response.bugPerMissing * (1 - ready));

const nameOf = (state: GameState, id: string): string => (id === YOU ? state.labName : (RIVAL_BY_ID[id as RivalId]?.name ?? state.neoLabs?.labs.find((l) => l.id === id)?.name ?? id));

export function leapfrogVars(state: GameState): Record<string, string> {
  const lf = state.leapfrog;
  if (!lf.enabled) return {};
  const ready = readiness(state);
  const gains = shipGains(state);
  const topRival = state.race.board.find((r) => r.id !== YOU);
  const rivalId = lf.last && lf.last.lab !== YOU ? lf.last.lab : (topRival?.id ?? "");
  return {
    lfRival: rivalId ? nameOf(state, rivalId) : "A rival",
    lfModel: lf.last && lf.last.lab === rivalId ? lf.last.model : "their new model",
    lfReady: String(Math.round(ready * 100)),
    lfShip: gains.ship.toFixed(1),
    lfHold: gains.hold.toFixed(1),
    lfBug: String(Math.round(bugChance(ready) * 100)),
    lfHoldDays: String(R.response.holdDays),
    lfMine: state.models[state.models.length - 1] ?? state.training.context.name,
  };
}

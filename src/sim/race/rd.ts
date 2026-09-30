// The R&D multiplier: how much faster the lab trains than humans alone would.
//   1 + agents x agentSkill(capability) / max(1, researchers x 10)
import { systemUnlocked } from "../progression";
import { releaseGain } from "../machines/training";
import type { GameState } from "../types";

/** What one agent adds, per ten researchers' worth of work. It grows with capability. */
export const agentSkill = (capability: number): number => capability / 8;

/**
 * When the agents do the research, each release is a bigger leap: the capability a run adds is scaled by
 * (multiplier / 2) ^ 0.75, so nothing changes until Era 2 and the leaps grow from there, up to a cap. This is what
 * turns "training gets faster" into a takeoff instead of a slow grind.
 */
export const MAX_RELEASE_BOOST = 4;
export const releaseBoost = (mult: number): number => Math.min(MAX_RELEASE_BOOST, Math.max(1, mult / 2) ** 0.75);

export function multiplierFor(agents: number, researchers: number, capability: number): number {
  return 1 + (agents * agentSkill(capability)) / Math.max(1, researchers * 10);
}

/**
 * The capability the agents have to work with: what the lab has shipped, plus the part of the next release that
 * training has already delivered. Without the second term the multiplier would jump at each release and sit still
 * in between; with it, it creeps up all through a run, and an era can begin mid-run.
 */
export function workingCapability(state: Pick<GameState, "capability" | "training">): number {
  const { run, progress, cost } = state.training.context;
  return state.capability + Math.max(0, Math.min(1, progress / cost)) * releaseGain(run);
}

export function rdMultiplier(state: Pick<GameState, "walkers" | "capability" | "training" | "progression">): number {
  if (!systemUnlocked(state, "rnd")) return 1;
  let agents = 0;
  let researchers = 0;
  for (const w of state.walkers) {
    if (w.kind === "agent") agents++;
    else if (w.kind === "researcher") researchers++;
  }
  return multiplierFor(agents, researchers, workingCapability(state));
}

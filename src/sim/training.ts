// Clusters make compute, halls turn it into progress, finished runs become models.
import type { EmittedFrom, EventFromLogic } from "xstate";
import { modelName } from "../content/names";
import { COMPUTE_PER_CLUSTER, COMPUTE_PER_HALL } from "./constants";
import { formatMoney } from "./format";
import { addToast, pushNews } from "./news";
import { step, type Stepped } from "./machines/run";
import { trainingMachine } from "./machines/training";
import { happinessOf } from "./needs";
import { isReachable } from "./pathfind";
import { settlePreview } from "./race/leapfrog/ops";
import { datacenterCompute } from "./race/power";
import { rdMultiplier, releaseBoost } from "./race/rd";
import type { Rng } from "./rng";
import type { GameState } from "./types";

const COMPUTE_CAP = 500;
const LAUNCH_BONUS_PER_GAIN = 15_000;

/** Happy researchers train faster: 75% speed when everyone is miserable, 100% when everyone is buzzing. */
export function morale(state: GameState): number {
  const rs = state.walkers.filter((w) => w.kind === "researcher");
  if (rs.length === 0) return 0.7;
  return rs.reduce((sum, w) => sum + happinessOf(w), 0) / rs.length;
}

export function computePerDay(state: GameState): number {
  return state.buildings.filter((b) => b.kind === "cluster" && !b.broken).length * COMPUTE_PER_CLUSTER + datacenterCompute(state);
}

/**
 * Days until the current run finishes at today's pace (the HUD's "about 18 days remaining"), or null when nothing is
 * training. Pure and read-only: it mirrors `dailyTraining`'s arithmetic without touching the World or the rng.
 */
export function trainingEtaDays(state: GameState): number | null {
  const halls = state.buildings.filter((b) => b.kind === "hall").length;
  if (halls === 0) return null;
  const spend = Math.min(COMPUTE_PER_HALL * halls, state.compute + computePerDay(state));
  const gain = spend * (0.75 + 0.25 * morale(state)) * rdMultiplier(state);
  if (gain <= 0) return null;
  const { cost, progress } = state.training.context;
  return Math.max(0, Math.ceil((cost - progress) / gain));
}

/** Once a game day: clusters fill the stockpile, halls spend it, and the machine decides what that adds up to. */
export function dailyTraining(state: GameState, rng: Rng) {
  state.compute = Math.min(COMPUTE_CAP, state.compute + computePerDay(state));
  // A hall that is on fire trains nothing.
  const halls = state.buildings.filter((b) => b.kind === "hall" && !b.broken).length;
  let gain = 0;
  if (halls > 0) {
    const spend = Math.min(COMPUTE_PER_HALL * halls, state.compute);
    state.compute -= spend;
    // The R&D multiplier: agents doing research make every unit of compute go further.
    gain = spend * (0.75 + 0.25 * morale(state)) * rdMultiplier(state);
  }
  feed(state, rng, { type: "DAY", halls, gain });
}

/** Ship the run in progress now as a preview that lands `scale` of the release; the run carries on (Release Leapfrog's "ship now"). Only from `training`. */
export function shipEarly(state: GameState, rng: Rng, scale: number) {
  feed(state, rng, { type: "SHIP_NOW", scale });
}

/**
 * Send the machine an event and apply what it emits, in order. After a release the machine waits in `releasing`
 * for a name: the driver rolls it here, after the release effects and before the next run's, which is the order
 * the pre-port loop drew the rng in.
 */
function feed(state: GameState, rng: Rng, first: EventFromLogic<typeof trainingMachine>) {
  let event: EventFromLogic<typeof trainingMachine> | null = first;
  while (event) {
    const { stored, effects }: Stepped<typeof trainingMachine> = step(trainingMachine, state.training, event);
    state.training = stored;
    for (const e of effects) apply(state, rng, e);
    event = stored.value === "releasing" ? { type: "NAMED", name: modelName(stored.context.run + 1, rng, state.day) } : null;
  }
}

function apply(state: GameState, rng: Rng, e: EmittedFrom<typeof trainingMachine>) {
  switch (e.type) {
    case "RELEASED": {
      // The R&D multiplier makes the leap bigger (sqrt of it), so the takeoff is felt in what a release adds.
      // A preview already paid out part of this release (Release Leapfrog's "ship now"): only the rest lands.
      const gain = settlePreview(state, e.gain * releaseBoost(rdMultiplier(state)));
      state.capability += gain;
      state.hype = Math.min(100, state.hype + 15);
      state.models.push(e.model);
      state.flags.lastRelease = state.day;

      const gateways = state.buildings.filter((b) => b.kind === "gateway" && isReachable(state, b)).length;
      const bonus = LAUNCH_BONUS_PER_GAIN * gain * Math.min(3, gateways);
      state.cash += bonus;
      addToast(
        state,
        bonus > 0 ? `${e.model} is out! Launch week: +${formatMoney(bonus)}` : `${e.model} is out! Build an API Gateway to sell it.`,
        "good",
      );
      pushNews(state, rng, "runDone", { model: e.model });
      return;
    }
    case "RUN_STARTED":
      pushNews(state, rng, "runStarted", { model: e.model });
      return;
  }
}

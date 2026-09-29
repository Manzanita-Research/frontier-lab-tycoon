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
  return state.buildings.filter((b) => b.kind === "cluster").length * COMPUTE_PER_CLUSTER;
}

/** Once a game day: clusters fill the stockpile, halls spend it, and the machine decides what that adds up to. */
export function dailyTraining(state: GameState, rng: Rng) {
  state.compute = Math.min(COMPUTE_CAP, state.compute + computePerDay(state));
  const halls = state.buildings.filter((b) => b.kind === "hall").length;
  let gain = 0;
  if (halls > 0) {
    const spend = Math.min(COMPUTE_PER_HALL * halls, state.compute);
    state.compute -= spend;
    gain = spend * (0.75 + 0.25 * morale(state));
  }
  feed(state, rng, { type: "DAY", halls, gain });
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
      state.capability += e.gain;
      state.hype = Math.min(100, state.hype + 15);
      state.models.push(e.model);
      state.flags.lastRelease = state.day;

      const gateways = state.buildings.filter((b) => b.kind === "gateway" && isReachable(state, b)).length;
      const bonus = LAUNCH_BONUS_PER_GAIN * e.gain * Math.min(3, gateways);
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

// Clusters make compute, halls turn it into progress, finished runs become models.
import { modelName } from "../content/names";
import { COMPUTE_PER_CLUSTER, COMPUTE_PER_HALL } from "./constants";
import { formatMoney } from "./format";
import { addToast, pushNews } from "./news";
import { isReachable } from "./pathfind";
import type { Rng } from "./rng";
import type { GameState } from "./types";

const COMPUTE_CAP = 500;
const LAUNCH_BONUS_PER_GAIN = 15_000;

/** Well-fed researchers train faster: 75% speed when everyone is drained, 100% when everyone is buzzing. */
export function morale(state: GameState): number {
  const rs = state.walkers.filter((w) => w.kind === "researcher");
  if (rs.length === 0) return 0.7;
  return rs.reduce((sum, w) => sum + w.energy, 0) / rs.length;
}

export function computePerDay(state: GameState): number {
  return state.buildings.filter((b) => b.kind === "cluster").length * COMPUTE_PER_CLUSTER;
}

export function dailyTraining(state: GameState, rng: Rng) {
  state.compute = Math.min(COMPUTE_CAP, state.compute + computePerDay(state));
  const halls = state.buildings.filter((b) => b.kind === "hall").length;
  if (halls === 0) return;

  const spend = Math.min(COMPUTE_PER_HALL * halls, state.compute);
  state.compute -= spend;
  const t = state.training;
  t.progress += spend * (0.75 + 0.25 * morale(state));

  while (t.progress >= t.cost) {
    const gain = 12 + 4 * t.run;
    const released = t.name;
    state.capability += gain;
    state.hype = Math.min(100, state.hype + 15);
    state.models.push(released);
    state.flags.lastRelease = state.day;

    const gateways = state.buildings.filter((b) => b.kind === "gateway" && isReachable(state, b)).length;
    const bonus = LAUNCH_BONUS_PER_GAIN * gain * Math.min(3, gateways);
    state.cash += bonus;
    addToast(
      state,
      bonus > 0 ? `${released} is out! Launch week: +${formatMoney(bonus)}` : `${released} is out! Build an API Gateway to sell it.`,
      "good",
    );
    pushNews(state, rng, "runDone", { model: released });

    t.progress -= t.cost;
    t.run += 1;
    t.cost = Math.round(t.cost * 1.6);
    t.name = modelName(t.run, rng, state.day);
    pushNews(state, rng, "runStarted", { model: t.name });
  }
}

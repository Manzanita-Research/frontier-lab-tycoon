// Scenario objectives: checked once a day, milestones latch, and the game ends in a win or a loss.
import { GOALS, SCENARIO, type GoalMetric } from "../content/goals";
import { pushNews } from "./news";
import type { Rng } from "./rng";
import type { GameState, GoalProgress } from "./types";

const METRICS: Record<GoalMetric, (s: GameState) => number> = {
  runs: (s) => s.models.length,
  revenue: (s) => s.ledger.income,
  hype: (s) => s.hype,
};

export function createGoals(): GoalProgress[] {
  return GOALS.map((g) => ({ id: g.id, value: 0, target: g.target, met: false }));
}

export function dailyGoals(state: GameState, rng: Rng) {
  if (state.outcome !== "playing") return;
  const defs = new Map(GOALS.map((g) => [g.id, g]));
  for (const goal of state.goals) {
    const def = defs.get(goal.id)!;
    goal.value = goal.met ? Math.max(goal.value, goal.target) : METRICS[def.metric](state);
    if (goal.value >= goal.target) goal.met = true;
  }

  if (state.goals.every((g) => g.met)) {
    state.outcome = "won";
    pushNews(state, rng, "won");
  } else if (state.day >= SCENARIO.deadlineDay || state.cash < SCENARIO.brokeBelow) {
    state.outcome = "lost";
    pushNews(state, rng, "lost");
  } else return;
  state.flags.outcomeDay = state.day;
}

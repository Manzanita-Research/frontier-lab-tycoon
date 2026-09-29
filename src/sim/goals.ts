// Scenario objectives: checked once a day, milestones latch, and the game ends in a win or a loss.
// The decisions live in machines/goals.ts; this reads the metrics off the World and applies the outcome.
import { GOALS, type GoalMetric } from "../content/goals";
import { step } from "./machines/run";
import { goalsMachine } from "./machines/goals";
import { pushNews } from "./news";
import type { Rng } from "./rng";
import type { GameState, GoalProgress, Outcome } from "./types";

const METRICS: Record<GoalMetric, (s: GameState) => number> = {
  runs: (s) => s.models.length,
  revenue: (s) => s.ledger.income,
  hype: (s) => s.hype,
};

export function createGoals(): GoalProgress[] {
  return GOALS.map((g) => ({ id: g.id, value: 0, target: g.target, met: false }));
}

/** The scenario's outcome as the UI knows it: the machine's `tracking` is "playing". */
export function outcomeOf(state: GameState): Outcome {
  return state.goals.value === "tracking" ? "playing" : state.goals.value;
}

export function dailyGoals(state: GameState, rng: Rng) {
  if (state.goals.value !== "tracking") return;
  const values: Record<string, number> = {};
  for (const def of GOALS) values[def.id] = METRICS[def.metric](state);
  const { stored, effects } = step(goalsMachine, state.goals, { type: "DAY", day: state.day, cash: state.cash, values });
  state.goals = stored;
  for (const e of effects) pushNews(state, rng, e.type === "WON" ? "won" : "lost");
}

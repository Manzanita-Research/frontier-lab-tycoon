// Scenario objectives: checked once a day, milestones latch, and the game ends in a win or a loss.
// The decisions live in machines/goals.ts; this reads the metrics off the World and applies the outcome.
import type { GoalMetric } from "../content/goals";
import { step } from "./machines/run";
import { goalsMachine } from "./machines/goals";
import { pushNews } from "./news";
import { eraOfState } from "./race/race";
import type { Rng } from "./rng";
import type { GameState, GoalProgress, Outcome } from "./types";
import { defs } from "./defs";

const METRICS: Record<GoalMetric, (s: GameState) => number> = {
  runs: (s) => s.models.length,
  revenue: (s) => s.ledger.income,
  hype: (s) => s.hype,
  era: (s) => eraOfState(s),
  // Places from the bottom: last of seven is 1, #1 is 7, so a bigger number is always better.
  // Only counts from Era 3 on: a top-3 place in the stumbling days would tick the box before the race has started.
  arena: (s) => (eraOfState(s) >= 3 ? defs().arenaSize + 1 - s.race.rank : 0),
};

export function createGoals(): GoalProgress[] {
  return defs().goals.map((g) => ({ id: g.id, value: 0, target: g.target, met: false }));
}

/** The scenario's outcome as the UI knows it: the machine's `tracking` is "playing". */
export function outcomeOf(state: GameState): Outcome {
  return state.goals.value === "tracking" ? "playing" : state.goals.value;
}

/** Count the releases already shipped and name the actual run currently training, including its suffixes. */
export function releaseGoalText(state: GameState): string {
  const goal = state.goals.context.goals.find((g) => g.id === "release");
  const target = goal?.target ?? 3;
  const shipped = Math.min(state.models.length, target);
  return `Ship ${target} models (${shipped}/${target})${goal?.met ? " — shipped" : `, next: ${state.training.context.name}`}`;
}

export function dailyGoals(state: GameState, rng: Rng) {
  if (state.goals.value !== "tracking") return;
  const values: Record<string, number> = {};
  for (const def of defs().goals) values[def.id] = METRICS[def.metric](state);
  const { stored, effects } = step(goalsMachine, state.goals, { type: "DAY", day: state.day, cash: state.cash, values });
  state.goals = stored;
  for (const e of effects) pushNews(state, rng, e.type === "WON" ? "won" : "lost");
}

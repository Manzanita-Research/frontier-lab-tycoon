// Scenario objectives: checked once a day, milestones latch, and the game ends in a win or a loss.
// The decisions live in machines/goals.ts; this reads the metrics off the World and applies the outcome.
import { GOAL_TEXT, type GoalMetric } from "../content/goals";
import { step } from "./machines/run";
import { goalsMachine } from "./machines/goals";
import { addToast, pushNews } from "./news";
import { fillTemplate } from "./format";
import { pushCue } from "./verbs";
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
  return defs().goals.map((g) => ({ id: g.id, value: 0, target: g.target, met: false, ...(g.hold ? { hold: g.hold, held: 0 } : {}) }));
}

/** The scenario's outcome as the UI knows it: the machine's `tracking` is "playing", and an ending's front page (FLT-11) is "ended". */
export function outcomeOf(state: GameState): Outcome {
  if (state.endings?.endedDay != null) return "ended";
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
  syncGoals(state);
  const values: Record<string, number> = {};
  for (const def of defs().goals) values[def.id] = METRICS[def.metric](state);
  const { stored, effects } = step(goalsMachine, state.goals, { type: "DAY", day: state.day, broke: state.economy.value === "bankrupt", values });
  state.goals = stored;
  const def = (id: string) => defs().goals.find((g) => g.id === id);
  const say = (text: string, tone: "good" | "bad") => addToast(state, text, tone, { source: "goals", importance: "you" });
  for (const e of effects) {
    if (e.type === "MET") {
      // The last one is the win's own moment (the outcome card), not a toast beside it.
      if (e.done < e.total) say(fillTemplate(GOAL_TEXT.met, { label: def(e.id)?.label ?? e.id, done: String(e.done), total: String(e.total) }), "good");
    } else if (e.type === "STRETCH") {
      pushCue(state, { type: "beat", beat: "stretch", caption: GOAL_TEXT.stretch, sub: def(e.id)?.stretch ?? "", x: state.gate.x, z: state.gate.z, zoom: 1.3, hold: 4, follow: [] });
    } else if (e.type === "HOLDING") say(fillTemplate(GOAL_TEXT.holding, { hold: String(e.hold) }), "good");
    else if (e.type === "SLIPPED") say(fillTemplate(GOAL_TEXT.slipped, { rank: String(state.race.rank), held: String(e.held) }), "bad");
    else {
      pushNews(state, rng, e.type === "WON" ? "won" : "lost");
      if (e.type === "WON") pushCue(state, { type: "sound", cue: "era" });
    }
  }
}

/**
 * A save from before FLT-86 has the goals it started with: a hold goal not met yet takes its hold (and the content's
 * target) from today, so an old lab's Arena place starts counting its 30 days now. A met goal stays met.
 */
function syncGoals(state: GameState) {
  const goals = state.goals.context.goals;
  if (!goals.some((g) => !g.met && g.hold === undefined && defs().goals.some((d) => d.id === g.id && d.hold))) return;
  const next = goals.map((g) => {
    const d = defs().goals.find((x) => x.id === g.id);
    return !g.met && g.hold === undefined && d?.hold ? { ...g, target: d.target, hold: d.hold, held: 0 } : g;
  });
  state.goals = { ...state.goals, context: { ...state.goals.context, goals: next } };
}
